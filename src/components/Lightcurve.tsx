import {
  useCallback,
  useState,
  useEffect,
  useId,
  useMemo,
  useRef,
  ChangeEvent,
} from 'react';
import './styles/lightcurve.css';
import {
  CutoutFileExtensions,
  FrequencyLightcurveData,
  FrequencyLightcurveMeasurements,
  InstrumentLightcurveData,
  InstrumentLightcurveMeasurements,
  isFrequencyLightcurveData,
} from '../types';
import Plotly, {
  Config,
  Datum,
  PlotMouseEvent,
  ScatterData,
  PlotDatum,
  PlotlyHTMLElement,
  Layout,
} from 'plotly.js-dist-min';
import { useQuery } from '../hooks/useQuery';
import { generateBaseMarkerConfig } from '../utils/lightcurveDataHelpers';
import { ToggleSwitch } from './ToggleSwitch';
import { CUTOUT_EXT_OPTIONS, DEFAULT_PLOT_LAYOUT } from '../configs/constants';
import {
  SO_BASE_COLORWAY,
  frequencyColor,
  frequencySymbol,
  moduleColor,
  moduleSymbol,
} from '../configs/socolors';
import { DownloadIcon } from './icons/DownloadIcon';
import { lightcurveApi } from '../api/client';

type LightcurveProps = {
  lightcurveData: FrequencyLightcurveData | InstrumentLightcurveData;
  plotLayout?: {
    width: number;
    height: number;
  };
  setSelectionStrategy: (s: 'instrument' | 'frequency') => void;
  selectionStrategy: 'instrument' | 'frequency';
  hideStrategyToggle?: boolean;
  hideFlaggedObsToggle?: boolean;
  title?: string;
  subtitle?: string;
};

type ClickedMarkerData =
  | {
      measurementId: string;
      data: {
        x: Datum;
        y: Datum;
        flux_err: Datum;
        flags: string[] | null;
        pageX: number;
        pageY: number;
        name: string;
        frequency: number;
        bandColor: string;
      };
    }
  | undefined;

export type BaseScatterData = ScatterData & {
  error_y: {
    type: 'data';
    array: Datum[];
    arrayminus?: Datum[] | undefined;
  };
  marker: {
    size: number;
    /** One color/symbol per trace: instrument-strategy traces are one frequency, and
     * frequency-strategy traces are split one-per-module (see plotData) so this always holds. */
    color: string;
    symbol: string;
    line: {
      width: number[];
      color: string[];
    };
  };
  measurementId: Datum[];
  flags: Datum[];
  /** The key of the trace's associated lightcurve object  */
  customdata: Datum[];
};

export type FrequencyScatterData = BaseScatterData & {
  module: Datum[];
};

type BasePlotDatum = PlotDatum & {
  'error_y.array': Datum;
  fullData: {
    marker: {
      color: string;
    };
    measurementId: string;
  };
};

/** Fills in the fields shared by every trace type at a given point index; shared between the
 * instrument-strategy (one trace per frequency) and frequency-strategy (one trace per module)
 * branches of plotData. */
function populatePoint(
  data: BaseScatterData,
  lightcurve:
    | FrequencyLightcurveMeasurements
    | InstrumentLightcurveMeasurements,
  lightcurveKey: string,
  idx: number,
  isFlagged: boolean
) {
  data.x[idx] = new Date(lightcurve.time[idx]);
  data.y[idx] = lightcurve.flux[idx];
  data.error_y.array[idx] = lightcurve.flux_err[idx];
  data.measurementId[idx] = lightcurve.measurement_id[idx];
  data.flags[idx] =
    lightcurve.extra[idx] && 'flags' in lightcurve.extra[idx] ? 1 : 0;
  data.customdata[idx] = lightcurveKey;

  if (isFlagged) {
    data.marker.line.color[idx] = 'red';
    data.marker.line.width[idx] = 1.5;
  } else {
    data.marker.line.color[idx] = '#000';
    // Initially all non-flagged marker lineWidths are 0 so that they do not show; rather, we set
    // a marker's lineWidth to 1 only when clicked or hovered
    data.marker.line.width[idx] = 0;
  }
}

/** Plotly's legend swatch mirrors marker.line.color[0]/width[0] for array-valued marker.line, so
 * a trace whose first point happens to be flagged (red outline) shows a red legend icon even
 * though the trace's real marker color/symbol is correct - this can happen any time the first
 * point of a trace is flagged, not just when every point is. A companion "legend-only" proxy
 * trace with a single null point and a constant, always-neutral marker.line gives the legend a
 * stable swatch, fully decoupled from the real trace's per-point flagged/clicked outline styling.
 * Pairing it via legendgroup keeps "click legend to hide/show" working for both traces together. */
function makeLegendProxyTrace(
  name: string,
  legendgroup: string,
  color: string,
  symbol: string
): BaseScatterData {
  return {
    name,
    legendgroup,
    showlegend: true,
    hoverinfo: 'skip',
    x: [null] as Datum[],
    y: [null] as Datum[],
    error_y: {
      type: 'data',
      array: [] as Datum[],
      color: undefined,
      thickness: 1.0,
      width: 1.0,
    },
    type: 'scatter',
    mode: 'markers',
    marker: {
      size: 5,
      color,
      symbol,
      line: { color: ['#000'], width: [0] },
    },
    hovertemplate: '(%{x}, %{y:.1f} +/- %{error_y.array:.1f})',
    measurementId: [] as Datum[],
    flags: [] as Datum[],
    customdata: [] as Datum[],
  } as BaseScatterData;
}

/** Uses Plotly to generate a source's lightcurve. Currently plots all lightcurves of a source. */
export function Lightcurve({
  lightcurveData,
  plotLayout = DEFAULT_PLOT_LAYOUT,
  setSelectionStrategy,
  selectionStrategy,
  hideStrategyToggle,
  hideFlaggedObsToggle,
  title,
  subtitle,
}: LightcurveProps) {
  // set up to use a plotlyRef instead of react-plotly for more control
  const plotlyRef = useRef<PlotlyHTMLElement | null>(null);
  // Unique per mounted instance: Main's own Lightcurve stays permanently mounted in the
  // background (see App.tsx), so more than one Lightcurve can exist in the DOM at once. Plotly.js
  // uses this container's id internally for more than just our own restyle calls - two elements
  // sharing a literal "lightcurve-plot" id caused click events on one plot to be attributed to
  // the other instance's data. useId() guarantees this can never collide between instances.
  const plotElementId = `lightcurve-plot-${useId()}`;
  const [isDataReady, setIsDataReady] = useState(false);

  const [hideFlaggedData, setHideFlaggedData] = useState(false);

  // the data used in the marker's tooltip
  const [clickedMarkerData, setClickedMarkerData] =
    useState<ClickedMarkerData>(undefined);

  const [cutoutExtension, setCutoutExtension] = useState(CUTOUT_EXT_OPTIONS[0]);

  // set up a query to fetch the imageUrl for the tooltips that re-fetches when clickedMarkerData updates
  const { data: imageUrl } = useQuery<string | undefined>({
    initialData: undefined,
    queryKey: [clickedMarkerData],
    queryFn: async () => {
      if (clickedMarkerData) {
        try {
          return await lightcurveApi.getCutoutUrl(
            lightcurveData.source_id,
            clickedMarkerData.measurementId,
            CUTOUT_EXT_OPTIONS[0]
          );
        } catch {
          return 'Not Found';
        }
      }
    },
  });

  /** A plotly-compatible data structure derived from the lightcurveData prop */
  const plotData = useMemo(() => {
    const finalData: (FrequencyScatterData | BaseScatterData)[] = [];
    const lightcurveKeys = Object.keys(lightcurveData.lightcurves);
    const isFrequencyLightcurve = isFrequencyLightcurveData(lightcurveData);

    for (const lightcurveKey of lightcurveKeys) {
      const lightcurve = lightcurveData.lightcurves[lightcurveKey];

      if (isFrequencyLightcurve) {
        // One trace per module, not one trace per lightcurveKey: a frequency-strategy
        // lightcurve can span multiple modules (see FrequencyLightcurveMeasurements.module
        // being an array), so a single shared trace would need a per-point color/symbol and
        // couldn't have one coherent legend name. Splitting gives each module its own
        // correctly-named, correctly-colored trace instead.
        const tracesByModule = new Map<string, FrequencyScatterData>();

        lightcurve.extra.forEach((extra, idx) => {
          const isFlagged = !!(extra && 'flags' in extra && extra.flags.length);

          // Exclude data point if flagged and hideFlaggedData is true
          if (hideFlaggedData && isFlagged) {
            return;
          }

          const module = (
            lightcurve.module as FrequencyLightcurveMeasurements['module']
          )[idx];

          let data = tracesByModule.get(module);
          if (!data) {
            data = {
              // String used in the plot legend
              name: `${module}, f${lightcurve.frequency}`,
              // Real per-point flagged/clicked styling below; see makeLegendProxyTrace for why
              // this trace itself is hidden from the legend.
              legendgroup: `${lightcurveKey}:${module}`,
              showlegend: false,
              x: [] as Datum[],
              y: [] as Datum[],
              error_y: {
                type: 'data',
                array: [] as Datum[],
                color: undefined,
                thickness: 1.0,
                width: 1.0,
              },
              type: 'scatter',
              mode: 'markers',
              marker: {
                size: 5,
                color: moduleColor(module),
                symbol: moduleSymbol(module),
                line: {
                  width: [] as number[],
                  color: [] as string[],
                },
              },
              hovertemplate: '(%{x}, %{y:.1f} +/- %{error_y.array:.1f})',
              measurementId: [] as Datum[],
              module: [] as Datum[],
              flags: [] as Datum[],
              customdata: [] as Datum[],
            } as FrequencyScatterData;
            tracesByModule.set(module, data);
          }

          data.module[idx] = module;
          populatePoint(data, lightcurve, lightcurveKey, idx, isFlagged);
        });

        for (const [module, data] of tracesByModule) {
          finalData.push(data);
          finalData.push(
            makeLegendProxyTrace(
              data.name,
              `${lightcurveKey}:${module}`,
              moduleColor(module),
              moduleSymbol(module)
            )
          );
        }
      } else {
        const data = {
          // String used in the plot legend
          name: `${lightcurveKey}, f${lightcurve.frequency}`,
          // Real per-point flagged/clicked styling below; see makeLegendProxyTrace for why
          // this trace itself is hidden from the legend.
          legendgroup: lightcurveKey,
          showlegend: false,
          x: [] as Datum[],
          y: [] as Datum[],
          error_y: {
            type: 'data',
            array: [] as Datum[],
            color: undefined,
            thickness: 1.0,
            width: 1.0,
          },
          type: 'scatter',
          mode: 'markers',
          marker: {
            size: 5,
            // Scalar, not per-point: an instrument-strategy trace is one fixed frequency band
            // (lightcurve.frequency), so every point in it shares the same color/symbol.
            color: frequencyColor(lightcurve.frequency),
            symbol: frequencySymbol(lightcurve.frequency),
            line: {
              width: [] as number[],
              color: [] as string[],
            },
          },
          hovertemplate: '(%{x}, %{y:.1f} +/- %{error_y.array:.1f})',
          measurementId: [] as Datum[],
          flags: [] as Datum[],
          customdata: [] as Datum[],
        } as BaseScatterData;

        // We expect each array of data in the lightcurve's data to be equal length, so
        // we could have picked any of them to iterate over
        lightcurve.extra.forEach((extra, idx) => {
          const isFlagged = !!(extra && 'flags' in extra && extra.flags.length);

          // Exclude data point if flagged and hideFlaggedData is true
          if (hideFlaggedData && isFlagged) {
            return;
          }

          populatePoint(data, lightcurve, lightcurveKey, idx, isFlagged);
        });

        finalData.push(data);
        finalData.push(
          makeLegendProxyTrace(
            data.name,
            lightcurveKey,
            frequencyColor(lightcurve.frequency),
            frequencySymbol(lightcurve.frequency)
          )
        );
      }
    }

    return finalData;
  }, [lightcurveData, hideFlaggedData]);

  /**
   * Defines layout parameters for plotly and must be memoized in order for it to be stable
   * and render properly
   */
  const plotLayoutConfig = useMemo(
    () =>
      ({
        autosize: true,
        yaxis: {
          title: {
            text: 'Flux Density (Jy)',
          },
        },
        xaxis: {
          title: {
            text: 'Date',
          },
        },
        showlegend: true,
        legend: {
          x: 0,
          xanchor: 'left',
          y: 1,
        },
        // Only reached for traces without an explicit marker.color; every trace built above
        // has one, so this is just a sane fallback rather than something actively used.
        colorway: SO_BASE_COLORWAY,
        font: {
          family: 'sans-serif',
        },
      }) as Layout,
    [plotLayout]
  );

  /** Invokes Plotly.restyle in order to update changes to marker styles */
  const handleRestyle = useCallback(
    (
      curveNumber: number | undefined,
      pointIndex: number | undefined,
      reset: boolean
    ) => {
      // Target this specific plot's DOM node, not the 'lightcurve-plot' id string: Main's own
      // Lightcurve instance stays permanently mounted in the background (see App.tsx), so more
      // than one element can share that id at once, and Plotly.restyle('lightcurve-plot', ...)
      // would resolve to whichever one is first in the DOM regardless of which plot was clicked.
      const plotElement = plotlyRef.current;
      if (!plotElement) {
        return;
      }

      plotData.forEach((d, i) => {
        // Skip legend-only proxy traces (see makeLegendProxyTrace) - they carry no real flagged
        // data (data.flags is empty) and restyling them would just overwrite their fixed,
        // single-element marker.line arrays for no visual benefit.
        if (d.showlegend) {
          return;
        }

        // see if band has a marker with styles applied (note: currently just a marker width of 2)
        const hasStyledMarker = d.marker.line.width.indexOf(2);

        // get a clean marker config that can be used for a reset or to update a single marker
        const baseMarkerConfig = generateBaseMarkerConfig(d);

        if (pointIndex !== undefined && i === curveNumber && !reset) {
          // we're requesting to update a marker on this band, so update it
          if (baseMarkerConfig.marker.line.width[pointIndex] === 1.5) {
            baseMarkerConfig.marker.line.color[pointIndex] = '#000';
          } else {
            baseMarkerConfig.marker.line.width[pointIndex] = 2;
          }
        }

        // generateBaseMarkerConfig only sets size/line - Plotly.restyle replaces the whole
        // marker object with what's given rather than merging it, so any property left out
        // (color, symbol) gets wiped and falls back to Plotly's defaults (positional colorway,
        // circle). Re-include the band's real color/symbol so every restyle call - which fires
        // on every click and on reset - doesn't undo the socolors styling.
        const newMarkerConfig = {
          marker: {
            ...baseMarkerConfig.marker,
            color: d.marker.color,
            symbol: d.marker.symbol,
          },
        };

        void Plotly.restyle(plotElement, newMarkerConfig, [i]);

        if (hasStyledMarker !== -1) {
          // if the band had a styled marker, then we've already removed all marker styles via the
          // newMarkerConfig and can break out of the forEach
          return;
        }
      });
    },
    [plotData]
  );

  /**
   * Handler for when a marker is clicked, which will set the data used for the marker's tooltip.
   * In turn, a cutout will be fetched and handleRestyle is invoked to update marker styles.
   */
  const handleMarkerClick = useCallback(
    (e: PlotMouseEvent) => {
      e.event.preventDefault();
      e.event.stopPropagation();

      const { x, y, curveNumber, pointIndex, data } = e.points[0];

      const key = String((e.points[0] as BasePlotDatum).customdata);

      const measurementId =
        lightcurveData.lightcurves[key].measurement_id[pointIndex];

      const extra = lightcurveData.lightcurves[key].extra[pointIndex];
      const flags = extra != null ? extra.flags : null;

      const { name } = data;

      const bandColor = (e.points[0] as BasePlotDatum).fullData.marker.color;

      // Create an object used for the tooltip's content and positioning
      const pointData = {
        x,
        y,
        flux_err: (e.points[0] as BasePlotDatum)['error_y.array'],
        flags,
        pageX: e.event.offsetX,
        pageY: e.event.offsetY,
        name,
        frequency: lightcurveData.lightcurves[key].frequency,
        bandColor,
      };

      setClickedMarkerData({
        measurementId,
        data: pointData,
      });

      // style clicked marker
      handleRestyle(curveNumber, pointIndex, false);
    },
    [handleRestyle, lightcurveData.lightcurves]
  );

  const plotConfig: Partial<Config> = useMemo(() => {
    return {
      responsive: true,
      displayModeBar: true,
      displaylogo: false,
    };
  }, []);

  /** Sets marker data to undefined- which closes any marker tooltips- and resets marker styles */
  const handleRelayoutOrTooltipClose = useCallback(() => {
    setClickedMarkerData(undefined);
    // reset the marker styles
    handleRestyle(undefined, undefined, true);
  }, [handleRestyle]);

  /**
   * Allows user to close an opened marker tooltip by pressing "Escape";
   * will also reset necessary state
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (clickedMarkerData && e.key == 'Escape') {
        handleRelayoutOrTooltipClose();
      }
    },
    [clickedMarkerData, handleRelayoutOrTooltipClose]
  );

  /** Creates the Plotly plot and attaches our handlers to the plot */
  useEffect(() => {
    const stablePlotlyReference = plotlyRef.current;
    if (stablePlotlyReference) {
      setIsDataReady(false);

      void Plotly.newPlot(
        stablePlotlyReference,
        plotData,
        plotLayoutConfig,
        plotConfig
      );

      void stablePlotlyReference.on(
        'plotly_relayout',
        handleRelayoutOrTooltipClose
      );

      void stablePlotlyReference.on('plotly_afterplot', () =>
        setIsDataReady(true)
      );

      void stablePlotlyReference.on('plotly_click', handleMarkerClick);
    }

    return () => {
      if (stablePlotlyReference) {
        Plotly.purge(stablePlotlyReference);
      }
    };
  }, [
    plotData,
    plotLayoutConfig,
    plotConfig,
    handleRelayoutOrTooltipClose,
    handleMarkerClick,
    setIsDataReady,
  ]);

  /** Attaches keyboard listeners to the window so we can close marker tooltips with "Esc" key */
  useEffect(() => {
    // add keydown listener to the window when handleKeyDown is initialized
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      // remove keydown lister from the window when component unmounts
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const downloadCutout = useCallback(() => {
    if (clickedMarkerData && cutoutExtension) {
      void lightcurveApi.downloadCutout(
        lightcurveData.source_id,
        clickedMarkerData.measurementId,
        cutoutExtension as CutoutFileExtensions
      );
    }
  }, [clickedMarkerData, cutoutExtension, lightcurveData.source_id]);

  const onFlaggedObservationChange = useCallback((e: ChangeEvent) => {
    e.stopPropagation();
    setHideFlaggedData((prev) => !prev);
  }, []);

  const onSelectionStrategyChange = useCallback(
    (e: ChangeEvent) => {
      e.stopPropagation();
      setSelectionStrategy(
        selectionStrategy === 'frequency' ? 'instrument' : 'frequency'
      );
    },
    [setSelectionStrategy, selectionStrategy]
  );

  return (
    <div className="lightcurve-container">
      {(title || subtitle) && (
        <div className="title-container">
          {title && <p className="title-text">{title}</p>}
          {subtitle && <p className="subtitle-text">{subtitle}</p>}
        </div>
      )}
      {hideFlaggedObsToggle !== true && (
        <div className="flagged-container">
          <ToggleSwitch
            toggleId="flag-obs"
            checked={!hideFlaggedData}
            onChange={onFlaggedObservationChange}
            disabled={false}
            checkedLabel="Show All Observations"
            uncheckedLabel="Hide Flagged Observations"
          />
          <div className="flagged-marker-legend">
            <span className="flagged-marker-desc">
              Indicates flagged observation
            </span>
            <div className="flagged-marker"></div>
          </div>
        </div>
      )}
      {hideStrategyToggle !== true && (
        <div className="selection-strategy-container">
          <ToggleSwitch
            toggleId="selection-strategy"
            checked={selectionStrategy === 'instrument'}
            onChange={onSelectionStrategyChange}
            disabled={false}
            checkedLabel="Instrument"
            uncheckedLabel="Frequency"
          />
        </div>
      )}
      <div
        // @ts-expect-error plotlyRef is an extended version of an HTMLDivElement
        ref={plotlyRef}
        id={plotElementId}
        style={{
          visibility: isDataReady ? 'visible' : 'hidden',
          height: plotLayout.height,
        }}
      >
        {clickedMarkerData && imageUrl && (
          <div
            className="plot-tooltip-container"
            style={{
              left: `${clickedMarkerData.data.pageX + 5}px`,
              top: `${clickedMarkerData.data.pageY}px`,
            }}
          >
            <div
              className="plot-tooltip-header-container"
              style={{
                backgroundColor: clickedMarkerData.data.bandColor,
              }}
            >
              <h4>{clickedMarkerData.data.name}</h4>
              <button
                type="button"
                title="Click to close (or press Esc)"
                onClick={handleRelayoutOrTooltipClose}
              >
                X
              </button>
            </div>
            <div className="plot-tooltip-content-container">
              <div className="plot-marker-data">
                <p>
                  <span>Time:</span>
                  {String(clickedMarkerData.data.x)}
                </p>
                <p>
                  <span>Flux Density:</span>
                  {String(Number(clickedMarkerData.data.y).toFixed(3))} +/-{' '}
                  {String(Number(clickedMarkerData.data.flux_err).toFixed(3))}{' '}
                  Jy
                </p>
                <p>
                  <span>Flags:</span>
                  {clickedMarkerData.data.flags?.length
                    ? clickedMarkerData.data.flags.join(', ')
                    : 'n/a'}
                </p>
              </div>
              {imageUrl === 'Not Found' ? (
                <div className="not-found flux-cutout">
                  <em>Cutout {imageUrl}</em>
                </div>
              ) : (
                <img className="flux-cutout" src={imageUrl} />
              )}
              {imageUrl !== 'Not Found' && (
                <div className="download-cutout-container">
                  <p className="download-cutout-label">Download as</p>
                  <div className="download-cutout-controls">
                    <select
                      className="select-cutout-format"
                      onChange={(e) => setCutoutExtension(e.target.value)}
                      value={cutoutExtension}
                    >
                      {CUTOUT_EXT_OPTIONS.map((ext) => (
                        <option key={ext} value={ext}>
                          {ext.toUpperCase()}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={downloadCutout}>
                      <DownloadIcon width={12} height={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      {!isDataReady && (
        <div
          className="lightcurve-loading"
          style={{ height: plotLayout.height, width: plotLayout.width }}
        >
          Loading...
        </div>
      )}
    </div>
  );
}

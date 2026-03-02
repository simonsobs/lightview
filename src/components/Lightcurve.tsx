import {
  useCallback,
  useState,
  useEffect,
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
  isFrequencyLightcurveData,
} from '../types';
import Plotly, {
  Config,
  Datum,
  PlotMouseEvent,
  ScatterData,
  ErrorBar,
  PlotDatum,
  PlotlyHTMLElement,
  Layout,
} from 'plotly.js-dist-min';
import { useQuery } from '../hooks/useQuery';
import { generateBaseMarkerConfig } from '../utils/lightcurveDataHelpers';
import { ToggleSwitch } from './ToggleSwitch';
import { CUTOUT_EXT_OPTIONS, DEFAULT_PLOT_LAYOUT } from '../configs/constants';
import { DownloadIcon } from './icons/DownloadIcon';
import { fetchCutout } from '../utils/fetchUtils';

type LightcurveProps = {
  lightcurveData: FrequencyLightcurveData | InstrumentLightcurveData;
  plotLayout?: {
    width: number;
    height: number;
  };
  setSelectionStrategy: (s: 'instrument' | 'frequency') => void;
  selectionStrategy: 'instrument' | 'frequency';
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

/** Uses Plotly to generate a source's lightcurve. Currently plots all lightcurves of a source. */
export function Lightcurve({
  lightcurveData,
  plotLayout = DEFAULT_PLOT_LAYOUT,
  setSelectionStrategy,
  selectionStrategy,
}: LightcurveProps) {
  // set up to use a plotlyRef instead of react-plotly for more control
  const plotlyRef = useRef<PlotlyHTMLElement | null>(null);

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
        const response = await fetch(
          `${import.meta.env.VITE_SERVICE_URL}/cutouts/flux/${lightcurveData.source_id}/${clickedMarkerData.measurementId}?ext=${CUTOUT_EXT_OPTIONS[0]}`
        );
        if (!response.ok) {
          return response.statusText;
        }
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        return imageUrl;
      }
    },
  });

  /** A plotly-compatible data structure derived from the lightcurveData prop */
  const plotData = useMemo(() => {
    const finalData = [];
    const lightcurveKeys = Object.keys(lightcurveData.lightcurves);
    for (const lightcurveKey of lightcurveKeys) {
      const lightcurve = lightcurveData.lightcurves[lightcurveKey];
      let data: FrequencyScatterData | BaseScatterData;

      const isFrequencyLightcurve = isFrequencyLightcurveData(lightcurveData);

      if (isFrequencyLightcurve) {
        data = {
          // String used in the plot legend
          name: '',
          x: [] as Datum[],
          y: [] as Datum[],
          error_y: {
            type: 'data',
            array: [] as Datum[],
            color: undefined,
            thickness: 1.0,
            width: 1.0,
          } as ErrorBar,
          type: 'scatter',
          mode: 'markers',
          marker: {
            size: 5,
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
      } else {
        data = {
          // String used in the plot legend
          name: `${lightcurveKey}, f${lightcurve.frequency}`,
          x: [] as Datum[],
          y: [] as Datum[],
          error_y: {
            type: 'data',
            array: [] as Datum[],
            color: undefined,
            thickness: 1.0,
            width: 1.0,
          } as ErrorBar,
          type: 'scatter',
          mode: 'markers',
          marker: {
            size: 5,
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
      }

      // We expect each array of data in the lightcurve's data to be equal length, so
      // we could have picked any of them to iterate over
      lightcurve.extra.forEach((extra, idx) => {
        const isFlagged = !!(extra && 'flags' in extra && extra.flags.length);

        // Exclude data point if flagged and hideFlaggedData is true
        if (hideFlaggedData && isFlagged) {
          return;
        }

        const day = new Date(lightcurve.time[idx]);
        // Use the index of current iteration to set the data in the various arrays defined in this
        // band's `data` object
        const flux = lightcurve.flux[idx];
        const errorY = lightcurve.flux_err[idx];
        data.x[idx] = day;
        data.y[idx] = flux;
        data.error_y.array[idx] = errorY;
        data.measurementId[idx] = lightcurve.measurement_id[idx];
        data.flags[idx] =
          lightcurve.extra[idx] && 'flags' in lightcurve.extra[idx] ? 1 : 0;
        data.customdata[idx] = lightcurveKey;

        if ('module' in data) {
          data.name = `${lightcurve.module[idx]}, f${lightcurve.frequency}`;
          data.module[idx] = (
            lightcurve.module as FrequencyLightcurveMeasurements['module']
          )[idx];
        }

        // marker fill and outline
        if (isFlagged) {
          data.marker.line.color[idx] = 'red';
          data.marker.line.width[idx] = 1.5;
        } else {
          data.marker.line.color[idx] = '#000';
          // Initially all non-flagged marker lineWidths are 0 so that they do not show; rather, we set a marker's lineWidth
          // to 1 only when clicked or hovered
          data.marker.line.width[idx] = 0;
        }
      });

      finalData.push(data);
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
        width: plotLayout.width,
        height: plotLayout.height,
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
        colorway: [
          '#f3cec9',
          '#e7a4b6',
          '#cd7eaf',
          '#a262a9',
          '#6f4d96',
          '#3d3b72',
          '#182844',
        ],
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
      plotData.forEach((d, i) => {
        // see if band has a marker with styles applied (note: currently just a marker width of 2)
        const hasStyledMarker = d.marker.line.width.indexOf(2);

        // get a clean marker config that can be used for a reset or to update a single marker
        const newMarkerConfig = generateBaseMarkerConfig(d);

        if (pointIndex !== undefined && i === curveNumber && !reset) {
          // we're requesting to update a marker on this band, so update it
          if (newMarkerConfig.marker.line.width[pointIndex] === 1.5) {
            newMarkerConfig.marker.line.color[pointIndex] = '#000';
          } else {
            newMarkerConfig.marker.line.width[pointIndex] = 2;
          }
        }

        void Plotly.restyle('lightcurve-plot', newMarkerConfig, [i]);

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
        bandColor: (e.points[0] as BasePlotDatum).fullData.marker.color,
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
      fetchCutout(
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
      {/* @ts-expect-error plotlyRef is an extended version of an HTMLDivElement*/}
      <div id="lightcurve-plot" ref={plotlyRef}>
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
    </div>
  );
}

import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import './styles/lightcurve.css';
import { CutoutFileExtensions, LightcurveData } from '../types';
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
import { CUTOUT_EXT_OPTIONS } from '../configs/constants';
import { DownloadIcon } from './icons/DownloadIcon';
import { fetchCutout } from '../utils/fetchUtils';

type LightcurveProps = {
  lightcurveData: LightcurveData;
};

type ClickedMarker = {
  pointIndex: number;
  curveNumber: number;
};

type ClickedMarkerData =
  | {
      markerId: ClickedMarker;
      data: {
        x: Datum;
        y: Datum;
        i_uncertainty: Datum;
        flags: string[] | null;
        pageX: number;
        pageY: number;
        bandName: string;
        bandColor: string;
      };
    }
  | undefined;

type ScatterDataWithErrorYAndMarkers = ScatterData & {
  error_y: {
    type: 'data';
    array: Datum[];
    arrayminus?: Datum[] | undefined;
  };
  marker: {
    size: number;
    line: {
      width: number[];
      color: string;
    };
  };
};

type EnhancedPlotDatum = PlotDatum & {
  'error_y.array': Datum;
  fullData: {
    marker: {
      color: string;
    };
  };
};

/** Uses Plotly to generate a source's lightcurve. Currently plots all bands of a source, and only the i_flux */
export function Lightcurve({ lightcurveData }: LightcurveProps) {
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
        const id =
          lightcurveData.bands[clickedMarkerData.markerId.curveNumber].id[
            clickedMarkerData.markerId.pointIndex
          ];
        const response = await fetch(
          `${import.meta.env.VITE_SERVICE_URL}/cutouts/flux/${id}?ext=${CUTOUT_EXT_OPTIONS[0]}`
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
    // Map over each band to restructure the data according to plotly configs
    return lightcurveData.bands.map((lightcurveBand) => {
      // Create a skeletal data object for each band that allows us to push data to the empty arrays initially set
      const data = {
        // String used in the plot legend
        name: `${lightcurveBand.band.name}, ${lightcurveBand.band.telescope}, ${lightcurveBand.band.instrument}`,
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
            // Set the marker's outline color to be white for purposes of mouse events, i.e. the white
            // outline only shows when a marker is clicked or hovered
            color: '#FFF',
          },
        },
        hovertemplate: '(%{x}, %{y:.1f} +/- %{error_y.array:.1f})',
      } as ScatterDataWithErrorYAndMarkers;
      // We expect each array of data in the LightcurveBand's data to be equal length, so
      // we could have picked any of them to iterate over, but I chose lightcurveBand.time
      // for no particular reason
      lightcurveBand.time.forEach((time, index) => {
        const extra = lightcurveBand.extra[index];
        if (
          hideFlaggedData &&
          extra &&
          'flags' in extra &&
          extra.flags.length
        ) {
          return;
        }
        const day = new Date(time);
        // Use the index of current iteration to set the data in the various arrays defined in this
        // band's `data` object
        const flux = lightcurveBand.i_flux[index];
        const errorY = lightcurveBand.i_uncertainty[index];
        data.x[index] = day;
        data.y[index] = flux;
        data.error_y.array[index] = errorY;
        // Initially all marker lineWidths are 0 so that they do not show; rather, we set a marker's lineWidth
        // to 1 only when clicked or hovered
        data.marker.line.width[index] = 0;
      });
      return data;
    });
  }, [lightcurveData, hideFlaggedData]);

  /**
   * Defines layout parameters for plotly and must be memoized in order for it to be stable
   * and render properly
   */
  const plotLayout = useMemo(
    () =>
      ({
        width: 1280,
        height: 500,
        yaxis: {
          title: {
            text: 'Flux (Jy)',
          },
        },
        xaxis: {
          title: {
            text: 'Date',
          },
        },
        title: {
          text: `Light Curve for SO-${lightcurveData.source.id}`,
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
    [lightcurveData.source.id]
  );

  /** Invokes Plotly.restyle in order to update changes to marker styles */
  const handleRestyle = useCallback(
    (
      curveNumber: number | undefined,
      pointIndex: number | undefined,
      reset: boolean
    ) => {
      plotData.forEach((d, i) => {
        const markerArrayLength = d.marker.line.width.length;
        // see if band has a marker with styles applied (note: currently just a marker width of 2)
        const hasStyledMarker = d.marker.line.width.indexOf(2);

        // get a clean marker config that can be used for a reset or to update a single marker
        const newMarkerConfig = generateBaseMarkerConfig(markerArrayLength);

        if (pointIndex !== undefined && i === curveNumber && !reset) {
          // we're requesting to update a marker on this band, so update it
          newMarkerConfig.marker.line.width[pointIndex] = 2;
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

      const { x, y, pointIndex, curveNumber, data } = e.points[0];

      const { name } = data;
      const extra = lightcurveData.bands[curveNumber].extra[pointIndex];
      const flags = extra != null ? extra.flags : null;

      // Create an object used for the tooltip's content and positioning
      const pointData = {
        x,
        y,
        i_uncertainty: (e.points[0] as EnhancedPlotDatum)['error_y.array'],
        flags,
        pageX: e.event.pageX,
        pageY: e.event.pageY,
        bandName: name,
        bandColor: (e.points[0] as EnhancedPlotDatum).fullData.marker.color,
      };

      setClickedMarkerData({
        markerId: {
          pointIndex,
          curveNumber,
        },
        data: pointData,
      });

      // style clicked marker
      handleRestyle(curveNumber, pointIndex, false);
    },
    [handleRestyle, lightcurveData.bands]
  );

  const plotConfig: Partial<Config> = useMemo(() => {
    return {
      responsive: true,
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
        plotLayout,
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
    plotLayout,
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
      const id =
        lightcurveData.bands[clickedMarkerData.markerId.curveNumber].id[
          clickedMarkerData.markerId.pointIndex
        ];
      fetchCutout(id, cutoutExtension as CutoutFileExtensions);
    }
  }, [clickedMarkerData?.markerId, cutoutExtension]);

  return (
    <div className="lightcurve-container">
      <ToggleSwitch
        checked={!hideFlaggedData}
        onChange={() => setHideFlaggedData(!hideFlaggedData)}
        disabled={false}
        checkedLabel="Show All Observations"
        uncheckedLabel="Hide All Observations"
      />
      {/* @ts-expect-error plotlyRef is an extended version of an HTMLDivElement*/}
      <div id="lightcurve-plot" ref={plotlyRef} />
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
            <h4>{clickedMarkerData.data.bandName}</h4>
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
                <span>Flux:</span>
                {String(Number(clickedMarkerData.data.y).toFixed(3))} +/-{' '}
                {String(
                  Number(clickedMarkerData.data.i_uncertainty).toFixed(3)
                )}{' '}
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
                  >
                    {CUTOUT_EXT_OPTIONS.map((ext) => (
                      <option
                        key={ext}
                        value={ext}
                        selected={cutoutExtension === ext}
                      >
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
  );
}

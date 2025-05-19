import { useCallback, useState, useEffect, useMemo, useRef } from 'react';
import './styles/lightcurve.css';
import { LightcurveData } from '../types';
import Plotly, {
  Config,
  Datum,
  PlotMouseEvent,
  ScatterData,
  ErrorBar,
  PlotDatum,
  PlotlyHTMLElement,
} from 'plotly.js-dist-min';
import { useQuery } from '../hooks/useQuery';
import { generateBaseMarkerConfig } from '../utils/lightcurveDataHelpers';

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
          `${import.meta.env.VITE_SERVICE_URL}/cutouts/flux/${id}`
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
        } as ErrorBar,
        type: 'scatter',
        mode: 'markers',
        marker: {
          size: 10,
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
    () => ({
      width: 1280,
      height: 500,
      yaxis: {
        title: {
          text: 'Flux (Jy)',
        },
      },
      xaxis: {
        title: {
          text: 'Time (d)',
        },
      },
      title: {
        text: `Lightcurve for SO-${lightcurveData.source.id}`,
      },
    }),
    []
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
    [handleRestyle]
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

  return (
    <div className="lightcurve-container">
      <button
        className="hide-data-btn"
        onClick={() => setHideFlaggedData(!hideFlaggedData)}
      >
        {hideFlaggedData ? 'Show All' : 'Hide Flagged'} Observations
      </button>
      {/* @ts-expect-error plotlyRef is an extended version of an HTMLDivElement*/}
      <div id="lightcurve-plot" ref={plotlyRef} />
      {clickedMarkerData && imageUrl && (
        <div
          className="plot-tooltip-container"
          style={{
            left: `${clickedMarkerData.data.pageX}px`,
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
              x
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
          </div>
        </div>
      )}
    </div>
  );
}

import { useCallback, useState, useEffect, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { SERVICE_URL } from '../configs/constants';
import './styles/lightcurve.css';
import { LightcurveData } from '../types';
import {
  Datum,
  PlotHoverEvent,
  PlotMouseEvent,
  ScatterData,
  ErrorBar,
  PlotDatum,
} from 'plotly.js';
import { useQuery } from '../hooks/useQuery';

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
        clientX: number;
        clientY: number;
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

type PlotDatumWithErrorY = PlotDatum & {
  'error_y.array': Datum;
};

/** Uses Plotly to generate a source's lightcurve. Currently plots all bands of a source, and only the i_flux */
export function Lightcurve({ lightcurveData }: LightcurveProps) {
  const [clickedMarkerData, setClickedMarkerData] =
    useState<ClickedMarkerData>(undefined);

  const { data: imageUrl } = useQuery<string | undefined>({
    initialData: undefined,
    queryKey: [clickedMarkerData],
    queryFn: async () => {
      if (clickedMarkerData) {
        const id =
          lightcurveData.bands[clickedMarkerData.markerId.curveNumber].id[
            clickedMarkerData.markerId.pointIndex
          ];
        const response = await fetch(`${SERVICE_URL}/cutouts/flux/${id}`);
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);
        return imageUrl;
      }
    },
  });

  const [plotData, setPlotData] = useState<ScatterDataWithErrorYAndMarkers[]>(
    () => {
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
        } as ScatterDataWithErrorYAndMarkers;
        // We expect each array of data in the LightcurveBand's data to be equal length, so
        // we would have picked any of them to iterate over, but I chose lightcurveBand.time
        // for no particular reason
        lightcurveBand.time.forEach((time, index) => {
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
    }
  );

  const changeMarkerLineWidth = useCallback(
    (
      hoverData: ClickedMarker | undefined,
      newLineWidth: number,
      reset: boolean
    ) => {
      // Update plotData according to a click or hover event such that we style the affected
      // marker accordingly
      setPlotData((prev) =>
        prev.map((d, i) => {
          // A reset will copy all previous data except for the marker.line.width array, which
          // will be set as a new array filled with 0s
          if (reset) {
            const newWidths = new Array(d.marker.line.width.length).fill(0);
            return {
              ...d,
              marker: {
                ...d.marker,
                line: {
                  ...d.marker.line,
                  width: newWidths,
                },
              },
            };
          }

          // If we're passed hoverData and the curveNumber is the same as the current
          // band's plotData, then we need to set the marker's lineWidth to be the
          // passed-in newLineWidth argument
          if (hoverData && hoverData.curveNumber === i) {
            const newWidths = [...d.marker.line.width];
            // If we don't have a clickedMarkerIndex set, it's straightforward
            // and we can just set the newLineWidth and carry on
            if (!clickedMarkerData) {
              newWidths[hoverData.pointIndex] = newLineWidth;
            } else {
              // Verify that we're not messing with the clicked marker's styling
              if (
                !(
                  hoverData.curveNumber ===
                    clickedMarkerData.markerId.curveNumber &&
                  hoverData.pointIndex === clickedMarkerData.markerId.pointIndex
                )
              ) {
                newWidths[hoverData.pointIndex] = newLineWidth;
              }
            }
            return {
              ...d,
              marker: {
                ...d.marker,
                line: {
                  ...d.marker.line,
                  width: newWidths,
                },
              },
            };
          } else {
            // We have no hoverData and/or the hoverData doesn't correspond to this band,
            // so the data will remain unchanged
            return d;
          }
        })
      );
    },
    [clickedMarkerData]
  );

  /**
   * Allows user to close an opened marker tooltip by pressing "Escape";
   * will also reset necessary state
   */
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (clickedMarkerData && e.key == 'Escape') {
        setClickedMarkerData(undefined);
        changeMarkerLineWidth(undefined, 0, true);
      }
    },
    [clickedMarkerData, changeMarkerLineWidth]
  );

  useEffect(() => {
    // add keydown listener to the window when handleKeyDown is initialized
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      // remove keydown lister from the window when component unmounts
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  /** Used with changeMarkerLineWidth in order to change affected marker's style */
  const handleOnHover = useCallback(
    (e: PlotHoverEvent) => {
      const { pointIndex, curveNumber } = e.points[0];
      changeMarkerLineWidth({ pointIndex, curveNumber }, 1, false);
    },
    [changeMarkerLineWidth]
  );

  /** Used with changeMarkerLineWidth in order to change affected marker's style */
  const handleOnUnhover = useCallback(
    (e: PlotMouseEvent) => {
      const { pointIndex, curveNumber } = e.points[0];
      changeMarkerLineWidth({ pointIndex, curveNumber }, 0, false);
    },
    [changeMarkerLineWidth]
  );

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
          text: 'Flux (mJy)',
        },
      },
      xaxis: {
        title: {
          text: 'Time (d)',
        },
      },
    }),
    []
  );

  const handleDataClick = useCallback((e: PlotMouseEvent) => {
    const { x, y, pointIndex, curveNumber } = e.points[0];
    // Create an object used for the tooltip's content and positioning
    const data = {
      x,
      y,
      i_uncertainty: (e.points[0] as PlotDatumWithErrorY)['error_y.array'],
      clientX: e.event.clientX,
      clientY: e.event.clientY,
    };
    setClickedMarkerData({
      markerId: {
        pointIndex,
        curveNumber,
      },
      data,
    });
  }, []);

  return (
    <div>
      <Plot
        layout={plotLayout}
        data={plotData}
        onClick={handleDataClick}
        onRelayout={() => setClickedMarkerData(undefined)}
        onHover={handleOnHover}
        onUnhover={handleOnUnhover}
      />
      {clickedMarkerData && imageUrl && (
        <div
          className="plot-tooltip-container"
          style={{
            left: `${clickedMarkerData.data.clientX}px`,
            top: `${clickedMarkerData.data.clientY}px`,
          }}
        >
          <button
            type="button"
            title="Click to close (or press Esc)"
            onClick={() => {
              setClickedMarkerData(undefined);
              changeMarkerLineWidth(undefined, 0, true);
            }}
          >
            x
          </button>
          <p>Time: {String(clickedMarkerData.data.x)}</p>
          <p>
            Flux: {String(clickedMarkerData.data.y)} +/-{' '}
            {String(clickedMarkerData.data.i_uncertainty)} mJy
          </p>
          <img className="flux-cutout" src={imageUrl} />
        </div>
      )}
    </div>
  );
}

import { useCallback, useState, useEffect, useMemo } from 'react';
import Plot from 'react-plotly.js';
import { SERVICE_URL } from '../configs/constants';
import './styles/tooltip-dialog.css';
import { LightcurveData } from '../types';
import {
  Datum,
  PlotHoverEvent,
  PlotMouseEvent,
  ScatterData,
  ErrorBar,
  PlotDatum,
} from 'plotly.js';

type LightcurveProps = {
  lightcurveData: LightcurveData;
};

type ClickedMarker =
  | {
      pointIndex: number;
      curveNumber: number;
    }
  | undefined;

type TooltipContent =
  | {
      data: {
        x: Datum;
        y: Datum;
        i_uncertainty: Datum;
        clientX: number;
        clientY: number;
      };
      imageUrl: string;
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

export function Lightcurve({ lightcurveData }: LightcurveProps) {
  const [tooltipContent, setTooltipContent] =
    useState<TooltipContent>(undefined);
  const [clickedMarkerIndex, setClickedMarkerIndex] =
    useState<ClickedMarker>(undefined);

  const [plotData, setPlotData] = useState<ScatterDataWithErrorYAndMarkers[]>(
    () => {
      return lightcurveData.bands.map((lightcurveBand) => {
        const data = {
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
              color: '#FFF',
            },
          },
          // hovertemplate: 'Time: %{x|%H:%M %d %b %Y} <br><br> Flux: %{y} mJy <extra></extra>'
        } as ScatterDataWithErrorYAndMarkers;
        lightcurveBand.time.forEach((time, index) => {
          const day = new Date(time);
          const flux = lightcurveBand.i_flux[index];
          const errorY = lightcurveBand.i_uncertainty[index];
          data.x[index] = day;
          data.y[index] = flux;
          data.error_y.array[index] = errorY;
          data.marker.line.width[index] = 0;
        });
        return data;
      });
    }
  );

  const changeMarkerLineWidth = useCallback(
    (hoverData: ClickedMarker, newLineWidth: number, reset: boolean) => {
      setPlotData((prev) =>
        prev.map((d, i) => {
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

          if (hoverData && hoverData.curveNumber === i) {
            const newWidths = [...d.marker.line.width];
            if (!clickedMarkerIndex) {
              newWidths[hoverData.pointIndex] = newLineWidth;
            } else {
              if (
                !(
                  hoverData.curveNumber === clickedMarkerIndex.curveNumber &&
                  hoverData.pointIndex === clickedMarkerIndex.pointIndex
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
            return d;
          }
        })
      );
    },
    [clickedMarkerIndex]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (tooltipContent && e.key == 'Escape') {
        setTooltipContent(undefined);
        setClickedMarkerIndex(undefined);
        changeMarkerLineWidth(undefined, 0, true);
      }
    },
    [tooltipContent, changeMarkerLineWidth]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  const handleDataClick = useCallback(
    (e: PlotMouseEvent) => {
      void (async () => {
        const { x, y, pointIndex, curveNumber } = e.points[0];
        const id = lightcurveData.bands[curveNumber].id[pointIndex];
        const point = {
          x,
          y,
          i_uncertainty: (e.points[0] as PlotDatumWithErrorY)['error_y.array'],
          clientX: e.event.clientX,
          clientY: e.event.clientY,
        };
        try {
          const response = await fetch(`${SERVICE_URL}/cutouts/flux/${id}`);
          const blob = await response.blob();
          const imageUrl = URL.createObjectURL(blob);
          setTooltipContent({ imageUrl, data: point });
          changeMarkerLineWidth(undefined, 1, false);
          setClickedMarkerIndex({ pointIndex, curveNumber });
        } catch (error) {
          console.error('Error handling data click:', error);
        }
      })();
    },
    [lightcurveData, changeMarkerLineWidth]
  );

  const handleOnHover = useCallback(
    (e: PlotHoverEvent) => {
      const { pointIndex, curveNumber } = e.points[0];
      changeMarkerLineWidth({ pointIndex, curveNumber }, 1, false);
    },
    [changeMarkerLineWidth]
  );

  const handleOnUnhover = useCallback(
    (e: PlotMouseEvent) => {
      const { pointIndex, curveNumber } = e.points[0];
      changeMarkerLineWidth({ pointIndex, curveNumber }, 0, false);
    },
    [changeMarkerLineWidth]
  );

  const plotLayout = useMemo(
    () => ({
      width: 1200,
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

  return (
    <div>
      <Plot
        layout={plotLayout}
        data={plotData}
        onClick={handleDataClick}
        onRelayout={() => setTooltipContent(undefined)}
        onHover={handleOnHover}
        onUnhover={handleOnUnhover}
      />
      {tooltipContent && (
        <div
          style={{
            position: 'absolute',
            left: `${tooltipContent.data.clientX}px`,
            top: `${tooltipContent.data.clientY}px`,
            backgroundColor: 'white',
            opacity: 0.8,
            border: '1px solid black',
            padding: 5,
          }}
        >
          <button
            type="button"
            style={{ margin: '0 auto' }}
            title="Click to close (or press Esc)"
            onClick={() => {
              setTooltipContent(undefined);
              setClickedMarkerIndex(undefined);
              changeMarkerLineWidth(undefined, 0, true);
            }}
          >
            x
          </button>
          <p>Time: {String(tooltipContent.data.x)}</p>
          <p>
            Flux: {String(tooltipContent.data.y)} +/-{' '}
            {String(tooltipContent.data.i_uncertainty)} mJy
          </p>
          <img className="flux-cutout" src={tooltipContent.imageUrl} />
        </div>
      )}
    </div>
  );
}

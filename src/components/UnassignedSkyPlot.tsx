import { useEffect, useMemo, useRef, useState } from 'react';
import Plotly, { Config, Data, Layout, Shape } from 'plotly.js-dist-min';
import { UnassignedFluxMeasurement } from '../types';
import { frequencyColor, moduleSymbol } from '../configs/socolors';
import {
  buildInstrumentLegendTraces,
  groupMeasurementsByInstrument,
  INSTRUMENT_LEGEND_LAYOUT,
  INSTRUMENT_LEGEND_MARGIN,
  tangentPlaneOffsetArcmin,
} from '../utils/unassignedPlotHelpers';

type UnassignedSkyPlotProps = {
  sourceRa: number;
  sourceDec: number;
  measurements: UnassignedFluxMeasurement[];
  beamRadiusArcmin: number;
  height?: number;
};

const PLOT_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
};

const SOURCE_MARKER_COLOR = '#CC3311';
const BEAM_CIRCLE_COLOR = '#F26522';

function buildTrace(
  key: string,
  group: UnassignedFluxMeasurement[],
  sourceRa: number,
  sourceDec: number
): Data {
  const [frequency, module] = key.split(':');
  const color = frequencyColor(Number(frequency));
  const offsets = group.map((m) =>
    tangentPlaneOffsetArcmin(sourceRa, sourceDec, m.ra, m.dec)
  );
  return {
    name: `${module} · f${frequency}`,
    // The frequency/optics-tube legend is built separately from legend-only proxy traces (see
    // buildInstrumentLegendTraces) so it can split colour and shape into two legends.
    showlegend: false,
    x: offsets.map(([raOffset]) => raOffset),
    y: offsets.map(([, decOffset]) => decOffset),
    customdata: group.map((m) => [m.time, m.ra, m.dec, m.frequency, m.module]),
    mode: 'markers',
    type: 'scatter',
    marker: {
      color,
      symbol: moduleSymbol(module),
      size: 6,
      line: { width: 1, color },
    },
    hovertemplate:
      'Time: %{customdata[0]}<br>' +
      'RA: %{customdata[1]:.5f}°<br>' +
      'Dec: %{customdata[2]:.5f}°<br>' +
      'Frequency: %{customdata[3]} GHz<br>' +
      'Optic tube: %{customdata[4]}<br>' +
      'RA offset: %{x:.3f} arcmin<br>' +
      'Dec offset: %{y:.3f} arcmin<extra></extra>',
  };
}

const SOURCE_POSITION_TRACE: Data = {
  x: [0],
  y: [0],
  mode: 'markers',
  type: 'scatter',
  marker: { color: SOURCE_MARKER_COLOR, symbol: 'x', size: 12 },
  showlegend: false,
  hovertemplate: 'Representative source position<extra></extra>',
};

/** Interactive local-offset plot for an unassigned source's detections; one marker trace per
 * (frequency, module), plotted as tangent-plane offsets (arcmin) from the source position,
 * with a dashed circle for the configured beam radius. */
export function UnassignedSkyPlot({
  sourceRa,
  sourceDec,
  measurements,
  beamRadiusArcmin,
  height = 400,
}: UnassignedSkyPlotProps) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [isDataReady, setIsDataReady] = useState(false);

  const plotData = useMemo<Data[]>(() => {
    const grouped = groupMeasurementsByInstrument(measurements);
    return [
      ...Array.from(grouped.entries()).map(([key, group]) =>
        buildTrace(key, group, sourceRa, sourceDec)
      ),
      SOURCE_POSITION_TRACE,
      ...buildInstrumentLegendTraces(measurements),
    ];
  }, [measurements, sourceRa, sourceDec]);

  const plotLayout = useMemo<Partial<Layout>>(() => {
    const beamCircle: Partial<Shape> = {
      type: 'circle',
      x0: -beamRadiusArcmin,
      x1: beamRadiusArcmin,
      y0: -beamRadiusArcmin,
      y1: beamRadiusArcmin,
      line: { color: BEAM_CIRCLE_COLOR, dash: 'dash', width: 2 },
    };
    return {
      autosize: true,
      margin: INSTRUMENT_LEGEND_MARGIN,
      hovermode: 'closest',
      showlegend: true,
      ...INSTRUMENT_LEGEND_LAYOUT,
      shapes: [beamCircle],
      xaxis: {
        title: { text: 'RA offset (arcmin)' },
        zeroline: true,
        zerolinecolor: '#BBBBBB',
      },
      yaxis: {
        title: { text: 'Dec offset (arcmin)' },
        zeroline: true,
        zerolinecolor: '#BBBBBB',
        scaleanchor: 'x',
        scaleratio: 1,
      },
    };
  }, [beamRadiusArcmin]);

  useEffect(() => {
    const el = plotRef.current;
    if (!el) return;

    setIsDataReady(false);
    void Plotly.newPlot(el, plotData, plotLayout, PLOT_CONFIG).then(() =>
      setIsDataReady(true)
    );

    return () => {
      Plotly.purge(el);
    };
  }, [plotData, plotLayout]);

  if (!measurements.length) {
    return <p className="small-text">No detections to plot.</p>;
  }

  return (
    <div className="unassigned-plot-wrapper" style={{ height }}>
      <div
        ref={plotRef}
        style={{ visibility: isDataReady ? 'visible' : 'hidden', height }}
      />
      {!isDataReady && (
        <div className="unassigned-plot-loading" style={{ height }}>
          Loading...
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import Plotly, { Config, Data, Layout } from 'plotly.js-dist-min';
import { UnassignedFluxMeasurement } from '../types';
import { frequencyColor, moduleSymbol } from '../configs/socolors';
import {
  buildInstrumentLegendTraces,
  groupMeasurementsByInstrument,
  INSTRUMENT_LEGEND_LAYOUT,
  INSTRUMENT_LEGEND_MARGIN,
} from '../utils/unassignedPlotHelpers';

type UnassignedLightcurvePlotProps = {
  measurements: UnassignedFluxMeasurement[];
  height?: number;
};

const PLOT_CONFIG: Partial<Config> = {
  displaylogo: false,
  responsive: true,
};

function buildTrace(key: string, group: UnassignedFluxMeasurement[]): Data {
  const [frequency, module] = key.split(':');
  const color = frequencyColor(Number(frequency));
  return {
    name: `${module} · f${frequency}`,
    // The frequency/optics-tube legend is built separately from legend-only proxy traces (see
    // buildInstrumentLegendTraces) so it can split color and shape into two legends.
    showlegend: false,
    x: group.map((m) => new Date(m.time)),
    y: group.map((m) => m.flux),
    error_y: {
      type: 'data',
      array: group.map((m) => m.flux_err),
      visible: true,
      color: color,
      thickness: 1.5,
    },
    customdata: group.map((m) => [m.frequency, m.module]),
    mode: 'markers',
    type: 'scatter',
    marker: {
      color,
      symbol: moduleSymbol(module),
      size: 6,
      line: { width: 1, color },
    },
    hovertemplate:
      'Time: %{x|%Y-%m-%d %H:%M:%S UTC}<br>' +
      'Flux: %{y:.3f} mJy<br>' +
      'Frequency: %{customdata[0]} GHz<br>' +
      'Optic tube: %{customdata[1]}<extra></extra>',
  };
}

/** Interactive flux-versus-time plot for an unassigned source; one marker trace per
 * (frequency, module), colored by frequency and shaped by optics tube. */
export function UnassignedLightcurvePlot({
  measurements,
  height = 400,
}: UnassignedLightcurvePlotProps) {
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [isDataReady, setIsDataReady] = useState(false);

  const plotData = useMemo<Data[]>(() => {
    const grouped = groupMeasurementsByInstrument(measurements);
    return [
      ...Array.from(grouped.entries()).map(([key, group]) =>
        buildTrace(key, group)
      ),
      ...buildInstrumentLegendTraces(measurements),
    ];
  }, [measurements]);

  const plotLayout = useMemo<Partial<Layout>>(() => {
    const maxFlux = measurements.length
      ? Math.max(...measurements.map((m) => m.flux))
      : 1;
    return {
      autosize: true,
      margin: INSTRUMENT_LEGEND_MARGIN,
      hovermode: 'closest',
      showlegend: true,
      ...INSTRUMENT_LEGEND_LAYOUT,
      xaxis: { title: { text: 'Observation time (UTC)' } },
      yaxis: {
        title: { text: 'Flux (mJy)' },
        range: [0, maxFlux * 1.05],
        zeroline: false,
      },
    };
  }, [measurements]);

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

import { Data, Legend } from 'plotly.js-dist-min';
import { frequencyColor, moduleSymbol } from '../configs/socolors';

/** Neutral marker color for optics-tube/module legend swatches, which encode shape only - color
 * is reserved for frequency elsewhere in the plot. */
const LEGEND_NEUTRAL_COLOR = '#0F172A';

/** A legend-only proxy trace tagged with which instrument axis (and value on that axis) it
 * represents, so a caller wiring up "plotly_legendclick" can route the click back to the real
 * traces sharing that frequency/module without parsing it back out of the display name. */
export type InstrumentLegendProxyTrace = Data & {
  legendAxis: 'frequency' | 'module';
  legendValue: number | string;
};

function buildFrequencyLegendTrace(
  frequency: number,
  legendrank: number
): InstrumentLegendProxyTrace {
  return {
    x: [null],
    y: [null],
    mode: 'markers',
    type: 'scatter',
    marker: { color: frequencyColor(frequency), symbol: 'circle', size: 8 },
    name: `${frequency} GHz`,
    showlegend: true,
    hoverinfo: 'skip',
    legendrank,
    legendAxis: 'frequency',
    legendValue: frequency,
  };
}

function buildModuleLegendTrace(
  module: string,
  legendrank: number
): InstrumentLegendProxyTrace {
  return {
    x: [null],
    y: [null],
    mode: 'markers',
    type: 'scatter',
    marker: {
      color: LEGEND_NEUTRAL_COLOR,
      symbol: moduleSymbol(module),
      size: 8,
      line: { color: LEGEND_NEUTRAL_COLOR, width: 1 },
    },
    name: module,
    showlegend: true,
    hoverinfo: 'skip',
    legendrank,
    legendAxis: 'module',
    legendValue: module,
    // Plotly.js supports multiple independent legends by pointing a trace at "legend2" (a
    // documented feature since v2.31) - @types/plotly.js doesn't model that field, hence the cast.
    legend: 'legend2',
  } as unknown as InstrumentLegendProxyTrace;
}

/** One (frequency, module) combination contributing to an instrument legend. */
export type InstrumentLegendItem = { frequency: number; module: string };

/** Legend-only proxy traces that split a frequency/optics-tube instrument key into two
 * independent legends: a color-only frequency legend and a shape-only optics-tube legend. Real
 * per-instrument data traces should set showlegend: false so only these proxies appear in the
 * legend (or, if the caller wants those legend entries interactive, listen for
 * "plotly_legendclick" and match its event data back to real traces by frequency/module). */
export function buildInstrumentLegendTraces(
  items: InstrumentLegendItem[]
): InstrumentLegendProxyTrace[] {
  const frequencies = Array.from(
    new Set(items.map((item) => item.frequency))
  ).sort((a, b) => a - b);
  const modules = Array.from(new Set(items.map((item) => item.module))).sort();

  return [
    ...frequencies.map((frequency, index) =>
      buildFrequencyLegendTrace(frequency, index)
    ),
    ...modules.map((module, index) =>
      buildModuleLegendTrace(module, frequencies.length + index)
    ),
  ];
}

const SHARED_LEGEND_STYLE: Partial<Legend> = {
  orientation: 'h',
  x: 0,
  xanchor: 'left',
  traceorder: 'normal',
};

/** Layout for the frequency legend (top row) and optics-tube legend (bottom row), stacked above
 * the plot. Deliberately doesn't disable itemclick/itemdoubleclick here - some callers want a
 * purely decorative key (and disable clicks themselves on top of this), others wire the clicks
 * up to something real. */
export const DEFAULT_INSTRUMENT_LEGEND_LAYOUT = {
  legend: {
    ...SHARED_LEGEND_STYLE,
    y: 1.23,
    yanchor: 'bottom',
  } as Partial<Legend>,
  legend2: {
    ...SHARED_LEGEND_STYLE,
    y: 1.15,
    yanchor: 'bottom',
  } as Partial<Legend>,
};

/** The margin that gives INSTRUMENT_LEGEND_LAYOUT's two legend rows (plus Plotly's mode bar)
 * enough room above the plot. */
export const DEFAULT_INSTRUMENT_LEGEND_MARGIN = { t: 135 };

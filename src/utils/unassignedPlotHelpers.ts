import { Data, Legend } from 'plotly.js-dist-min';
import { UnassignedFluxMeasurement } from '../types';
import { frequencyColor, moduleSymbol } from '../configs/socolors';

/** Groups flux measurements by (frequency, module) so each instrument combination gets its own
 * trace */
export function groupMeasurementsByInstrument(
  measurements: UnassignedFluxMeasurement[]
): Map<string, UnassignedFluxMeasurement[]> {
  const grouped = new Map<string, UnassignedFluxMeasurement[]>();
  for (const measurement of measurements) {
    const key = `${measurement.frequency}:${measurement.module}`;
    const group = grouped.get(key);
    if (group) {
      group.push(measurement);
    } else {
      grouped.set(key, [measurement]);
    }
  }
  return grouped;
}

/** Offsets a position from the source position onto the source's tangent plane, in arcminutes.
 * Equivalent to astropy's SkyCoord.spherical_offsets_to at the arcminute scales these plots
 * cover. */
export function tangentPlaneOffsetArcmin(
  sourceRaDeg: number,
  sourceDecDeg: number,
  raDeg: number,
  decDeg: number
): [raOffset: number, decOffset: number] {
  const toRad = Math.PI / 180;
  const radToArcmin = (180 / Math.PI) * 60;

  const dec0 = sourceDecDeg * toRad;
  const dec = decDeg * toRad;
  const dRa = (raDeg - sourceRaDeg) * toRad;

  const cosC =
    Math.sin(dec0) * Math.sin(dec) +
    Math.cos(dec0) * Math.cos(dec) * Math.cos(dRa);
  const xi = (Math.cos(dec) * Math.sin(dRa)) / cosC;
  const eta =
    (Math.cos(dec0) * Math.sin(dec) -
      Math.sin(dec0) * Math.cos(dec) * Math.cos(dRa)) /
    cosC;

  return [xi * radToArcmin, eta * radToArcmin];
}

/** Neutral marker color for optics-tube legend swatches, which encode shape only */
const LEGEND_NEUTRAL_COLOR = '#0F172A';

function buildFrequencyLegendTrace(
  frequency: number,
  legendrank: number
): Data {
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
  };
}

function buildModuleLegendTrace(module: string, legendrank: number): Data {
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
    // Plotly.js supports multiple independent legends by pointing a trace at "legend2" (a
    // documented feature since v2.31) - @types/plotly.js doesn't model that field, hence the cast.
    legend: 'legend2',
  } as unknown as Data;
}

/** Legend-only proxy traces that split the frequency/optics-tube instrument key into two
 * independent legends - a color-only frequency legend and a shape-only optics-tube legend.
 * Real per-instrument data traces should set showlegend: false so only these proxies appear
 * in the legend. */
export function buildInstrumentLegendTraces(
  measurements: UnassignedFluxMeasurement[]
): Data[] {
  const frequencies = Array.from(
    new Set(measurements.map((m) => m.frequency))
  ).sort((a, b) => a - b);
  const modules = Array.from(new Set(measurements.map((m) => m.module))).sort();

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
  itemclick: false,
  itemdoubleclick: false,
};

/** Layout for the frequency legend (top row) and optics-tube legend (bottom row), stacked above
 * the plot  */
export const INSTRUMENT_LEGEND_LAYOUT = {
  legend: {
    ...SHARED_LEGEND_STYLE,
    y: 1.24,
    yanchor: 'bottom',
  } as Partial<Legend>,
  legend2: {
    ...SHARED_LEGEND_STYLE,
    y: 1.14,
    yanchor: 'bottom',
  } as Partial<Legend>,
};

/** The margin that gives INSTRUMENT_LEGEND_LAYOUT's two legend rows (plus Plotly's mode bar)
 * enough room above the plot */
export const INSTRUMENT_LEGEND_MARGIN = { l: 60, r: 24, t: 120, b: 56 };

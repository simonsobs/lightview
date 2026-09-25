import { Data, Legend } from 'plotly.js-dist-min';
import { UnassignedFluxMeasurement } from '../types';
import {
  buildInstrumentLegendTraces as buildInstrumentLegendTracesForItems,
  DEFAULT_INSTRUMENT_LEGEND_LAYOUT as BASE_INSTRUMENT_LEGEND_LAYOUT,
} from './instrumentLegend';

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

/** Legend-only proxy traces that split the frequency/optics-tube instrument key into two
 * independent legends: a color-only frequency legend and a shape-only optics-tube legend.
 * Real per-instrument data traces should set showlegend: false so only these proxies appear
 * in the legend. Thin adapter over the shared instrumentLegend builder, which takes plain
 * {frequency, module} items rather than this module's specific measurement shape. */
export function buildInstrumentLegendTraces(
  measurements: UnassignedFluxMeasurement[]
): Data[] {
  return buildInstrumentLegendTracesForItems(measurements);
}

/** These proxy legends aren't tied to any real toggleable trace here (unlike Lightcurve.tsx's
 * use of the same shared layout), so clicking one would just silently toggle an invisible
 * null-point trace */
const NON_INTERACTIVE: Partial<Legend> = {
  itemclick: false,
  itemdoubleclick: false,
};

export const INSTRUMENT_LEGEND_LAYOUT = {
  legend: { ...BASE_INSTRUMENT_LEGEND_LAYOUT.legend, ...NON_INTERACTIVE },
  legend2: {
    ...BASE_INSTRUMENT_LEGEND_LAYOUT.legend2,
    y: 1.12,
    ...NON_INTERACTIVE,
  },
};

/** The margin that gives INSTRUMENT_LEGEND_LAYOUT's two legend rows (plus Plotly's mode bar)
 * enough room above the plot */
export const INSTRUMENT_LEGEND_MARGIN = { l: 60, r: 24, t: 110, b: 56 };

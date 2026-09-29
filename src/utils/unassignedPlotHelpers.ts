import { Data, Legend } from 'plotly.js-dist-min';
import {
  InstrumentLightcurveData,
  InstrumentLightcurveMeasurements,
  UnassignedFluxMeasurement,
} from '../types';
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

/** Converts a flat list of unassigned flux measurements into the same InstrumentLightcurveData
 * shape Lightcurve.tsx expects for an assigned source's instrument-strategy lightcurve, grouped
 * by (frequency, module) via groupMeasurementsByInstrument - each unassigned measurement is
 * already a fixed (frequency, module) pair, exactly like an instrument-strategy point, just not
 * yet grouped into a record keyed that way. Lets UnassignedLightcurvePlot.tsx render an
 * unassigned source's flux history through the same Lightcurve component/interactions (flagging,
 * marker click, cutouts once those exist for unassigned measurements too) as an assigned source,
 * rather than maintaining a second plot implementation. */
export function toInstrumentLightcurveData(
  sourceId: string,
  measurements: UnassignedFluxMeasurement[]
): InstrumentLightcurveData {
  const lightcurves: Record<string, InstrumentLightcurveMeasurements> = {};

  for (const [key, group] of groupMeasurementsByInstrument(measurements)) {
    lightcurves[key] = {
      frequency: group[0].frequency,
      source_id: sourceId,
      module: group[0].module,
      measurement_id: group.map((m) => m.measurement_id),
      time: group.map((m) => m.time),
      ra: group.map((m) => m.ra),
      ra_uncertainty: group.map((m) => m.ra_uncertainty ?? 0),
      dec: group.map((m) => m.dec),
      dec_uncertainty: group.map((m) => m.dec_uncertainty ?? 0),
      flux: group.map((m) => m.flux),
      flux_err: group.map((m) => m.flux_err),
      extra: group.map((m) => m.extra ?? null),
    };
  }

  return {
    source_id: sourceId,
    // Unassigned measurements aren't fetched through the binned/unbinned endpoints - "none" is
    // the same convention BaseLightcurveData uses for an unbinned assigned-source response.
    binning_strategy: 'none',
    selection_strategy: 'instrument',
    lightcurves,
  };
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

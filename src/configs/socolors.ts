/**
 * Colors and Plotly marker symbols ported from https://github.com/simonsobs/socolors, so plots
 * across the app use consistent, colorblind-friendly, SO-branded styling. socolors itself is a
 * matplotlib style package with no JS distribution, so these values are copied directly from its
 * `frequencies.py`/`lat.py`/`sat.py` modules rather than imported.
 *
 * Linestyles from socolors aren't ported here: lightview's lightcurve traces are markers-only
 * (no connecting lines), so dash patterns don't apply.
 */

/** Fallback color/colorway for anything not covered by the more specific maps below. */
export const SO_FALLBACK_COLOR = '#BBBBBB';
export const SO_BASE_COLORWAY = [
  '#F26522',
  '#0077BB',
  '#009988',
  '#CC3311',
  '#FF4488',
  '#33BBEE',
  '#BBBBBB',
];

export const FREQUENCY_COLORS: Record<string, string> = {
  f030: '#FF4488',
  f040: '#CC3311',
  f090: '#F26522',
  f150: '#009988',
  f220: '#33BBEE',
  f280: '#0077BB',
};

export const FREQUENCY_SYMBOLS: Record<string, string> = {
  f030: 'x',
  f040: 'cross',
  f090: 'circle',
  f150: 'square',
  f220: 'triangle-up',
  f280: 'triangle-down',
};

/** LAT optics-tube colors/symbols (o1-o6, i1-i6, c1). */
export const LAT_COLORS: Record<string, string> = {
  o6: '#DC050C',
  o5: '#4EB265',
  o4: '#90C987',
  o3: '#CAE0AB',
  o2: '#F7F056',
  i1: '#F7CB45',
  i3: '#F4A736',
  i4: '#EE8026',
  i6: '#E65518',
  o1: '#AE76A3',
  i2: '#882E72',
  i5: '#5289C7',
  c1: '#7BAFDE',
};

export const LAT_SYMBOLS: Record<string, string> = {
  o6: 'x',
  o5: 'triangle-right',
  o4: 'triangle-left',
  o3: 'pentagon',
  o2: 'triangle-up',
  i1: 'triangle-down',
  i3: 'square',
  i4: 'circle',
  i6: 'diamond',
  o1: 'y-up',
  i2: 'y-right',
  i5: 'y-down',
  c1: 'y-left',
};

/** SAT platform colors/symbols (satp1-satp3). */
export const SAT_COLORS: Record<string, string> = {
  satp1: '#33BBEE',
  satp2: '#009988',
  satp3: '#EE3377',
};

export const SAT_SYMBOLS: Record<string, string> = {
  satp1: 'circle',
  satp2: 'diamond',
  satp3: 'triangle-up',
};

/** Turns a raw frequency (e.g. 90) into socolors' zero-padded key (e.g. "f090"). */
export function frequencyKey(frequency: number): string {
  return `f${frequency.toString().padStart(3, '0')}`;
}

export function frequencyColor(frequency: number): string {
  return FREQUENCY_COLORS[frequencyKey(frequency)] ?? SO_FALLBACK_COLOR;
}

export function frequencySymbol(frequency: number): string {
  return FREQUENCY_SYMBOLS[frequencyKey(frequency)] ?? 'circle';
}

/** SAT module ids are prefixed "satp"; everything else is a LAT optics-tube id. */
function isSatModule(module: string): boolean {
  return module.startsWith('satp');
}

export function moduleColor(module: string): string {
  const colors = isSatModule(module) ? SAT_COLORS : LAT_COLORS;
  return colors[module] ?? SO_FALLBACK_COLOR;
}

export function moduleSymbol(module: string): string {
  const symbols = isSatModule(module) ? SAT_SYMBOLS : LAT_SYMBOLS;
  return symbols[module] ?? 'circle';
}

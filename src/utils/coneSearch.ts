export type ConeSearch = { ra: number; dec: number; radiusDeg: number };

export type ConeSearchParseResult =
  | { ok: true; cone: ConeSearch }
  | { ok: false; message: string };

/** Parses one field as a finite number in [min, max] (or (min, max] when minExclusive). */
function parseField(
  raw: string,
  label: string,
  min: number,
  max: number,
  minExclusive = false
): number | string {
  const text = raw.trim();
  const value = Number(text);
  if (text === '' || !Number.isFinite(value)) {
    return `${label} must be a number in degrees.`;
  }
  if ((minExclusive ? value <= min : value < min) || value > max) {
    return minExclusive
      ? `${label} must be greater than ${min}° and at most ${max}°.`
      : `${label} must be between ${min}° and ${max}°.`;
  }
  return value;
}

/** Validates the navigation bar's cone-search fields (all in degrees). RA accepts both the
 * 0 -> 360 convention and the -180 -> 180 one the source catalog uses. */
export function parseConeSearch(
  ra: string,
  dec: string,
  radius: string
): ConeSearchParseResult {
  const parsed = [
    parseField(ra, 'RA', -180, 360),
    parseField(dec, 'Dec', -90, 90),
    parseField(radius, 'Radius', 0, 180, true),
  ];
  const errors = parsed.filter((p): p is string => typeof p === 'string');
  if (errors.length) return { ok: false, message: errors.join(' ') };
  const [raDeg, decDeg, radiusDeg] = parsed as number[];
  return { ok: true, cone: { ra: raDeg, dec: decDeg, radiusDeg } };
}

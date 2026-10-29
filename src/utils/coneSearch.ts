import { angularSeparationDeg } from './angularSeparation';

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

/** The search results page's URL for a cone search, which lists the matching sources from the
 * API and so works even when the sky map can't load. */
export function coneSearchResultsPath(cone: ConeSearch): string {
  return (
    '/search/cone?' +
    new URLSearchParams({
      ra: String(cone.ra),
      dec: String(cone.dec),
      radius: String(cone.radiusDeg),
    }).toString()
  );
}

/** Whether a position lies within a cone (inclusive of its edge). */
export function isWithinCone(
  point: { ra: number; dec: number },
  cone: ConeSearch
): boolean {
  return (
    angularSeparationDeg(point.ra, point.dec, cone.ra, cone.dec) <=
    cone.radiusDeg
  );
}

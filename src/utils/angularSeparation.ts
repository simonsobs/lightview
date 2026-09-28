/** Great-circle angular separation between two ra/dec points, in degrees - the same convention
 * SIMBAD's /cone service returns as its distance_deg column (see SimbadConeMatchRow in
 * src/types/index.ts), so this is a client-side equivalent for comparing two of our own sources
 * rather than a SIMBAD match. Uses the haversine formula, which is numerically stable and
 * standard at the sub-degree-to-few-degree scales these cone searches operate at (matching
 * astropy's SkyCoord.separation for this use case). Callers convert to arcmin themselves (`* 60`)
 * the same way UnassignedSource.tsx does for SIMBAD's own distance_deg. */
export function angularSeparationDeg(
  ra1Deg: number,
  dec1Deg: number,
  ra2Deg: number,
  dec2Deg: number
): number {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;

  const dec1 = dec1Deg * toRad;
  const dec2 = dec2Deg * toRad;
  const dDec = dec2 - dec1;
  const dRa = (ra2Deg - ra1Deg) * toRad;

  const a =
    Math.sin(dDec / 2) ** 2 +
    Math.cos(dec1) * Math.cos(dec2) * Math.sin(dRa / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return c * toDeg;
}

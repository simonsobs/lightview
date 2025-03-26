import { LightcurveBand } from '../types';

/**
 * Returns the middle index of an array given its length. If the array length is even,
 * returns the index before the middle. If calculating the median, we'd then use this index
 * and the next index in our calculation
 * @param arrayLength The length of an array
 * @returns A number representing the middle index of an array
 */
export function getMiddleIndex(arrayLength: number) {
  // When array length is odd, we want the floored value of the halved length
  if (arrayLength % 2 !== 0) {
    return Math.floor(arrayLength / 2);
  } else {
    // We don't have a genuine middle index, so return one less than the halved length
    return arrayLength / 2 - 1;
  }
}

/**
 * Returns the middle band only if the length is odd; otherwise, returns the band whose
 * index is one less than half the length of the array
 */
export function findMidBand(bands: LightcurveBand[]) {
  const bandsLength = bands.length;
  // Return first and only band if length is 1
  if (bandsLength === 1) {
    return bands[0];
  }
  return bands[getMiddleIndex(bandsLength)];
}

/**
 * Calculates and returns the median flux of a lightcurve band
 * @todo Make generic such that we can calculate median of i, q, or u flux
 * @param band A given LightcurveBand
 * @returns The median flux
 */
export function getMedianFlux(band: LightcurveBand) {
  // Copy and sort the band so we don't accidentally mutate the band upstream
  const sortedFlux = [...band.i_flux].sort((a, b) => a - b);
  const bandLength = sortedFlux.length;
  if (bandLength === 1) {
    return band.i_flux[0];
  } else if (bandLength % 2 !== 0) {
    // Odd lengths are simple: just return the value at the determined middle index
    return sortedFlux[getMiddleIndex(bandLength)];
  } else {
    // When even, use the index returned from getMiddleIndex and the next index to
    // calculate the average of the two middle values
    const index1 = getMiddleIndex(bandLength);
    const index2 = index1 + 1;
    return (sortedFlux[index1] + sortedFlux[index2]) / 2;
  }
}

/**
 * Returns the maximum i_flux from a given LightcurveBand
 * @todo Make this generic such that we can return i, q, or u flux
 * @param band A given LightcurveBand
 * @returns The max i_flux of a band
 */
export function getMaxFlux(band: LightcurveBand) {
  return Math.max(...band.i_flux);
}

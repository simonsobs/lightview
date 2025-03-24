import { LightcurveBand } from '../types';

function getMiddleIndex(arrayLength: number) {
  if (arrayLength % 2 !== 0) {
    return Math.floor(arrayLength / 2);
  } else {
    return arrayLength / 2 - 1;
  }
}

export function findMidBand(bands: LightcurveBand[]) {
  const bandsLength = bands.length;
  if (bandsLength === 1) {
    return bands[0];
  }
  return bands[getMiddleIndex(bandsLength)];
}

export function getMedianFlux(band: LightcurveBand) {
  const sortedFlux = [...band.i_flux].sort((a, b) => a - b);
  const bandLength = sortedFlux.length;
  if (bandLength === 1) {
    return band.i_flux[0];
  } else if (bandLength % 2 !== 0) {
    return sortedFlux[getMiddleIndex(bandLength)];
  } else {
    const index1 = getMiddleIndex(bandLength);
    const index2 = index1 + 1;
    return (sortedFlux[index1] + sortedFlux[index2]) / 2;
  }
}

export function getMaxFlux(band: LightcurveBand) {
  return Math.max(...band.i_flux);
}

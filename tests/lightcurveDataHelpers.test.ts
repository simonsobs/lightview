import { LightcurveBand } from '../src/types';
import {
  getMiddleIndex,
  findMidBand,
  getMedianFlux,
} from '../src/utils/lightcurveDataHelpers';
import { describe, expect, test } from 'vitest';

// NOTE: we're not testing getMaxFlux since it just wraps the JS Math class's built-in max method

function generateMockBands(numBands: number, fluxArrayLength?: number) {
  const bands: LightcurveBand[] = [];
  for (let i = 0; i < numBands; i++) {
    bands.push(generateMockBand(i, fluxArrayLength));
  }
  return bands;
}

function generateMockBand(bandNumber: number, fluxArrayLength?: number) {
  const band: LightcurveBand = {
    band: {
      name: 'band-' + (bandNumber + 1),
      telescope: '',
      instrument: '',
      frequency: 1,
    },
    id: [],
    time: [],
    i_flux: fluxArrayLength ? generateFluxArray(fluxArrayLength) : [],
    i_uncertainty: [],
    q_flux: [],
    q_uncertainty: [],
    u_flux: [],
    u_uncertainty: [],
  };
  return band;
}

/**
 * Returns some hardcoded flux arrays for testing purposes. They're hardcoded such that
 * they're predictable and easy to validate the actual medians.
 * @param fluxArrayLength
 * @returns A hardcoded flux array
 */
function generateFluxArray(fluxArrayLength: number) {
  if (fluxArrayLength === 1) {
    // return a hardcoded a flux array of length 1
    return [5]; // median is 5
  } else if (fluxArrayLength % 2 === 0) {
    return [6, 3, 2, 7, 7, 5, 3, 1, 10, 1]; // median is (3 + 5) / 2 = 4
  } else {
    return [6, 3, 2, 7, 7, 5, 3, 1, 10]; // median is 5
  }
}

describe('test getMiddleIndex', () => {
  test('middle index of an array of length 1 is 0', () => {
    expect(getMiddleIndex(1)).toBe(0);
  });
  test('middle index of an array of length 2 is 0', () => {
    expect(getMiddleIndex(2)).toBe(0);
  });
  test('middle index of an array of length 3 is 1', () => {
    expect(getMiddleIndex(3)).toBe(1);
  });
  test('middle index of an array of length 4 is 1', () => {
    expect(getMiddleIndex(4)).toBe(1);
  });
  test('middle index of an array of length 15 is 7', () => {
    expect(getMiddleIndex(15)).toBe(7);
  });
  test('middle index of an array of length 10 is ', () => {
    expect(getMiddleIndex(10)).toBe(4);
  });
});

describe('test findMidBand', () => {
  test('find middle band of 1 band', () => {
    const bands = generateMockBands(1);
    expect(findMidBand(bands).band.name).toBe('band-1');
  });
  test('find middle band of 2 bands', () => {
    const bands = generateMockBands(2);
    expect(findMidBand(bands).band.name).toBe('band-1');
  });
  test('find middle band of 5 bands', () => {
    const bands = generateMockBands(5);
    expect(findMidBand(bands).band.name).toBe('band-3');
  });
  test('find middle band of 6 bands', () => {
    const bands = generateMockBands(6);
    expect(findMidBand(bands).band.name).toBe('band-3');
  });
});

describe('test getMedianFlux', () => {
  test('find median flux with flux array of length 1', () => {
    const band = generateMockBand(1, 1);
    expect(getMedianFlux(band)).toBe(5);
  });
  test('find median flux with flux array of even length', () => {
    const band = generateMockBand(1, 10);
    expect(getMedianFlux(band)).toBe(4);
  });
  test('find median flux with flux array of odd length', () => {
    const band = generateMockBand(1, 9);
    expect(getMedianFlux(band)).toBe(5);
  });
});

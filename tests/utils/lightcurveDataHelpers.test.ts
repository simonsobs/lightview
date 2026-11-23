import { describe, it, expect } from 'vitest';

import {
  generateBaseMarkerConfig,
  toMJD,
} from '../../src/utils/lightcurveDataHelpers';
import { BaseScatterData } from '../../src/components/Lightcurve';

function makeData(flags: number[]) {
  return { flags } as unknown as BaseScatterData;
}

describe('generateBaseMarkerConfig', () => {
  it('returns empty marker line arrays for empty data', () => {
    const result = generateBaseMarkerConfig(makeData([]));

    expect(result.marker.line.color).toEqual([]);
    expect(result.marker.line.width).toEqual([]);
  });

  it('applies default marker styling to unflagged points', () => {
    const result = generateBaseMarkerConfig(makeData([0, 0, 0]));

    expect(result.marker.size).toBe(5);
    expect(result.marker.line.color).toEqual(['#000', '#000', '#000']);
    expect(result.marker.line.width).toEqual([0, 0, 0]);
  });

  it('highlights flagged points in red with a thicker line', () => {
    const result = generateBaseMarkerConfig(makeData([0, 1, 0, 1]));

    expect(result.marker.line.color).toEqual(['#000', 'red', '#000', 'red']);
    expect(result.marker.line.width).toEqual([0, 1.5, 0, 1.5]);
  });

  it('respects custom marker size, line color, and line width', () => {
    const result = generateBaseMarkerConfig(makeData([0, 1]), 10, '#fff', 2);

    expect(result.marker.size).toBe(10);
    expect(result.marker.line.color).toEqual(['#fff', 'red']);
    expect(result.marker.line.width).toEqual([2, 1.5]);
  });
});

describe('toMJD', () => {
  it('maps the Unix epoch to MJD 40587', () => {
    expect(toMJD('1970-01-01T00:00:00Z')).toBe(40587);
  });

  it('maps J2000 (noon on 2000-01-01) to MJD 51544.5', () => {
    expect(toMJD('2000-01-01T12:00:00Z')).toBe(51544.5);
  });

  it('keeps sub-day precision', () => {
    expect(toMJD('2025-06-01T06:00:00Z')).toBeCloseTo(60827.25, 10);
  });

  it('respects the timezone offset in the date string', () => {
    expect(toMJD('2000-01-01T07:00:00-05:00')).toBe(
      toMJD('2000-01-01T12:00:00Z')
    );
  });
});

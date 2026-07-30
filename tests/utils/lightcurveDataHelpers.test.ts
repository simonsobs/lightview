import { describe, it, expect } from 'vitest';

import { generateBaseMarkerConfig } from '../../src/utils/lightcurveDataHelpers';
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

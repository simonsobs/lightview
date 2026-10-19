import { describe, it, expect } from 'vitest';
import { parseConeSearch } from '../../src/utils/coneSearch';

describe('parseConeSearch', () => {
  it('parses valid fields, trimming whitespace', () => {
    expect(parseConeSearch(' 83.633 ', '22.014', '0.5')).toEqual({
      ok: true,
      cone: { ra: 83.633, dec: 22.014, radiusDeg: 0.5 },
    });
  });

  it('accepts RA in both the 0 -> 360 and -180 -> 180 conventions', () => {
    expect(parseConeSearch('350', '0', '1').ok).toBe(true);
    expect(parseConeSearch('-10', '0', '1').ok).toBe(true);
    expect(parseConeSearch('-181', '0', '1').ok).toBe(false);
    expect(parseConeSearch('361', '0', '1').ok).toBe(false);
  });

  it('rejects non-numeric and out-of-range values with a message per field', () => {
    const result = parseConeSearch('abc', '91', '0');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain('RA must be a number');
    expect(result.message).toContain('Dec must be between -90° and 90°');
    expect(result.message).toContain('Radius must be greater than 0°');
  });

  it('rejects empty fields', () => {
    expect(parseConeSearch('', '0', '1').ok).toBe(false);
  });
});

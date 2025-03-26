import { expect, afterEach, vi, beforeAll } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

global.URL.createObjectURL = vi.fn();

beforeAll(() => {
  // @ts-expect-error Overrides the canvas's getContext method so we can
  // suppress errors related to plotly and jsdom
  HTMLCanvasElement.prototype.getContext = () => {
    return {} as CanvasRenderingContext2D;
  };
});

afterEach(() => {
  cleanup();
});

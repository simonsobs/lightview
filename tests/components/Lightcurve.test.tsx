import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Data, Layout } from 'plotly.js-dist-min';

import { Lightcurve } from '../../src/components/Lightcurve';
import { InstrumentLightcurveData } from '../../src/types';

// Plotly can't render in jsdom, so record what Lightcurve asks it to draw instead. The plot
// element needs an `on` method since Lightcurve attaches its listeners after the first react call.
const { mockReact } = vi.hoisted(() => ({
  mockReact: vi.fn<
    (
      el: HTMLElement & { on?: () => void },
      data: Data[],
      layout: Partial<Layout>
    ) => Promise<HTMLElement>
  >((el) => {
    el.on = vi.fn();
    return Promise.resolve(el);
  }),
}));

vi.mock('plotly.js-dist-min', () => ({
  default: { react: mockReact, purge: vi.fn(), restyle: vi.fn() },
}));

const TIMES = ['2000-01-01T12:00:00Z', '2025-06-01T06:00:00Z'];

const lightcurveData: InstrumentLightcurveData = {
  source_id: 'src-1',
  binning_strategy: 'none',
  selection_strategy: 'instrument',
  lightcurves: {
    i1_f150: {
      frequency: 150,
      module: 'i1',
      source_id: 'src-1',
      measurement_id: ['m1', 'm2'],
      time: TIMES,
      ra: [0, 0],
      ra_uncertainty: [0, 0],
      dec: [0, 0],
      dec_uncertainty: [0, 0],
      flux: [1, 2],
      flux_err: [0.1, 0.2],
      extra: [null, null],
    },
  },
};

/** The most recent Plotly.react call's measurement trace (skipping the legend's null-point
 * proxy traces) and layout */
function lastPlot() {
  const [, data, layout] = mockReact.mock.lastCall!;
  const trace = data.find(
    (t) => 'x' in t && Array.isArray(t.x) && t.x[0] != null
  ) as { x: unknown[]; hovertemplate: string };
  return { trace, layout };
}

function renderLightcurve(
  props: Partial<Parameters<typeof Lightcurve>[0]> = {}
) {
  return render(
    <Lightcurve
      lightcurveData={lightcurveData}
      hideStrategyToggle
      hideFlaggedObsToggle
      {...props}
    />
  );
}

describe('Lightcurve x-axis mode', () => {
  beforeEach(() => {
    mockReact.mockClear();
  });

  it('plots dates on a date axis by default', async () => {
    renderLightcurve();
    await waitFor(() => expect(mockReact).toHaveBeenCalled());

    const { trace, layout } = lastPlot();
    expect(trace.x).toEqual(TIMES.map((t) => new Date(t)));
    expect(trace.hovertemplate).not.toContain('MJD');
    expect(layout.xaxis?.type).toBe('date');
    expect(layout.xaxis?.title).toEqual({ text: 'Time (Date)' });
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('switches to MJD values on a linear axis when toggled', async () => {
    const user = userEvent.setup();
    renderLightcurve();
    await waitFor(() => expect(mockReact).toHaveBeenCalled());

    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(lastPlot().layout.xaxis?.type).toBe('linear'));

    const { trace, layout } = lastPlot();
    expect(trace.x).toEqual([51544.5, 60827.25]);
    expect(trace.hovertemplate).toContain('MJD %{x:.5f}');
    expect(layout.xaxis?.title).toEqual({ text: 'Time (MJD)' });
    expect(layout.xaxis?.exponentformat).toBe('none');
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('switches back to dates when toggled again', async () => {
    const user = userEvent.setup();
    renderLightcurve();
    await waitFor(() => expect(mockReact).toHaveBeenCalled());

    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(lastPlot().layout.xaxis?.type).toBe('linear'));
    await user.click(screen.getByRole('checkbox'));
    await waitFor(() => expect(lastPlot().layout.xaxis?.type).toBe('date'));

    expect(lastPlot().trace.x).toEqual(TIMES.map((t) => new Date(t)));
  });
});

describe('Lightcurve container layout classes', () => {
  it('adds has-strategy-toggle only when the strategy toggle is shown', () => {
    const { container, unmount } = renderLightcurve({
      hideStrategyToggle: false,
    });
    expect(container.firstElementChild).toHaveClass('has-strategy-toggle');
    unmount();

    const { container: hidden } = renderLightcurve();
    expect(hidden.firstElementChild).not.toHaveClass('has-strategy-toggle');
  });

  it('adds has-title only when a title or subtitle is given', () => {
    const { container, unmount } = renderLightcurve({ subtitle: 'Sub' });
    expect(container.firstElementChild).toHaveClass('has-title');
    unmount();

    const { container: untitled } = renderLightcurve();
    expect(untitled.firstElementChild).not.toHaveClass('has-title');
  });
});

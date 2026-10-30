import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useSurveyStatus } from '../../src/hooks/useSurveyStatus';

const SURVEY_URL = 'https://alasky.cds.unistra.fr/DSS/DSS2Merged';

function setup(url: string | undefined = SURVEY_URL) {
  const container = document.createElement('div');
  const containerRef = { current: container };
  const aladin = {
    getBaseImageLayer: vi.fn<() => { url?: string; startUrl?: string }>(() => ({
      url,
    })),
  };
  const aladinRef = { current: aladin as unknown as Aladin };
  const hook = renderHook(
    ({ viewerGeneration }) =>
      useSurveyStatus(containerRef, aladinRef, viewerGeneration),
    { initialProps: { viewerGeneration: 1 } }
  );
  return { container, aladin, hook };
}

function dispatchTask(name: 'AL:fetch' | 'AL:Resource.fetched', id: string) {
  document.dispatchEvent(
    new CustomEvent(name, { detail: { task: { id, message: 'x loading...' } } })
  );
}

describe('useSurveyStatus', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('stays ok when the survey server answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { hook } = setup();

    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        `${SURVEY_URL}/properties`,
        expect.anything()
      )
    );
    expect(hook.result.current).toEqual({ kind: 'ok' });
  });

  it('reports the host as unavailable when the probe fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    const { hook } = setup();

    await waitFor(() =>
      expect(hook.result.current).toEqual({
        kind: 'unavailable',
        host: 'alasky.cds.unistra.fr',
      })
    );
  });

  it('skips surveys that have no URL yet, then probes once one is added', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const { container, aladin } = setup('P/2MASS/color');
    expect(fetchMock).not.toHaveBeenCalled();

    aladin.getBaseImageLayer.mockReturnValue({ url: SURVEY_URL });
    container.dispatchEvent(new CustomEvent('AL:Layer.added'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
  });

  it('probes the startUrl of a survey that is still being queried', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('fail'));
    vi.stubGlobal('fetch', fetchMock);
    const { hook, aladin } = setup('P/2MASS/color');
    aladin.getBaseImageLayer.mockReturnValue({
      url: 'P/2MASS/color',
      startUrl: 'https://alaskybis.cds.unistra.fr/2MASS/Color',
    });
    hook.rerender({ viewerGeneration: 2 });

    await waitFor(() =>
      expect(hook.result.current).toEqual({
        kind: 'unavailable',
        host: 'alaskybis.cds.unistra.fr',
      })
    );
  });

  it('counts a task dispatched before the viewer exists', () => {
    vi.useFakeTimers();
    const container = document.createElement('div');
    const hook = renderHook(() =>
      useSurveyStatus({ current: container }, { current: null }, 0)
    );

    act(() => dispatchTask('AL:fetch', 'task-1'));
    act(() => {
      vi.advanceTimersByTime(10_000);
    });
    expect(hook.result.current).toEqual({ kind: 'slow' });
  });

  it('reports slow loading tasks until they finish', () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise(() => {}))
    );
    // The probe never settles, so only the slow task affects the status
    const { hook } = setup();

    act(() => dispatchTask('AL:fetch', 'task-1'));
    act(() => {
      vi.advanceTimersByTime(9_000);
    });
    expect(hook.result.current).toEqual({ kind: 'ok' });

    act(() => {
      vi.advanceTimersByTime(1_000);
    });
    expect(hook.result.current).toEqual({ kind: 'slow' });

    act(() => dispatchTask('AL:Resource.fetched', 'task-1'));
    expect(hook.result.current).toEqual({ kind: 'ok' });
  });
});

import { afterEach, describe, expect, it, vi } from 'vitest';
import { chooseSurveyUrl } from '../../src/utils/initAladin';

/** chooseSurveyUrl remembers its choice per survey, so each test uses its own URLs */
function survey(id: string) {
  return {
    name: id,
    urls: [`https://cds.test/${id}`, `https://mirror.test/${id}`],
  };
}

describe('chooseSurveyUrl', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the first URL when its server answers', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const up = survey('up');

    await expect(chooseSurveyUrl(up)).resolves.toBe(up.urls[0]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(`${up.urls[0]}/properties`);
  });

  it('moves on when the first server is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValueOnce(new TypeError('fail'))
        .mockResolvedValueOnce({ ok: true })
    );
    const unreachable = survey('unreachable');
    await expect(chooseSurveyUrl(unreachable)).resolves.toBe(
      unreachable.urls[1]
    );
  });

  it('moves on when the first server returns an error', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: false })
        .mockResolvedValueOnce({ ok: true })
    );
    const erroring = survey('erroring');
    await expect(chooseSurveyUrl(erroring)).resolves.toBe(erroring.urls[1]);
  });

  it('falls back to the first URL when no server answers', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('fail')));
    const down = survey('down');
    await expect(chooseSurveyUrl(down)).resolves.toBe(down.urls[0]);
  });

  it('only probes once per survey', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const once = survey('once');

    await chooseSurveyUrl(once);
    await chooseSurveyUrl(once);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

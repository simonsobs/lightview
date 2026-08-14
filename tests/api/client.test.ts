import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';

import { LightcurveApiClient } from '../../src/api/client';

const BASE_URL = 'http://test.api';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    json: () => Promise.resolve(data),
  } as unknown as Response;
}

function blobResponse(ok = true, status = 200) {
  return {
    ok,
    status,
    blob: () => Promise.resolve(new Blob(['data'])),
  } as unknown as Response;
}

describe('LightcurveApiClient', () => {
  let client: LightcurveApiClient;
  let fetchMock: Mock<typeof fetch>;
  let revokeObjectURLMock: Mock<(url: string) => void>;

  beforeEach(() => {
    client = new LightcurveApiClient(BASE_URL);
    fetchMock = vi.fn<typeof fetch>();
    global.fetch = fetchMock;
    URL.createObjectURL = vi
      .fn<() => string>()
      .mockReturnValue('blob:mock-url');
    revokeObjectURLMock = vi.fn<(url: string) => void>();
    URL.revokeObjectURL = revokeObjectURLMock;
    // jsdom attempts real navigation on anchor clicks, which logs noisy
    // "Not implemented" errors; downloads aren't real navigation anyway.
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET endpoints', () => {
    it('fetches sources from /sources/', async () => {
      const sources = [{ source_id: '1' }];
      fetchMock.mockResolvedValueOnce(jsonResponse(sources));

      const result = await client.getSources();

      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/sources/`);
      expect(result).toEqual(sources);
    });

    it('fetches a single source by id', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ source_id: '42' }));

      await client.getSourceData('42');

      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/sources/42`);
    });

    it('fetches a source summary', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      await client.getSourceSummary('42');

      expect(fetchMock).toHaveBeenCalledWith(`${BASE_URL}/sources/42/summary`);
    });

    it('fetches nearby sources via a cone search query string', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse([]));

      await client.getNearbySources('?ra=1&dec=2&radius=0.5');

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/sources/cone?ra=1&dec=2&radius=0.5`
      );
    });

    it('fetches the sources feed with a start offset', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ items: [] }));

      await client.getSourcesFeed(10);

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/sources/feed?start=10`
      );
    });

    it('fetches lightcurve data with a selection strategy', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({}));

      await client.getLightcurveData('42', 'frequency');

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/lightcurves/42/unbinned?selection_strategy=frequency`
      );
    });

    it('throws when a GET request fails', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(null, false, 500));

      await expect(client.getSourceData('42')).rejects.toThrow(
        'GET /sources/42 failed: 500'
      );
    });
  });

  describe('downloadCutout', () => {
    it('fetches the cutout and triggers a download with the expected filename', async () => {
      fetchMock.mockResolvedValueOnce(blobResponse());
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');

      await client.downloadCutout('src-1', 'meas-1', 'png');

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/cutouts/flux/src-1/meas-1?ext=png`
      );

      const anchor = appendChildSpy.mock.calls
        .map(([node]) => node)
        .find(
          (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement
        );

      expect(anchor?.download).toBe('cutout-src-1-meas-1.png');
      expect(anchor?.href).toBe('blob:mock-url');
    });

    it('throws when the cutout fetch fails', async () => {
      fetchMock.mockResolvedValueOnce(blobResponse(false, 404));

      await expect(
        client.downloadCutout('src-1', 'meas-1', 'png')
      ).rejects.toThrow('Failed to get cutout: 404');
    });

    it('does not revoke the cutout blob url, since getCutoutUrl caches it for reuse elsewhere (e.g. an open tooltip)', async () => {
      fetchMock.mockResolvedValueOnce(blobResponse());

      await client.downloadCutout('src-1', 'meas-1', 'png');

      expect(revokeObjectURLMock).not.toHaveBeenCalled();
    });

    it('reuses an already-fetched cutout url instead of fetching again', async () => {
      fetchMock.mockResolvedValueOnce(blobResponse());

      await client.getCutoutUrl('src-1', 'meas-1', 'png');
      await client.downloadCutout('src-1', 'meas-1', 'png');

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('downloadTableData', () => {
    it('fetches table data and triggers a download without a measurement id', async () => {
      fetchMock.mockResolvedValueOnce(blobResponse());
      const appendChildSpy = vi.spyOn(document.body, 'appendChild');

      await client.downloadTableData('src-1', 'csv');

      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/lightcurves/src-1/all/download?format=csv`
      );

      const anchor = appendChildSpy.mock.calls
        .map(([node]) => node)
        .find(
          (node): node is HTMLAnchorElement => node instanceof HTMLAnchorElement
        );

      expect(anchor?.download).toBe('source-data-src-1.csv');
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });
  });

  describe('caching', () => {
    it('caches GET results by key, fetching only once for repeated calls', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse({ source_id: '42' }));

      const first = await client.getSourceData('42');
      const second = await client.getSourceData('42');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second).toEqual(first);
    });

    it('fetches separately for different keys', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ source_id: '1' }))
        .mockResolvedValueOnce(jsonResponse({ source_id: '2' }));

      await client.getSourceData('1');
      await client.getSourceData('2');

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('dedupes concurrent in-flight requests for the same key', async () => {
      let resolveFetch: (res: Response) => void = () => {};
      fetchMock.mockReturnValueOnce(
        new Promise<Response>((resolve) => {
          resolveFetch = resolve;
        })
      );

      const first = client.getSourceData('42');
      const second = client.getSourceData('42');
      resolveFetch(jsonResponse({ source_id: '42' }));

      await expect(first).resolves.toEqual({ source_id: '42' });
      await expect(second).resolves.toEqual({ source_id: '42' });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('evicts a failed request so it can be retried', async () => {
      fetchMock.mockResolvedValueOnce(jsonResponse(null, false, 500));
      await expect(client.getSourceData('42')).rejects.toThrow();

      fetchMock.mockResolvedValueOnce(jsonResponse({ source_id: '42' }));
      const result = await client.getSourceData('42');

      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(result).toEqual({ source_id: '42' });
    });

    it('does not cache the sources feed, since it reflects a live/growing list', async () => {
      fetchMock
        .mockResolvedValueOnce(jsonResponse({ items: [] }))
        .mockResolvedValueOnce(jsonResponse({ items: [] }));

      await client.getSourcesFeed(10);
      await client.getSourcesFeed(10);

      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it('caches cutout urls, reusing the same blob url for repeated requests', async () => {
      fetchMock.mockResolvedValueOnce(blobResponse());

      const first = await client.getCutoutUrl('src-1', 'meas-1', 'png');
      const second = await client.getCutoutUrl('src-1', 'meas-1', 'png');

      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(second).toBe(first);
    });
  });
});

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import { LightcurveApiClient } from '../../src/api/client';

const BASE_URL = 'http://test.api';

function jsonResponse(data: unknown, ok = true, status = 200) {
  return { ok, status, json: () => Promise.resolve(data) };
}

function blobResponse(ok = true, status = 200) {
  return { ok, status, blob: () => Promise.resolve(new Blob(['data'])) };
}

describe('LightcurveApiClient', () => {
  let client: LightcurveApiClient;
  let fetchMock: ReturnType<typeof vi.fn>;
  let revokeObjectURLMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new LightcurveApiClient(BASE_URL);
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    URL.createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
    revokeObjectURLMock = vi.fn();
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
      expect(revokeObjectURLMock).toHaveBeenCalledWith('blob:mock-url');
    });

    it('throws when the cutout fetch fails', async () => {
      fetchMock.mockResolvedValueOnce(blobResponse(false, 404));

      await expect(
        client.downloadCutout('src-1', 'meas-1', 'png')
      ).rejects.toThrow('Failed to get cutout: 404');
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
    });
  });
});

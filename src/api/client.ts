import {
  CutoutFileExtensions,
  DataFileExtensions,
  FrequencyLightcurveData,
  InstrumentLightcurveData,
  SelectionStrategy,
  SourceResponse,
  SourcesFeedResponse,
  SourceSummary,
} from '../types';

export class LightcurveApiClient {
  private baseUrl: string;
  private fluxUrlStub: string;
  // Session-lifetime cache for GET requests whose response can't change for a given key (a
  // source's data, its lightcurve, a cutout image, ...). Keyed by request-specific strings built
  // by each caller. Caches the in-flight promise rather than its resolved value so concurrent
  // callers for the same key (e.g. two components requesting the same source) share one request
  // instead of firing duplicates.
  private cache = new Map<string, Promise<unknown>>();

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.fluxUrlStub = baseUrl + `/cutouts/flux/`;
  }

  /** Returns the cached promise for `key`, or runs `fn` and caches its promise. A failed request
   * is evicted so it can be retried, rather than caching a permanent rejection. */
  private cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
    const existing = this.cache.get(key);
    if (existing) {
      return existing as Promise<T>;
    }
    const promise = fn().catch((e: unknown) => {
      this.cache.delete(key);
      throw e;
    });
    this.cache.set(key, promise);
    return promise;
  }

  private makeFileName(
    object: string,
    sourceId: string,
    measurementId: string | null,
    ext: string
  ) {
    let filename = `${object}-${sourceId}`;
    if (measurementId) {
      filename += `-${measurementId}`;
    }
    return filename + `.${ext}`;
  }

  private async getUrl(endpoint: string, object: string) {
    const res = await fetch(endpoint);
    if (!res.ok) {
      throw new Error(`Failed to get ${object}: ` + res.status);
    }
    const blob = await res.blob();
    return URL.createObjectURL(blob);
  }

  private download(url: string, filename: string, revoke = true) {
    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename; // Give it a filename
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Clean up the URL - skipped for cached URLs (see downloadCutout) since those are shared
    // with other consumers (e.g. an open tooltip <img>) and revoking would break them.
    if (revoke) {
      window.URL.revokeObjectURL(url);
    }
  }

  private async get<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) {
      throw new Error(`GET ${path} failed: ${res.status}`);
    }
    return res.json() as T;
  }

  private async getSource<T>(path: string): Promise<T> {
    return await this.get<T>(`/sources${path}`);
  }

  async getSources() {
    return await this.cached('sources', () =>
      this.getSource<SourceResponse[]>(`/`)
    );
  }

  async getSourceData(id: string) {
    return await this.cached(`source:${id}`, () =>
      this.getSource<SourceResponse>(`/${id}`)
    );
  }

  async getSourceSummary(id: string) {
    return await this.cached(`source-summary:${id}`, () =>
      this.getSource<SourceSummary>(`/${id}/summary`)
    );
  }

  async getNearbySources(q: string) {
    return await this.cached(`nearby-sources:${q}`, () =>
      this.getSource<SourceResponse[]>(`/cone${q}`)
    );
  }

  async getSourcesFeed(start: number) {
    // Not cached: reflects the live/growing source list, so each page should be re-fetched.
    return await this.getSource<SourcesFeedResponse>(`/feed?start=${start}`);
  }

  async getLightcurveData(id: string, selectionStrategy: SelectionStrategy) {
    return await this.cached(`lightcurve:${id}:${selectionStrategy}`, () =>
      this.get<FrequencyLightcurveData | InstrumentLightcurveData>(
        `/lightcurves/${id}/unbinned?selection_strategy=${selectionStrategy}`
      )
    );
  }

  async getCutoutUrl(sourceId: string, measurementId: string, ext: string) {
    // Cached by key so re-clicking (or downloading) the same marker reuses the existing blob URL
    // instead of creating a new one every time
    return await this.cached(
      `cutout:${sourceId}:${measurementId}:${ext}`,
      () => {
        const endpoint =
          this.fluxUrlStub + `${sourceId}/${measurementId}?ext=${ext}`;
        return this.getUrl(endpoint, 'cutout');
      }
    );
  }

  async downloadCutout(
    sourceId: string,
    measurementId: string,
    ext: CutoutFileExtensions
  ) {
    const url = await this.getCutoutUrl(sourceId, measurementId, ext);
    const filename = this.makeFileName('cutout', sourceId, measurementId, ext);
    // getCutoutUrl's blob URL is cached and may still be in use elsewhere (e.g. an open tooltip
    // <img>), so don't revoke it here.
    this.download(url, filename, false);
  }

  async downloadTableData(sourceId: string, ext: DataFileExtensions) {
    const endpoint = `${this.baseUrl}/lightcurves/${sourceId}/all/download?format=${ext}`;
    const url = await this.getUrl(endpoint, 'source-data');
    const filename = this.makeFileName('source-data', sourceId, null, ext);
    this.download(url, filename);
  }
}

export const lightcurveApi = new LightcurveApiClient(
  import.meta.env.VITE_SERVICE_URL as string
);

import {
  BinningStrategy,
  CandidateDecisionCommand,
  CandidateMerge,
  CandidateMergeCommand,
  CandidateReviewDecision,
  CutoutFileExtensions,
  DataFileExtensions,
  FrequencyLightcurveData,
  InstrumentLightcurveData,
  SelectionStrategy,
  SourceResponse,
  SourcesFeedResponse,
  SourceSummary,
  UnassignedFluxMeasurement,
  UnassignedSourceData,
  UnassignedSourceResponse,
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

  /** Review-decision endpoints require an authenticated (lcs:review) session, so this sends
   * cookies cross-origin and surfaces the server's `detail` message instead of just a status
   * code, since that's the only place a reviewer can see e.g. a version-conflict message. */
  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(await this.extractErrorDetail(res, path));
    }
    return res.json() as T;
  }

  private async extractErrorDetail(
    res: Response,
    path: string
  ): Promise<string> {
    try {
      const body = (await res.json()) as { detail?: unknown };
      if (typeof body.detail === 'string') {
        return body.detail;
      }
      if (Array.isArray(body.detail)) {
        return body.detail
          .map((entry: unknown) =>
            entry && typeof entry === 'object' && 'msg' in entry
              ? String(entry.msg)
              : JSON.stringify(entry)
          )
          .join('; ');
      }
    } catch {
      // response body wasn't JSON (or had no `detail`) - fall through to the generic message
    }
    return `POST ${path} failed: ${res.status}`;
  }

  private async getSource<T>(path: string): Promise<T> {
    return await this.get<T>(`/sources${path}`);
  }

  private async getUnassignedSource<T>(path: string): Promise<T> {
    return await this.get<T>(`/unassigned${path}`);
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

  async getBinnedLightcurveData(
    id: string,
    params: {
      startTime: string;
      endTime: string;
      selectionStrategy: SelectionStrategy;
      binningStrategy: Exclude<BinningStrategy, 'none'>;
    }
  ) {
    const { startTime, endTime, selectionStrategy, binningStrategy } = params;
    const query = new URLSearchParams({
      start_time: startTime,
      end_time: endTime,
      selection_strategy: selectionStrategy,
      binning_strategy: binningStrategy,
    }).toString();
    return await this.cached(`binned-lightcurve:${id}:${query}`, () =>
      this.get<FrequencyLightcurveData | InstrumentLightcurveData>(
        `/lightcurves/${id}/binned?${query}`
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

  async getUnassignedSources() {
    return await this.cached('unassigned_sources', () =>
      this.getUnassignedSource<UnassignedSourceResponse[]>('/')
    );
  }

  async getUnassignedSourcesInRadius(
    ra: number,
    dec: number,
    radius: number = 2,
    status: string | undefined = undefined
  ) {
    return await this.cached(`unassigned_sources_in_radius:${ra},${dec}`, () =>
      this.get<UnassignedSourceResponse[]>(
        `/unassigned/search?ra=${ra}&dec=${dec}&radius_arcmin=${radius}` +
          (status ? `&status=${status}` : '')
      )
    );
  }

  async getUnassignedSourceData(
    id: string,
    radius: number = 2,
    status: string | undefined = undefined
  ): Promise<UnassignedSourceData> {
    const source = await this.cached(`unassigned-source:${id}`, () =>
      this.getUnassignedSource<UnassignedSourceResponse>(`/${id}`)
    );
    const search = await this.cached(
      `unassigned_sources_in_radius:${source.ra},${source.dec}`,
      () =>
        this.get<UnassignedSourceResponse[]>(
          `/unassigned/search?ra=${source.ra}&dec=${source.dec}&radius_arcmin=${radius}` +
            (status ? `&status=${status}` : '')
        )
    );
    return {
      ...source,
      in_radius: search.filter((s) => s.source_id !== id),
    };
  }

  async getUnassignedFluxBySource(sourceId: string) {
    return await this.cached(`unassigned_flux:${sourceId}`, () =>
      this.get<UnassignedFluxMeasurement[]>(`/unassigned/flux/${sourceId}`)
    );
  }

  async mergeUnassignedSource(command: CandidateMergeCommand) {
    const result = await this.post<CandidateMerge>(
      '/unassigned/merge',
      command
    );
    // Both sources' status/version just changed server-side - rather than tracking down every
    // cache key that could now be stale (the source, its in-radius search, the full list, ...),
    // just drop the whole session cache so the next GET for any of them is fresh.
    this.cache.clear();
    return result;
  }

  async decideUnassignedSource(command: CandidateDecisionCommand) {
    const result = await this.post<CandidateReviewDecision>(
      '/unassigned/decision',
      command
    );
    this.cache.clear();
    return result;
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

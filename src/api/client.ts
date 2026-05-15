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

class LightcurveApiClient {
  private baseUrl: string;
  private fluxUrlStub: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.fluxUrlStub = baseUrl + `/cutouts/flux/`;
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

  private download(url: string, filename: string) {
    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = filename; // Give it a filename
    document.body.appendChild(a);
    a.click();
    a.remove();

    // Clean up the URL
    window.URL.revokeObjectURL(url);
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
    return await this.getSource<SourceResponse[]>(`/`);
  }

  async getSourceData(id: string) {
    return await this.getSource<SourceResponse>(`/${id}`);
  }

  async getSourceSummary(id: string) {
    return await this.getSource<SourceSummary>(`/${id}/summary`);
  }

  async getNearbySources(q: string) {
    return await this.getSource<SourceResponse[]>(`/cone${q}`);
  }

  async getSourcesFeed(start: number) {
    return await this.getSource<SourcesFeedResponse>(`/feed?start=${start}`);
  }

  async getLightcurveData(id: string, selectionStrategy: SelectionStrategy) {
    return await this.get<FrequencyLightcurveData | InstrumentLightcurveData>(
      `/lightcurves/${id}/unbinned?selection_strategy=${selectionStrategy}`
    );
  }

  async getCutoutUrl(sourceId: string, measurementId: string, ext: string) {
    const endpoint =
      this.fluxUrlStub + `${sourceId}/${measurementId}?ext=${ext}`;
    return await this.getUrl(endpoint, 'cutout');
  }

  async downloadCutout(
    sourceId: string,
    measurementId: string,
    ext: CutoutFileExtensions
  ) {
    const url = await this.getCutoutUrl(sourceId, measurementId, ext);
    const filename = this.makeFileName('cutout', sourceId, measurementId, ext);
    this.download(url, filename);
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

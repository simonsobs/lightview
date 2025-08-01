export type SourceResponse = {
  id: number;
  ra: number;
  dec: number;
  variable: boolean;
  extra: {
    cross_matches: { name: string }[];
  };
};

export type SourcesFeedItem = {
  source_id: number;
  ra: number;
  dec: number;
  /** time is sent as a Date string */
  time: string[];
  flux: number[];
  nanoplot?: string;
};

export type SourcesFeedResponse = {
  start: number;
  stop: number;
  band_name: string;
  total_number_of_sources: number;
  items: SourcesFeedItem[];
};

type Band = {
  name: string;
  telescope: string;
  instrument: string;
  frequency: number;
};

type Measurement = {
  source_id: number;
  band_name: string;
  start: string;
  end: string;
  count: number;
};

export type SourceSummary = {
  source: SourceResponse;
  bands: Band[];
  measurements: Measurement[];
};

type ExtraDictionary = {
  flags: string[];
} | null;

export type LightcurveBand = {
  band: Band;
  id: number[];
  /** time is sent as a Date string */
  time: string[];
  i_flux: number[];
  i_uncertainty: number[];
  q_flux: number[];
  q_uncertainty: number[];
  u_flux: number[];
  u_uncertainty: number[];
  extra: ExtraDictionary[];
};

export type LightcurveData = {
  source: SourceResponse;
  bands: LightcurveBand[];
};

/** Literal type of possible cutout file extensions */
export type CutoutFileExtensions = 'fits' | 'png' | 'hdf5';

/** Literal type of possible light curve data file extensions */
export type DataFileExtensions = 'csv' | 'hdf5';

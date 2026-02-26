export type SourceResponse = {
  source_id: string;
  socat_id: number;
  name: string;
  ra: number;
  dec: number;
  variable: boolean;
  extra?: {
    cross_matches?: { name: string }[];
    socat_id?: number;
  };
};

export type SourcesFeedItem = {
  source_id: string;
  source_name: string;
  ra: number;
  dec: number;
  /** time is sent as a Date string */
  time: string[];
  flux: number[];
  nanoplot?: string; // added by the client, not in response
};

export type SourcesFeedResponse = {
  start: number;
  stop: number;
  frequency: number;
  total_number_of_sources: number;
  items: SourcesFeedItem[];
};

export type SourceStatistics = {
  source_id: string;
  module: string;
  frequency: number;
  /** times are sent as a Date string */
  start_time: string;
  end_time: string;
  measurement_count: number;
  min_flux: number;
  max_flux: number;
  mean_flux: number;
  stddev_flux: number;
  median_flux: number;
  weighted_mean_flux: number;
  weighted_error_on_mean_flux: number;
};

export type SourceSummary = Record<string, SourceStatistics>;

type ExtraDictionary = {
  flags: string[];
} | null;

type BaseLightcurveMeasurements = {
  frequency: number;
  source_id: string;
  measurement_id: string[];
  /** time is sent as a Date string */
  time: string[];
  ra: number[];
  dec: number[];
  flux: number[];
  flux_err: number[];
  extra: ExtraDictionary[];
};

export type FrequencyLightcurveMeasurements = BaseLightcurveMeasurements & {
  module: string[];
};

export type InstrumentLightcurveMeasurements = BaseLightcurveMeasurements & {
  module: string;
};

type BaseLightcurveData = {
  source_id: string;
  binning_strategy: '1 day' | '7 days' | '30 days' | 'none';
};

export type FrequencyLightcurveData = BaseLightcurveData & {
  selection_strategy: 'frequency';
  lightcurves: Record<string, FrequencyLightcurveMeasurements>;
};

export type InstrumentLightcurveData = BaseLightcurveData & {
  selection_strategy: 'instrument';
  lightcurves: Record<string, InstrumentLightcurveMeasurements>;
};

/** Literal type of possible cutout file extensions */
export type CutoutFileExtensions = 'fits' | 'png' | 'hdf5';

/** Literal type of possible light curve data file extensions */
export type DataFileExtensions = 'csv' | 'hdf5';

export function isFrequencyLightcurveData(
  obj: unknown
): obj is FrequencyLightcurveData {
  if (typeof obj !== 'object' || obj === null) return false;

  if ('selection_strategy' in obj && obj.selection_strategy === 'frequency')
    return true;
  else {
    return false;
  }
}

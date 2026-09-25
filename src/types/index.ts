type SourceBase = {
  source_id: string;
  ra: number;
  dec: number;
};

export const SourceStatuses = [
  'unmatched',
  'merged',
  'external_match',
  'novel',
  'noise',
] as const;
type SourceStatus = (typeof SourceStatuses)[number];

export type SourceResponse = SourceBase & {
  socat_id: number;
  name: string;
  variable: boolean;
  extra?: {
    cross_matches?: { name: string }[];
    socat_id?: number;
  };
  properties?: {
    median_flux: Record<string, number>;
  };
};

/** Mirrors lightcurvedb.models.review.decision_metadata's output for a terminal decision
 * (canonical_source_id/external_evidence), plus target_source_id for a merged-away candidate. */
export type ReviewMetadata = {
  target_source_id?: string;
  canonical_source_id?: string;
  external_evidence?: {
    identifier: string;
    object_type?: string | null;
    ra?: number | null;
    dec?: number | null;
    separation_arcmin?: number | null;
    queried_at?: string;
  };
};

export type UnassignedSourceResponse = SourceBase & {
  /** times are Date strings */
  first_seen: string;
  last_seen: string;
  reviewed_at?: string;
  status: SourceStatus;
  version: number; // should be an integer
  reviewed_by?: string;
  review_metadata?: ReviewMetadata;
  extra?: {
    flags: string[];
    simulation_scenario?: string;
    reference_name?: string;
    simulation_seed?: number; // should be an integer
  };
};

export type UnassignedSourceData = UnassignedSourceResponse & {
  in_radius: UnassignedSourceResponse[];
};

/** One row of SIMBAD's /cone response (responseformat=json, verb=2): a fixed columnar layout
 * confirmed against the live endpoint - [distance_deg, main_id, ra_deg, dec_deg, otype, ...] -
 * with further columns present but unused here. */
export type SimbadConeMatchRow = [
  distanceDeg: number | null,
  identifier: string | null,
  ra: number | null,
  dec: number | null,
  objectType: string | null,
  ...rest: unknown[],
];

export type SimbadConeResponse = { data: SimbadConeMatchRow[] };

/** A SIMBAD cone-search match, normalized from a raw SimbadConeMatchRow into named fields.
 * ra/dec/separationArcmin stay nullable since SIMBAD can return a match without a position -
 * such a match is still valid to display/select, just not plottable on the sky map. */
export type SimbadMatch = {
  identifier: string;
  objectType: string | null;
  ra: number | null;
  dec: number | null;
  separationArcmin: number | null;
};

/** Mirrors lightcurvedb.models.review's Pydantic models - the request/response shapes for the
 * unassigned-source review actions (merge, and the three terminal decision outcomes). */
export type ReviewOutcome = 'external_match' | 'novel' | 'noise';

export type ExternalMatchEvidence = {
  identifier: string;
  object_type?: string | null;
  ra?: number | null;
  dec?: number | null;
  separation_arcmin?: number | null;
  /** ISO 8601 - required by the server's `datetime` field. */
  queried_at: string;
};

export type CandidateMergeCommand = {
  source_id: string;
  target_source_id: string;
  expected_version: number;
  reviewer: string;
  reason?: string | null;
};

export type CandidateMerge = {
  source_id: string;
  target_source_id: string;
};

export type CandidateDecisionCommand = {
  source_id: string;
  expected_version: number;
  outcome: ReviewOutcome;
  reviewer: string;
  external_evidence?: ExternalMatchEvidence | null;
  novel_name?: string | null;
};

export type CandidateReviewDecision = {
  source_id: string;
  outcome: ReviewOutcome;
  canonical_source_id: string | null;
};

export type SourcesFeedItem = SourceBase & {
  source_name: string;
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

export type UnassignedFluxMeasurement = {
  measurement_id: string;
  frequency: number;
  module: string;
  source_id: string;
  time: string;
  ra: number;
  dec: number;
  ra_uncertainty?: number;
  dec_uncertainty?: number;
  flux: number;
  flux_err: number;
  extra?: {
    flags: string[];
    map_id?: string;
    simulation_scenaior?: string;
  };
};

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
  ra_uncertainty: number[];
  dec: number[];
  dec_uncertainty: number[];
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

export type BinningStrategy = BaseLightcurveData['binning_strategy'];

export type SelectionStrategy = 'frequency' | 'instrument';

export type FrequencyLightcurveData = BaseLightcurveData & {
  selection_strategy: Extract<SelectionStrategy, 'frequency'>;
  lightcurves: Record<string, FrequencyLightcurveMeasurements>;
};

export type InstrumentLightcurveData = BaseLightcurveData & {
  selection_strategy: Extract<SelectionStrategy, 'instrument'>;
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

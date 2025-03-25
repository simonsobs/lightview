export type SourceResponse = {
  id: number;
  ra: number;
  dec: number;
  variable: boolean;
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
};

export type LightcurveData = {
  source: SourceResponse;
  bands: LightcurveBand[];
};

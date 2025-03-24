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

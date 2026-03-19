type StatsDisplaySpecs = {
  label: string;
  precision: number | null;
  units: string | null;
};

export const numSigFigs = 3;

export const statsKeysToDisplaySpecs: Record<string, StatsDisplaySpecs> = {
  measurement_count: {
    label: 'Measurements',
    precision: null,
    units: null,
  },
  min_flux: {
    label: 'Min Flux',
    precision: numSigFigs,
    units: 'Jy',
  },
  max_flux: {
    label: 'Max Flux',
    precision: numSigFigs,
    units: 'Jy',
  },
  mean_flux: {
    label: 'Mean Flux',
    precision: numSigFigs,
    units: 'Jy',
  },
  stddev_flux: {
    label: 'Std. Dev. Flux',
    precision: numSigFigs,
    units: 'Jy',
  },
  median_flux: {
    label: 'Median Flux',
    precision: numSigFigs,
    units: 'Jy',
  },
};

export const DEFAULT_NEARBY_SOURCE_RADIUS = 1.5;

export const DEFAULT_NANOPLOT_LAYOUT = {
  width: 400,
  height: 250,
  staticPlot: true,
  xaxis: {
    showticklabels: false,
    showgrid: false,
  },
  yaxis: {
    showticklabels: false,
    showgrid: false,
  },
};

export const DEFAULT_NANOPLOT_X_TRANSFORM = 0.8;
export const DEFAULT_NANOPLOT_Y_TRANSFORM = 0.75;

export const DEFAULT_SOURCES_PER_PAGE = Number(
  import.meta.env.VITE_DEFAULT_SOURCES_PER_PAGE
);

export const CUTOUT_EXT_OPTIONS = ['png', 'fits', 'hdf5'];

export const DATA_EXT_OPTIONS = ['hdf5', 'csv'];

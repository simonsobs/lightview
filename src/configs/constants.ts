export const DEFAULT_NEARBY_SOURCE_RADIUS = 1.5;

export const DEFAULT_NANOPLOT_BAND =
  (import.meta.env.VITE_DEFAULT_NANOPLOT_BAND as string) ?? 'f150';

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

export const DEFAULT_SOURCES_PER_PAGE = 3;

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

export const DEFAULT_PLOT_LAYOUT = {
  width: 1280,
  height: 500,
};

export const DEFAULT_HOMEPAGE_PLOT_LAYOUT = {
  width: DEFAULT_PLOT_LAYOUT.width * 0.75,
  height: DEFAULT_PLOT_LAYOUT.height * 0.75,
};

export const MIN_MAX_FLUX_VALUES = [0.001, 5];

export const SIMBAD_BASE_URL = 'https://simbad.cds.unistra.fr';
export const SIMBAD_BASE_LINK_OUT_URL =
  'https://portal.cds.unistra.fr/?target=';

/** Search/beam radius used for unassigned-source cross-matching (SIMBAD cone search, nearby
 * unassigned sources, and the sky plot's dashed beam circle). */
export const UNASSIGNED_BEAM_RADIUS_ARCMIN = 2.0;

/** HiPS survey layer shown in the unassigned-source interactive Aladin sky map. */
export const UNASSIGNED_ALADIN_SURVEY = 'P/DSS2/color';

export const APP_TITLE_CONFIG: {
  orgName: string | undefined;
  appName: string;
} = {
  orgName: (import.meta.env.VITE_ORGANIZATION_NAME as string) ?? undefined,
  appName: (import.meta.env.VITE_APP_NAME as string) ?? 'Light Curve Viewer',
};

export const IS_AUTH_ENABLED: boolean =
  (import.meta.env.VITE_AUTH_ENABLED as string) === 'true';
export const IS_CROSSMATCH_ENABLED: boolean =
  (import.meta.env.VITE_CROSSMATCH_ENABLED as string) === 'true';

export const CONTACT_EMAIL =
  (import.meta.env.VITE_CONTACT_EMAIL as string) ?? 'noop';

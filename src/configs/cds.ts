/** Every endpoint the app uses for CDS services (SIMBAD, Sesame and the Aladin surveys), including
 * the mirrors of them hosted elsewhere. */

/** Sesame name resolver restricted to SIMBAD (the "S"), with XML output ("-ox") */
export const SESAME_URL = 'https://cds.unistra.fr/cgi-bin/nph-sesame/-ox/S?';

export type SimbadHost = {
  /** SIMBAD's web pages, which we link out to */
  pagesUrl: string;
  /** SIMBAD's synchronous TAP (ADQL query) endpoint */
  tapUrl: string;
  /** How this host resolves names. Harvard's copy of Sesame was returning 502s, and its
   * sim-nameresolver treats the "*" in names like "Sgr A*" as a wildcard, so it uses TAP. */
  nameResolver: 'sesame' | 'tap';
};

/** SIMBAD hosts in the order to try them. Both serve the same data, but the Harvard mirror has no
 * /cone endpoint, so cone searches go through TAP on both. */
export const SIMBAD_HOSTS: SimbadHost[] = [
  {
    pagesUrl: 'https://simbad.cds.unistra.fr/simbad',
    tapUrl: 'https://simbad.cds.unistra.fr/simbad/sim-tap/sync',
    nameResolver: 'sesame',
  },
  {
    pagesUrl: 'https://simbad.cfa.harvard.edu/simbad',
    tapUrl: 'https://simbad.cfa.harvard.edu/simbad/sim-tap/sync',
    nameResolver: 'tap',
  },
];

/** ESA's HiPS mirror of the CDS surveys, with the same tiles and depth. */
const HIPS_MIRROR_BASE_URL = 'https://skies.esac.esa.int';

export type AladinSurvey = {
  /** Aladin's ID for the survey, for display */
  name: string;
  /** Where to load the survey from, in the order to try them. These are full URLs because an ID
   * can only resolve to CDS. See chooseSurveyUrl for how one is picked. */
  urls: string[];
};

const DSS_COLOR_SURVEY: AladinSurvey = {
  name: 'P/DSS2/color',
  urls: [
    'https://alasky.cds.unistra.fr/DSS/DSSColor',
    `${HIPS_MIRROR_BASE_URL}/DSSColor`,
  ],
};

const TWO_MASS_COLOR_SURVEY: AladinSurvey = {
  name: 'P/2MASS/color',
  urls: [
    'https://alaskybis.cds.unistra.fr/2MASS/Color',
    `${HIPS_MIRROR_BASE_URL}/2MASSColor`,
  ],
};

/** HiPS survey layer shown in the all-sky map. */
export const ALL_SKY_ALADIN_SURVEY = DSS_COLOR_SURVEY;

/** HiPS survey layer shown in the source page's Aladin viewer. */
export const SOURCE_ALADIN_SURVEY = TWO_MASS_COLOR_SURVEY;

/** HiPS survey layer shown in the unassigned-source interactive Aladin sky map. */
export const UNASSIGNED_ALADIN_SURVEY = DSS_COLOR_SURVEY;

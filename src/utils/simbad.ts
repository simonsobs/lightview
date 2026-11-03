import { SESAME_URL, SIMBAD_HOSTS, SimbadHost } from '../configs/cds';
import { SIMBAD_HOST_TIMEOUT_MS } from '../configs/constants';
import { SimbadConeResponse, SimbadMatch } from '../types';

/** An object SIMBAD resolved from a user-entered name; ra/dec are ICRS degrees, ra in 0->360. */
export type SimbadResolvedObject = {
  identifier: string;
  ra: number;
  dec: number;
};

export type SimbadResolveErrorKind =
  | 'network'
  | 'timeout'
  | 'http'
  | 'unavailable'
  | 'not-found'
  | 'no-coordinates'
  | 'unexpected';

/** Thrown by resolveSimbadObject; message is user-facing, and detail (if any) is the resolver's
 * own short explanation, shown alongside it. */
export class SimbadResolveError extends Error {
  kind: SimbadResolveErrorKind;
  detail?: string;

  constructor(kind: SimbadResolveErrorKind, message: string, detail?: string) {
    super(message);
    this.name = 'SimbadResolveError';
    this.kind = kind;
    this.detail = detail;
  }
}

/** Failures that say something about the host rather than the name, so another host may do better.
 * A miss isn't one of them, since the hosts share the same data. */
const FAILOVER_ERROR_KINDS: SimbadResolveErrorKind[] = [
  'network',
  'timeout',
  'http',
  'unavailable',
  'unexpected',
];

/** The host that last gave an answer, tried first so that while a host is down only the first
 * request has to wait for it to time out. Links out to SIMBAD go to it too, since a link can't
 * fail over once it's clicked. */
let preferredHost: SimbadHost = SIMBAD_HOSTS[0];

export function resetPreferredSimbadHost() {
  preferredHost = SIMBAD_HOSTS[0];
}

/** Runs attempt against each host in turn until one succeeds or fails in a way another host
 * wouldn't fix (per canFailOver). If they all fail, rejects with the last host's error. */
async function tryEachHost<T>(
  attempt: (host: SimbadHost) => Promise<T>,
  canFailOver: (error: unknown) => boolean
): Promise<T> {
  const hosts = [
    preferredHost,
    ...SIMBAD_HOSTS.filter((host) => host !== preferredHost),
  ];

  let lastError: unknown;
  for (const host of hosts) {
    try {
      const result = await attempt(host);
      preferredHost = host;
      return result;
    } catch (e) {
      if (!canFailOver(e)) {
        preferredHost = host;
        throw e;
      }
      lastError = e;
    }
  }
  throw lastError;
}

/** Longest resolver-provided detail shown to the user; anything longer is a server dump. */
const MAX_DETAIL_LENGTH = 200;

function summarizeDetail(text: string | null | undefined): string | undefined {
  const firstLine = text
    ?.split('\n')
    .map((l) => l.trim())
    .find(Boolean);
  if (!firstLine) return undefined;
  return firstLine.length > MAX_DETAIL_LENGTH
    ? firstLine.slice(0, MAX_DETAIL_LENGTH) + '…'
    : firstLine;
}

/** Names are resolved through CDS's Sesame service. SIMBAD's own sim-script endpoint was used
 * originally, but it intermittently fails even for well-known names. Sesame answers from SIMBAD's
 * data through a cache and does not appear to fail anywhere near the same rate. */
export function buildSesameUrl(name: string): string {
  return SESAME_URL + encodeURIComponent(normalizeName(name));
}

function normalizeName(name: string): string {
  return name.replace(/\s+/g, ' ').trim();
}

function notFoundError(name: string): SimbadResolveError {
  return new SimbadResolveError(
    'not-found',
    `SIMBAD couldn't find an object named "${name}". Check the spelling or try another identifier.`
  );
}

function noPositionError(identifier: string): SimbadResolveError {
  return new SimbadResolveError(
    'no-coordinates',
    `SIMBAD found ${identifier}, but it has no recorded position to go to.`
  );
}

function unreadableResponseError(): SimbadResolveError {
  return new SimbadResolveError(
    'unexpected',
    'SIMBAD returned a response that could not be read.'
  );
}

/** SIMBAD pads identifiers for alignment (e.g. "M  31"); collapse that for display. */
function collapseIdentifier(identifier: string): string {
  return identifier.replace(/\s+/g, ' ').trim();
}

/** Parses a Sesame XML response from buildSesameUrl. A hit has a <Resolver> with <oname> (SIMBAD's
 * main identifier) and <jradeg>/<jdedeg>; a miss has only an <INFO>"Nothing found"</INFO>; a
 * resolver-side failure has an <ERROR>. */
export function parseSesameResponse(
  text: string,
  name: string
): SimbadResolvedObject {
  const doc = new DOMParser().parseFromString(text, 'application/xml');
  const target = doc.querySelector('Sesame > Target');
  if (!target || doc.querySelector('parsererror')) {
    throw unreadableResponseError();
  }

  const resolver = target.querySelector('Resolver');
  if (!resolver) {
    const error = target.querySelector('ERROR');
    if (error) {
      throw new SimbadResolveError(
        'unavailable',
        'SIMBAD had a temporary problem answering this search. Please try again in a moment.',
        summarizeDetail(error.textContent)
      );
    }
    throw notFoundError(name);
  }

  const identifier =
    collapseIdentifier(resolver.querySelector('oname')?.textContent ?? '') ||
    name;
  const raText = resolver.querySelector('jradeg')?.textContent;
  const decText = resolver.querySelector('jdedeg')?.textContent;
  const ra = raText ? Number(raText) : NaN;
  const dec = decText ? Number(decText) : NaN;
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
    throw noPositionError(identifier);
  }

  return { identifier, ra, dec };
}

function buildTapUrl(host: SimbadHost, query: string): string {
  const params = new URLSearchParams({
    request: 'doQuery',
    lang: 'adql',
    format: 'json',
    query,
  });
  return `${host.tapUrl}?${params.toString()}`;
}

/** Looks a name up in SIMBAD's table of identifiers, for hosts without a working Sesame. Spacing
 * and capitalization are flexible, as with Sesame, except in "NAME" identifiers such as Sgr A*. */
export function buildTapNameQueryUrl(name: string, host: SimbadHost): string {
  const identifier = normalizeName(name).replace(/'/g, "''");
  return buildTapUrl(
    host,
    `SELECT basic.main_id, ra, dec FROM ident JOIN basic ON oidref = oid WHERE id = '${identifier}'`
  );
}

/** Parses a TAP JSON response from buildTapNameQueryUrl, whose rows are [main_id, ra, dec]. */
export function parseTapNameResponse(
  text: string,
  name: string
): SimbadResolvedObject {
  let rows: unknown;
  try {
    rows = (JSON.parse(text) as { data?: unknown }).data;
  } catch {
    throw unreadableResponseError();
  }
  if (!Array.isArray(rows)) throw unreadableResponseError();

  const row = rows[0] as
    | [string | null, number | null, number | null]
    | undefined;
  if (!row) throw notFoundError(name);

  const [mainId, ra, dec] = row;
  const identifier = collapseIdentifier(mainId ?? '') || name;
  if (ra == null || dec == null) throw noPositionError(identifier);
  return { identifier, ra, dec };
}

async function resolveOnHost(
  name: string,
  host: SimbadHost,
  signal?: AbortSignal
): Promise<SimbadResolvedObject> {
  const usesSesame = host.nameResolver === 'sesame';
  const timeoutController = new AbortController();
  const timeout = window.setTimeout(
    () => timeoutController.abort(),
    SIMBAD_HOST_TIMEOUT_MS
  );
  const onCallerAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let text: string;
  try {
    let response: Response;
    try {
      response = await fetch(
        usesSesame ? buildSesameUrl(name) : buildTapNameQueryUrl(name, host),
        { signal: timeoutController.signal }
      );
    } catch (e) {
      if (signal?.aborted) throw e;
      if (timeoutController.signal.aborted) {
        throw new SimbadResolveError(
          'timeout',
          'SIMBAD took too long to respond. Please try again in a moment.'
        );
      }
      throw new SimbadResolveError(
        'network',
        "Couldn't reach SIMBAD. Check your network connection and try again."
      );
    }

    if (!response.ok) {
      throw new SimbadResolveError(
        response.status >= 500 ? 'http' : 'unexpected',
        `SIMBAD returned an error (${response.status}${response.statusText ? ' ' + response.statusText : ''}). Please try again later.`
      );
    }
    text = await response.text();
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onCallerAbort);
  }

  return usesSesame
    ? parseSesameResponse(text, name)
    : parseTapNameResponse(text, name);
}

/** Resolves an object name (e.g. "M31", "3C 273", "Sgr A*") to its SIMBAD position, moving on to
 * the next host after a host-side failure. Always rejects with a SimbadResolveError, so callers
 * can show error.message directly. Aborting `signal` rejects with the signal's own reason instead,
 * so a superseded request can be ignored. */
export function resolveSimbadObject(
  name: string,
  signal?: AbortSignal
): Promise<SimbadResolvedObject> {
  return tryEachHost(
    (host) => resolveOnHost(name, host, signal),
    (e) =>
      e instanceof SimbadResolveError && FAILOVER_ERROR_KINDS.includes(e.kind)
  );
}

/** Builds a TAP query for the 10 most-cited objects within radiusArcmin of a position, selecting
 * the columns of a SimbadConeMatchRow. */
export function buildSimbadConeQueryUrl(
  ra: number,
  dec: number,
  radiusArcmin: number,
  host: SimbadHost = SIMBAD_HOSTS[0]
): string {
  const position = `'ICRS', ${normalizeRa(ra)}, ${dec}`;
  return buildTapUrl(
    host,
    `SELECT TOP 10 DISTANCE(POINT('ICRS', ra, dec), POINT(${position})) AS dist, ` +
      'main_id, ra, dec, otype FROM basic ' +
      `WHERE CONTAINS(POINT('ICRS', ra, dec), CIRCLE(${position}, ${radiusArcmin / 60})) = 1 ` +
      'ORDER BY nbref DESC'
  );
}

async function searchConeOnHost(
  ra: number,
  dec: number,
  radiusArcmin: number,
  host: SimbadHost
): Promise<SimbadMatch[]> {
  const response = await fetch(
    buildSimbadConeQueryUrl(ra, dec, radiusArcmin, host),
    { signal: AbortSignal.timeout(SIMBAD_HOST_TIMEOUT_MS) }
  );
  if (!response.ok) {
    throw new Error(
      `SIMBAD returned ${response.status} ${response.statusText}`
    );
  }
  const json = (await response.json()) as SimbadConeResponse;
  if (!Array.isArray(json?.data)) {
    throw new Error('SIMBAD returned an unexpected response.');
  }
  return json.data.map((row) => ({
    identifier: row[1] ?? 'SIMBAD object',
    objectType: row[4] ?? null,
    ra: row[2] ?? null,
    dec: row[3] ?? null,
    separationArcmin: row[0] != null ? row[0] * 60 : null,
  }));
}

/** Finds the SIMBAD objects near a position, moving on to the next host after any failure. */
export function searchSimbadCone(
  ra: number,
  dec: number,
  radiusArcmin: number
): Promise<SimbadMatch[]> {
  return tryEachHost(
    (host) => searchConeOnHost(ra, dec, radiusArcmin, host),
    () => true
  );
}

/** Converts RA in either the -180 -> 180 or 0 -> 360 convention to 0 -> 360. */
export function normalizeRa(ra: number): number {
  // Only shifts negative values, rather than the usual ((ra % 360) + 360) % 360, which adds
  // floating-point noise to positive ones (10.68 -> 10.680000000000007)
  const wrapped = ra % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Link to SIMBAD's own coordinate (cone) search around a position, on the host that last answered
 * (see preferredHost). */
export function buildSimbadConeSearchUrl(
  ra: number,
  dec: number,
  radiusArcmin: number
): string {
  const params = new URLSearchParams({
    Coord: `${normalizeRa(ra)} ${dec}`,
    CooFrame: 'ICRS',
    Radius: String(radiusArcmin),
    'Radius.unit': 'arcmin',
  });
  return `${preferredHost.pagesUrl}/sim-coo?${params.toString()}`;
}

/** Link to SIMBAD's page for an object, on the host that last answered (see preferredHost). */
export function buildSimbadObjectUrl(identifier: string): string {
  const params = new URLSearchParams({ Ident: identifier });
  return `${preferredHost.pagesUrl}/sim-id?${params.toString()}`;
}

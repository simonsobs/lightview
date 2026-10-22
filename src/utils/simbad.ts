import {
  SIMBAD_BASE_URL,
  SIMBAD_RESOLVE_TIMEOUT_MS,
} from '../configs/constants';

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

/** Server-side failures that are worth one automatic retry before being reported. */
const TRANSIENT_ERROR_KINDS: SimbadResolveErrorKind[] = ['http', 'unavailable'];
const RETRY_DELAY_MS = 500;

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

/** Names are resolved through CDS's Sesame service restricted to SIMBAD (the trailing "S"), with
 * XML output ("-ox"). SIMBAD's own sim-script endpoint was used originally, but it intermittently
 * fails even for well-known names. Sesame answers from SIMBAD's data through a cache and
 * does not appear to fail anywhere near the same rate. */
export function buildSesameUrl(name: string): string {
  return (
    'https://cds.unistra.fr/cgi-bin/nph-sesame/-ox/S?' +
    encodeURIComponent(name.replace(/\s+/g, ' ').trim())
  );
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
    throw new SimbadResolveError(
      'unexpected',
      'SIMBAD returned a response that could not be read.'
    );
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
    throw new SimbadResolveError(
      'not-found',
      `SIMBAD couldn't find an object named "${name}". Check the spelling or try another identifier.`
    );
  }

  // SIMBAD pads identifiers for alignment (e.g. "M  31"); collapse that for display.
  const identifier =
    resolver.querySelector('oname')?.textContent?.replace(/\s+/g, ' ').trim() ||
    name;
  const raText = resolver.querySelector('jradeg')?.textContent;
  const decText = resolver.querySelector('jdedeg')?.textContent;
  const ra = raText ? Number(raText) : NaN;
  const dec = decText ? Number(decText) : NaN;
  if (!Number.isFinite(ra) || !Number.isFinite(dec)) {
    throw new SimbadResolveError(
      'no-coordinates',
      `SIMBAD found ${identifier}, but it has no recorded position to go to.`
    );
  }

  return { identifier, ra, dec };
}

async function resolveOnce(
  name: string,
  signal?: AbortSignal
): Promise<SimbadResolvedObject> {
  const timeoutController = new AbortController();
  const timeout = window.setTimeout(
    () => timeoutController.abort(),
    SIMBAD_RESOLVE_TIMEOUT_MS
  );
  const onCallerAbort = () => timeoutController.abort();
  signal?.addEventListener('abort', onCallerAbort);

  let text: string;
  try {
    let response: Response;
    try {
      response = await fetch(buildSesameUrl(name), {
        signal: timeoutController.signal,
      });
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

  return parseSesameResponse(text, name);
}

/** Resolves an object name (e.g. "M31", "3C 273", "Sgr A*") to its SIMBAD position, retrying
 * once after a server-side failure. Always rejects with a SimbadResolveError, so callers can show
 * error.message directly. Aborting `signal` rejects with the signal's own reason instead, so a
 * superseded request can be ignored. */
export async function resolveSimbadObject(
  name: string,
  signal?: AbortSignal
): Promise<SimbadResolvedObject> {
  try {
    return await resolveOnce(name, signal);
  } catch (e) {
    if (
      !(e instanceof SimbadResolveError) ||
      !TRANSIENT_ERROR_KINDS.includes(e.kind)
    ) {
      throw e;
    }
  }

  await new Promise<void>((resolve, reject) => {
    const retryTimeout = window.setTimeout(resolve, RETRY_DELAY_MS);
    signal?.addEventListener(
      'abort',
      () => {
        window.clearTimeout(retryTimeout);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true }
    );
  });
  return resolveOnce(name, signal);
}

/** Converts RA in either the -180 -> 180 or 0 -> 360 convention to 0 -> 360. */
export function normalizeRa(ra: number): number {
  // Only shifts negative values, rather than the usual ((ra % 360) + 360) % 360, which adds
  // floating-point noise to positive ones (10.68 -> 10.680000000000007)
  const wrapped = ra % 360;
  return wrapped < 0 ? wrapped + 360 : wrapped;
}

/** Link to SIMBAD's own coordinate (cone) search around a position. */
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
  return `${SIMBAD_BASE_URL}/simbad/sim-coo?${params.toString()}`;
}

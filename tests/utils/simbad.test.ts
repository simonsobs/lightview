import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
import {
  buildSesameUrl,
  buildSimbadConeSearchUrl,
  parseSesameResponse,
  resolveSimbadObject,
  SimbadResolveError,
} from '../../src/utils/simbad';
import { SESAME_NOT_FOUND, sesameError, sesameHit } from './sesameFixtures';

function textResponse(text: string, ok = true, status = 200, statusText = '') {
  return {
    ok,
    status,
    statusText,
    text: () => Promise.resolve(text),
  } as unknown as Response;
}

function catchError(fn: () => unknown): SimbadResolveError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(SimbadResolveError);
    return e as SimbadResolveError;
  }
  throw new Error('Expected a SimbadResolveError');
}

async function expectResolveError(
  promise: Promise<unknown>,
  kind: SimbadResolveError['kind']
) {
  const error = await promise.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(SimbadResolveError);
  expect((error as SimbadResolveError).kind).toBe(kind);
  return error as SimbadResolveError;
}

describe('buildSesameUrl', () => {
  it('queries SIMBAD via Sesame with the name encoded and whitespace normalized', () => {
    expect(buildSesameUrl('  Sgr\nA* ')).toBe(
      'https://cds.unistra.fr/cgi-bin/nph-sesame/-ox/S?Sgr%20A*'
    );
  });
});

describe('parseSesameResponse', () => {
  it('parses a hit, collapsing SIMBAD identifier padding', () => {
    expect(
      parseSesameResponse(sesameHit('M  31', 10.68470833, 41.26875), 'm31')
    ).toEqual({ identifier: 'M 31', ra: 10.68470833, dec: 41.26875 });
  });

  it('reports a miss as not-found', () => {
    const error = catchError(() =>
      parseSesameResponse(SESAME_NOT_FOUND, 'nope')
    );
    expect(error.kind).toBe('not-found');
    expect(error.message).toContain('"nope"');
  });

  it('reports resolver errors as unavailable, keeping only a short detail', () => {
    const trace =
      'java.lang.StringIndexOutOfBoundsException: offset 4071 ' +
      'x'.repeat(500) +
      '\n\tat cds.xml.XmlGen.addAttr(XmlGen.java:310)';
    const error = catchError(() =>
      parseSesameResponse(sesameError(trace), 'M 31')
    );
    expect(error.kind).toBe('unavailable');
    expect(error.detail).not.toContain('XmlGen');
    expect(error.detail!.length).toBeLessThanOrEqual(201);
  });

  it('reports objects without coordinates', () => {
    const text = sesameHit('Some Obj', 0, 0).replace(
      /<jradeg>.*<\/jdedeg>/s,
      ''
    );
    expect(catchError(() => parseSesameResponse(text, 'x')).kind).toBe(
      'no-coordinates'
    );
  });

  it('reports unreadable responses', () => {
    expect(
      catchError(() => parseSesameResponse('<html>oops</html>', 'x')).kind
    ).toBe('unexpected');
  });
});

describe('resolveSimbadObject', () => {
  let fetchMock: Mock<typeof fetch>;

  beforeEach(() => {
    fetchMock = vi.fn<typeof fetch>();
    global.fetch = fetchMock;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves a name to a position', async () => {
    fetchMock.mockResolvedValue(
      textResponse(sesameHit('3C 273', 187.27, 2.05))
    );
    await expect(resolveSimbadObject('3C 273')).resolves.toEqual({
      identifier: '3C 273',
      ra: 187.27,
      dec: 2.05,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a plain miss', async () => {
    fetchMock.mockResolvedValue(textResponse(SESAME_NOT_FOUND));
    await expectResolveError(resolveSimbadObject('nope'), 'not-found');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries once after a transient server failure', async () => {
    fetchMock
      .mockResolvedValueOnce(textResponse(sesameError('busy')))
      .mockResolvedValueOnce(textResponse(sesameHit('M  31', 10.68, 41.27)));
    await expect(resolveSimbadObject('M 31')).resolves.toMatchObject({
      identifier: 'M 31',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives up after a second server failure', async () => {
    fetchMock.mockResolvedValue(
      textResponse('', false, 503, 'Service Unavailable')
    );
    const error = await expectResolveError(resolveSimbadObject('M31'), 'http');
    expect(error.message).toContain('503 Service Unavailable');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('maps fetch failures to a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));
    await expectResolveError(resolveSimbadObject('M31'), 'network');
  });

  it('times out a request that never settles', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    const promise = expectResolveError(resolveSimbadObject('M31'), 'timeout');
    await vi.runAllTimersAsync();
    await promise;
  });

  it('rethrows the raw abort when the caller cancels', async () => {
    const controller = new AbortController();
    fetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('Aborted', 'AbortError'))
          );
        })
    );
    const promise = resolveSimbadObject('M31', controller.signal);
    controller.abort();
    const error = await promise.catch((e: unknown) => e);
    expect(error).not.toBeInstanceOf(SimbadResolveError);
  });
});

describe('buildSimbadConeSearchUrl', () => {
  it('builds a sim-coo link around the position', () => {
    const url = new URL(buildSimbadConeSearchUrl(10.68, 41.27, 5));
    expect(url.pathname).toBe('/simbad/sim-coo');
    expect(url.searchParams.get('Coord')).toBe('10.68 41.27');
    expect(url.searchParams.get('Radius')).toBe('5');
    expect(url.searchParams.get('Radius.unit')).toBe('arcmin');
  });
});

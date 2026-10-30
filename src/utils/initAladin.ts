/** How long to wait for Aladin (chunk download plus its init promise) before showing the sky map
 * as unavailable, so a slow connection or a stalled init can't leave the map loading forever. */
export const ALADIN_INIT_TIMEOUT_MS = 15_000;

export type AladinLoadStatus = 'loading' | 'ready' | 'failed';

let aladinScriptPromise: Promise<AladinStatic> | null = null;

/** Loads the bundled aladin-lite package once, as its own lazily imported chunk (~2.4 MB with
 * its WASM inlined), and exposes it as window.A for the viewers. It's served with the app rather
 * than from CDS, so the sky maps and our catalogs don't depend on Aladin's servers being up (the
 * HiPS image tiles themselves still come from survey servers). Every caller shares the same
 * promise, so it doesn't matter whether the chunk finishes before or after a viewer mounts. A
 * failed load is forgotten, so the next viewer to mount tries again.
 *
 * The import doesn't start until the window's load event, so this large chunk doesn't compete
 * with the app's own first-load assets. */
export function loadAladinScript(): Promise<AladinStatic> {
  if (window.A) return Promise.resolve(window.A);
  if (aladinScriptPromise) return aladinScriptPromise;

  aladinScriptPromise = whenWindowLoaded()
    .then(() => import('aladin-lite'))
    .then(({ default: A }) => {
      window.A = A;
      return A;
    });
  aladinScriptPromise.catch(() => {
    aladinScriptPromise = null;
  });
  return aladinScriptPromise;
}

function whenWindowLoaded(): Promise<void> {
  if (document.readyState === 'complete') return Promise.resolve();
  return new Promise((resolve) => {
    window.addEventListener('load', () => resolve(), { once: true });
  });
}

/** Waits for the Aladin API (see loadAladinScript) and then calls onReady to build a viewer.
 * Calls onFailed if the script fails to load, init rejects, onReady throws (e.g. A.aladin()
 * itself failing), or the whole thing hasn't settled within timeoutMs. A timeout doesn't give up:
 * if Aladin finishes loading late, onReady still runs, so callers should treat onReady as
 * clearing a failure. Returns a cleanup that stops both callbacks from firing. */
export function initAladin(
  onReady: (A: AladinStatic) => void,
  onFailed: () => void,
  timeoutMs = ALADIN_INIT_TIMEOUT_MS
): () => void {
  let cancelled = false;
  const timeout = window.setTimeout(() => {
    if (cancelled) return;
    console.error(`Aladin API did not initialize within ${timeoutMs}ms.`);
    onFailed();
  }, timeoutMs);

  loadAladinScript()
    .then((A) => A.init.then(() => A))
    .then((A) => {
      if (cancelled) return;
      window.clearTimeout(timeout);
      onReady(A);
    })
    .catch((error: unknown) => {
      if (cancelled) return;
      window.clearTimeout(timeout);
      console.error('Aladin API failed to initialize.', error);
      onFailed();
    });

  return () => {
    cancelled = true;
    window.clearTimeout(timeout);
  };
}

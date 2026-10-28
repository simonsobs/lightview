const ALADIN_SCRIPT_URL =
  'https://aladin.cds.unistra.fr/AladinLite/api/v3/3.9.0-beta/aladin.js';
const ALADIN_SCRIPT_INTEGRITY =
  'sha384-XWfkW1W6wZGYih5GE4EK4Q4VTFWo1V/XrcARg9w7q7csI051Z53g4h26xNTJdOWr';

/** How long to wait for Aladin (script download plus its init promise) before showing the sky
 * map as unavailable. When Aladin's servers are down, either step can hang indefinitely instead
 * of failing. */
export const ALADIN_INIT_TIMEOUT_MS = 15_000;

export type AladinLoadStatus = 'loading' | 'ready' | 'failed';

let aladinScriptPromise: Promise<AladinStatic> | null = null;

/** Loads aladin.js once, asynchronously, so that a slow or unreachable Aladin server never blocks
 * the rest of the app from rendering (as a plain <script> tag in index.html would). Every caller
 * shares the same promise, so it doesn't matter whether the script finishes before or after a
 * viewer mounts. A failed load is forgotten, so the next viewer to mount tries again.
 *
 * The script isn't inserted until the window's load event: a pending script delays that event
 * even when added dynamically with async, so a hanging Aladin server would otherwise leave the
 * browser's tab spinner and status bar ("Connecting to aladin...") stuck until it times out. */
export function loadAladinScript(): Promise<AladinStatic> {
  if (window.A) return Promise.resolve(window.A);
  if (aladinScriptPromise) return aladinScriptPromise;

  aladinScriptPromise = whenWindowLoaded().then(insertAladinScript);
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

function insertAladinScript(): Promise<AladinStatic> {
  return new Promise<AladinStatic>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = ALADIN_SCRIPT_URL;
    script.integrity = ALADIN_SCRIPT_INTEGRITY;
    script.crossOrigin = 'anonymous';
    script.async = true;
    script.onload = () => {
      if (window.A) resolve(window.A);
      else reject(new Error('Aladin script loaded but window.A is missing.'));
    };
    script.onerror = () => {
      script.remove();
      reject(new Error('Aladin script failed to load.'));
    };
    document.head.appendChild(script);
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

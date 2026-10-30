import { RefObject, useEffect, useState } from 'react';

export type SurveyStatus =
  | { kind: 'ok' }
  /** Aladin has been waiting on a survey for longer than SLOW_LOAD_MS */
  | { kind: 'slow' }
  /** The base survey's server didn't answer our probe; `host` names it for the user */
  | { kind: 'unavailable'; host: string };

/** How long one of Aladin's "<survey> loading..." tasks can run before we call it slow. Aladin's
 * own lookup can take over a minute to give up when CDS is down. */
const SLOW_LOAD_MS = 10_000;
/** How long the survey server gets to answer our probe */
const PROBE_TIMEOUT_MS = 8_000;
/** How often to re-probe an unavailable server, so the notice clears once it's back */
const REPROBE_INTERVAL_MS = 30_000;

/**
 * Reports whether the sky map's background survey (HiPS) is actually loading. Aladin fetches the
 * survey's tiles inside its WASM core and reports no errors for them, so when the survey server
 * is down the map just stays empty. Instead, this probes the base survey's `properties` file,
 * which is served alongside its tiles, as soon as there's a viewer and whenever its base layer
 * changes.
 *
 * It also watches Aladin's "<survey> loading..." tasks, so the user hears about a slow survey
 * lookup well before Aladin gives up on it. Those task events are dispatched on `document` with no
 * reference to their viewer, so a slow survey in one viewer shows as slow in every mounted one.
 */
export function useSurveyStatus(
  containerRef: RefObject<HTMLElement | null>,
  aladinRef: RefObject<Aladin | null>,
  viewerGeneration: number
): SurveyStatus {
  const [unavailableHost, setUnavailableHost] = useState<string | null>(null);
  const [hasSlowTask, setHasSlowTask] = useState(false);

  // Watches for slow tasks from mount rather than from when a viewer exists, because A.aladin()
  // dispatches the task for its initial survey before the viewer's first render
  useEffect(() => {
    // Aladin's task ID -> the timer that marks it slow
    const slowTimers = new Map<string, number>();
    const slowTasks = new Set<string>();

    const onFetchStarted = (event: Event) => {
      const taskId = getTaskId(event);
      if (!taskId) return;
      slowTimers.set(
        taskId,
        window.setTimeout(() => {
          slowTimers.delete(taskId);
          slowTasks.add(taskId);
          setHasSlowTask(true);
        }, SLOW_LOAD_MS)
      );
    };

    const onFetchFinished = (event: Event) => {
      const taskId = getTaskId(event);
      if (!taskId) return;
      window.clearTimeout(slowTimers.get(taskId));
      slowTimers.delete(taskId);
      slowTasks.delete(taskId);
      setHasSlowTask(slowTasks.size > 0);
    };

    document.addEventListener('AL:fetch', onFetchStarted);
    document.addEventListener('AL:Resource.fetched', onFetchFinished);

    return () => {
      document.removeEventListener('AL:fetch', onFetchStarted);
      document.removeEventListener('AL:Resource.fetched', onFetchFinished);
      slowTimers.forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    const aladin = aladinRef.current;
    if (!el || !aladin) return;

    let probedUrl: string | null = null;
    let probe: AbortController | null = null;
    let reprobeTimer: number | undefined;

    const probeBaseLayer = (force = false) => {
      // A survey still being queried may only have its startUrl, and its query can hang without
      // ever firing Layer.added, so this can't wait for url. One given by ID that isn't in
      // Aladin's built-in list has neither until Aladin resolves it.
      const layer = aladin.getBaseImageLayer();
      const url = [layer?.url, layer?.startUrl].find((candidate) =>
        candidate ? /^https?:\/\//.test(candidate) : false
      );
      if (!url) return;
      if (!force && url === probedUrl) return;

      probedUrl = url;
      probe?.abort();
      window.clearTimeout(reprobeTimer);
      const controller = new AbortController();
      probe = controller;
      const timeout = window.setTimeout(
        () => controller.abort(),
        PROBE_TIMEOUT_MS
      );

      void fetch(`${url.replace(/\/+$/, '')}/properties`, {
        signal: controller.signal,
        cache: 'no-store',
      })
        .then((response) => {
          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          return true;
        })
        .catch(() => false)
        .then((reachable) => {
          window.clearTimeout(timeout);
          // Superseded by a newer probe, or the effect was cleaned up
          if (probe !== controller) return;
          probe = null;
          setUnavailableHost(reachable ? null : new URL(url).host);
          if (!reachable) {
            reprobeTimer = window.setTimeout(
              () => probeBaseLayer(true),
              REPROBE_INTERVAL_MS
            );
          }
        });
    };

    // Resource.fetched covers a failed survey, which Aladin replaces without firing Layer.added
    // until its fallback survey has loaded
    const onLayerEvent = () => probeBaseLayer();

    el.addEventListener('AL:Layer.added', onLayerEvent);
    el.addEventListener('AL:Layer.changed', onLayerEvent);
    document.addEventListener('AL:Resource.fetched', onLayerEvent);
    probeBaseLayer();

    return () => {
      el.removeEventListener('AL:Layer.added', onLayerEvent);
      el.removeEventListener('AL:Layer.changed', onLayerEvent);
      document.removeEventListener('AL:Resource.fetched', onLayerEvent);
      probe?.abort();
      probe = null;
      window.clearTimeout(reprobeTimer);
    };
  }, [containerRef, aladinRef, viewerGeneration]);

  if (unavailableHost) return { kind: 'unavailable', host: unavailableHost };
  return { kind: hasSlowTask ? 'slow' : 'ok' };
}

function getTaskId(event: Event): string | undefined {
  return (event as CustomEvent<{ task?: { id?: string } }>).detail?.task?.id;
}

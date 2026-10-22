import { RefObject, useCallback, useEffect, useState } from 'react';

type WebGLContextRecoveryOptions = {
  /** Whether to recover on our own as soon as the container is back on screen (see below), or
   * wait for the caller to invoke `recover`, i.e. the "Reload map" button in the sky map.
   * Defaults to true. */
  autoRecover?: boolean;
};

type WebGLContextRecovery = {
  /** Whether a context inside the container has been lost and not yet recovered */
  isContextLost: boolean;
  /** Increments each time the caller should rebuild its WebGL view: include it in the init
   * effect's deps and tear down/recreate the view when it changes */
  recoveryCount: number;
  /** Clears the lost state and bumps recoveryCount */
  recover: () => void;
};

/**
 * Browsers cap how many WebGL contexts can be live at once, and creating one past the cap silently
 * kills the oldest. The oldest context is often a plot or sky map in another tab of this app,
 * which can cause confusion for users. Neither Plotly's scattergl nor Aladin Lite recovers from
 * the wiped context on their own; rather, the canvas just stops drawing and appears broken. This
 * hook watches `containerRef` for a lost context on any canvas inside it and reports when the
 * caller should rebuild its view.
 *
 * The rebuild creates a new context, which can in turn evict another one, so with autoRecover it's
 * deferred until the container is actually on screen: until its tab is visible (animation frames
 * are paused in background tabs) and until it has a size (e.g. Main's Lightcurve, kept mounted but
 * display:none on every non-home page).
 */
export function useWebGLContextRecovery(
  containerRef: RefObject<HTMLElement | null>,
  { autoRecover = true }: WebGLContextRecoveryOptions = {}
): WebGLContextRecovery {
  const [isContextLost, setIsContextLost] = useState(false);
  const [recoveryCount, setRecoveryCount] = useState(0);

  const recover = useCallback(() => {
    setIsContextLost(false);
    setRecoveryCount((count) => count + 1);
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleContextLost = () => setIsContextLost(true);

    // webglcontextlost doesn't bubble, so listen in the capture phase to catch it from whichever
    // canvases the library has created (or recreated) inside the container
    el.addEventListener('webglcontextlost', handleContextLost, true);
    return () =>
      el.removeEventListener('webglcontextlost', handleContextLost, true);
  }, [containerRef]);

  useEffect(() => {
    const el = containerRef.current;
    if (!autoRecover || !isContextLost || !el) return;

    let raf: number | undefined;
    const scheduleRecovery = () => {
      raf ??= requestAnimationFrame(recover);
    };

    if (el.clientWidth > 0 && el.clientHeight > 0) {
      scheduleRecovery();
      return () => {
        if (raf !== undefined) cancelAnimationFrame(raf);
      };
    }

    // Hidden via display:none (or not yet laid out): wait until it gets a size
    const observer = new ResizeObserver(() => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        observer.disconnect();
        scheduleRecovery();
      }
    });
    observer.observe(el);
    return () => {
      observer.disconnect();
      if (raf !== undefined) cancelAnimationFrame(raf);
    };
  }, [autoRecover, isContextLost, containerRef, recover]);

  return { isContextLost, recoveryCount, recover };
}

/**
 * Frees an Aladin Lite viewer's WebGL context right away. Aladin has no teardown API and its
 * redraw loop never stops, so an unmounted viewer is never garbage collected and would otherwise
 * keep holding one of the browser's limited live contexts for the rest of the tab's life. Only
 * Aladin's image canvas uses WebGL (its others are 2D), and calling getContext on it returns
 * the context Aladin already created rather than making a new one.
 */
export function releaseAladinWebGLContext(container: HTMLElement) {
  container
    .querySelectorAll<HTMLCanvasElement>('canvas.aladin-imageCanvas')
    .forEach((canvas) =>
      canvas
        .getContext('webgl2')
        ?.getExtension('WEBGL_lose_context')
        ?.loseContext()
    );
}

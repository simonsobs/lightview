import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import SourceFluxFilter from './SourceFluxFilter';
import {
  CATALOG_SEARCH_CONE_RADIUS_ARCMIN,
  CATALOG_SEARCH_FOV_DEG,
  CONE_SEARCH_FOV_MARGIN,
  MIN_MAX_FLUX_VALUES,
} from '../configs/constants';
import {
  FREQUENCY_COLORS,
  SO_FALLBACK_COLOR,
  frequencyKey,
} from '../configs/socolors';
import { SkyExplorerProps } from './SkyExplorer';
import { SkySource } from '../types';
import { useWebGLContextRecovery } from '../hooks/useWebGLContextRecovery';
import { WebGLContextLostOverlay } from './WebGLContextLostOverlay';
import { SkyMapStatusOverlay } from './SkyMapStatusOverlay';
import { AladinLoadStatus, initAladin } from '../utils/initAladin';
import { SkyTarget, useSkyTarget } from '../contexts/SkyTargetContext';
import { prefersReducedMotion } from '../utils/prefersReducedMotion';
import { buildSimbadConeSearchUrl, normalizeRa } from '../utils/simbad';
import { coneSearchResultsPath } from '../utils/coneSearch';
import { CloseIcon } from './icons/CloseIcon';
import { LinkOutIcon } from './icons/LinkOutIcon';

type AllSkyMapProps = SkyExplorerProps & {
  appliedBand: string;
  setAppliedBand: (band: string) => void;
  appliedRange: number[];
  setAppliedRange: (fluxes: number[]) => void;
  visibleSources: SkySource[];
  /** Called with the ids of every source (filtered or not) within the map's current field of
   * view, once the camera settles; only called when that set actually changes. */
  setInViewIds: (ids: Set<string>) => void;
  /** Called whenever the map's load status changes, so SkyExplorer can fall back to filtering
   * the table itself when the map can't load (see SkyExplorer's fallbackCone). */
  onLoadStatusChange: (status: AladinLoadStatus) => void;
};

// Height of the map's area when it's failed to load. Provides enough space for its error message
// and the filter menu, so the table (which SkyExplorer then filters by cone search itself) isn't
// pushed so far below an empty map. The Aladin container itself keeps its full size, just taken
// out of the layout (see the render below), so a late-loading Aladin still measures a full-size map.
const FAILED_MAP_HEIGHT = 200;

interface HoveredSource {
  name: string;
  ra: number;
  dec: number;
  /** Which side of the marker the tooltip is anchored to, and how far from it;
   * lets the tooltip flip to the marker's left near the right edge instead of
   * overflowing the (overflow: hidden) all-sky-wrapper. */
  horizontal: { side: 'left' | 'right'; offset: number };
  /** Same idea as horizontal, but for the bottom edge: flips the tooltip to sit above the marker
   * instead of below it near the bottom edge. There's no analogous top-edge check because the
   * tooltip's default ('top') anchoring already starts below the cursor, so it can't overflow
   * upward regardless of how close to the top edge the marker is. */
  vertical: { side: 'top' | 'bottom'; offset: number };
}

// Rough upper bound on the tooltip's rendered width (name + RA/Dec lines), used to decide
// whether anchoring it to the marker's right edge would run it past the container's edge.
const TOOLTIP_WIDTH_ESTIMATE = 180;

// Rough upper bound on the tooltip's rendered height (name + RA/Dec lines), used to decide
// whether anchoring it below the marker would run it past the container's bottom edge.
const TOOLTIP_HEIGHT_ESTIMATE = 70;

// How long the camera has to sit still (no pan/zoom/resize) before the in-view source set is
// recomputed. The view changes on nearly every frame of a drag or scroll, so recomputing (and
// re-rendering the parent) on each one would make panning choppy.
const IN_VIEW_DEBOUNCE_MS = 150;

// How long to let Aladin finish resizing its renderer (debounced by a few ms internally) once it
// has re-measured its container, before moving to a search target; see the skyTarget effect.
const ALADIN_RESIZE_SETTLE_MS = 50;

// Upper bound on waiting for Aladin to pick up its container's real size before moving to a
// search target anyway, so a missed resize can never leave a search unapplied.
const TARGET_SIZE_WAIT_LIMIT_MS = 1000;

// How far (px) anything at the view's edge has to move before the in-view set is recomputed;
// see the view-watcher effect.
const VIEW_CHANGE_THRESHOLD_PX = 1;

// Gap (px) between a marker and the tooltip/popup anchored to it; matches the hover tooltip's.
const TOOLTIP_OFFSET = 12;

// Matches the pinned object's marker ring (--bg-so-orange); Aladin draws on a canvas, so it can't
// read the CSS variable itself.
const CONE_OUTLINE_COLOR = '#f26522';

/** Horizontal field of view (Aladin's setFov is the view's width) that fits a cone of the given
 * radius, with some margin, inside the view's shorter side. */
function fovForCone(radiusDeg: number, viewWidth: number, viewHeight: number) {
  const aspect = viewWidth > 0 && viewHeight > 0 ? viewWidth / viewHeight : 1;
  return 2 * radiusDeg * CONE_SEARCH_FOV_MARGIN * Math.max(1, aspect);
}

// Creates a shape function for Aladin's catalogs used to update the marker color
const getShapeFunction =
  (appliedBand: string) =>
  (source: { x: number; y: number }, canvasCtx: CanvasRenderingContext2D) => {
    canvasCtx.beginPath();
    canvasCtx.arc(source.x, source.y, 4, 0, 2 * Math.PI, false);
    canvasCtx.closePath();
    // Sets AllSkyMap marker colors to the filter's applied freq band, if selected
    // and defined in FREQUENCY_COLORS
    const freq = Number(appliedBand.split('_')[1]);
    canvasCtx.fillStyle =
      FREQUENCY_COLORS[frequencyKey(freq)] ?? SO_FALLBACK_COLOR;
    canvasCtx.globalAlpha = 0.8;
    canvasCtx.fill();
  };

/**
 * Renders every source's (RA, Dec) position on an all-sky Mollweide projection using
 * Aladin Lite (loaded globally as window.A by loadAladinScript in utils/initAladin.ts);
 * see AladinViewer.tsx for the same pattern used on the Source page
 */
function AllSkyMap({
  sources,
  bands,
  title = 'Sources by position',
  subtitle = "Click a source's marker to preview its light curve",
  height = 600,
  onSourceClick,
  appliedBand,
  setAppliedBand,
  appliedRange,
  setAppliedRange,
  visibleSources,
  setInViewIds,
  onLoadStatusChange,
}: AllSkyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);
  // The initial, whole-sky field of view; the most a cone search will zoom out to.
  const allSkyFovRef = useRef(360);
  const catalogRef = useRef<Catalog | null>(null);

  // setClickedSourceId isn't guaranteed to be a stable reference across every render (its
  // caller may recreate it), so keep it in a ref for the init effect below to read. Putting it
  // directly in the init effect's deps would tear down and recreate the entire Aladin/WebGL
  // instance on nearly every re-render. But the catalog-rebuild effect doesn't rerun when that
  // happens bc its own deps are unchanged, so the fresh instance would be left with no markers.
  // The ref lets the init effect depend on nothing while always calling the current callback.
  const setClickedSourceIdRef = useRef(onSourceClick);
  setClickedSourceIdRef.current = onSourceClick;

  const [loadStatus, setLoadStatus] = useState<AladinLoadStatus>('loading');
  useEffect(() => {
    onLoadStatusChange(loadStatus);
  }, [loadStatus, onLoadStatusChange]);
  // Bumped each time a viewer is (re)created, so the catalog effects below re-apply to it
  const [viewerGeneration, setViewerGeneration] = useState(0);
  // Aladin can't be torn down, so rather than rebuilding on our own after a lost context, show an
  // overlay and let the user choose when to rebuild (see WebGLContextLostOverlay)
  const {
    isContextLost,
    recoveryCount: contextRecoveryCount,
    recover,
  } = useWebGLContextRecovery(containerRef, { autoRecover: false });
  const [hoveredSource, setHoveredSource] = useState<HoveredSource | null>(
    null
  );
  // Aladin's fullscreen mode (with the default realFullscreen: false) doesn't use the browser's
  // real Fullscreen API; instead, it makes the container div position:fixed and covers the whole
  // viewport via a CSS class. That means xyMouseCoords (already relative to the container's own
  // top-left) become viewport-relative too, but our tooltip's own position:absolute is anchored
  // to all-sky-wrapper, a box that no longer corresponds to where the map is actually rendered
  // once the container escapes it via position:fixed. Tracking this lets the tooltip switch to
  // position:fixed itself (see the render below) so it keeps tracking the cursor in both modes.
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Read through refs by scheduleInViewUpdate below so it can keep a permanently stable identity
  // (it's registered once as an Aladin event handler) while still seeing the latest values.
  const setInViewIdsRef = useRef(setInViewIds);
  setInViewIdsRef.current = setInViewIds;
  const sourcesRef = useRef(sources);
  sourcesRef.current = sources;
  const lastInViewIdsRef = useRef<Set<string> | null>(null);
  const inViewTimeoutRef = useRef<number | undefined>(undefined);

  // Debounced (see IN_VIEW_DEBOUNCE_MS): each call restarts the timer, so the recompute only runs
  // once the camera has settled. Tests every source rather than just the filtered ones, so a
  // filter change never needs a recompute
  const scheduleInViewUpdate = useCallback(() => {
    window.clearTimeout(inViewTimeoutRef.current);
    inViewTimeoutRef.current = window.setTimeout(() => {
      const aladin = aladinInstanceRef.current;
      const el = containerRef.current;
      if (!aladin || !el) return;

      // Zero while the page is hidden (display:none -> see App.tsx); Aladin can still emit events
      // then, and every source would test as out of view. The camera can't move while hidden, so
      // the last reported set is still correct.
      const viewWidth = el.clientWidth;
      const viewHeight = el.clientHeight;
      if (viewWidth === 0 || viewHeight === 0) return;

      const ids = new Set<string>();
      for (const s of sourcesRef.current) {
        const xy = aladin.world2pix(s.ra, s.dec);
        if (
          xy &&
          xy[0] >= 0 &&
          xy[0] <= viewWidth &&
          xy[1] >= 0 &&
          xy[1] <= viewHeight
        ) {
          ids.add(s.sourceId);
        }
      }

      // Small pans (especially zoomed out) often don't move any source in or out of view; skip
      // re-rendering the parent entirely when that happens.
      const prev = lastInViewIdsRef.current;
      if (
        prev &&
        prev.size === ids.size &&
        [...ids].every((id) => prev.has(id))
      ) {
        return;
      }
      lastInViewIdsRef.current = ids;
      setInViewIdsRef.current(ids);
    }, IN_VIEW_DEBOUNCE_MS);
  }, []);

  // The search target currently pinned on the map (see the skyTarget effect below); null
  // once dismissed. Mirrored into a ref for positionTargetPopup, for the same reason as above.
  const [pinnedTarget, setPinnedTarget] = useState<SkyTarget | null>(null);
  const pinnedTargetRef = useRef(pinnedTarget);
  pinnedTargetRef.current = pinnedTarget;
  const targetMarkerRef = useRef<HTMLDivElement | null>(null);
  const targetPopupRef = useRef<HTMLDivElement | null>(null);

  // Mirrored for positionTargetPopup, which runs outside React's render cycle (see below).
  const isFullscreenRef = useRef(isFullscreen);
  isFullscreenRef.current = isFullscreen;

  // Keeps the pinned target's marker/popup over its sky position, writing styles straight to the
  // DOM since it runs every frame (see the loop effect below); React state would re-render this
  // whole component per frame. The popup flips to the marker's other side near the right/bottom
  // edges, like the hover tooltip, but measures itself rather than estimating.
  const positionTargetPopup = useCallback(() => {
    const aladin = aladinInstanceRef.current;
    const el = containerRef.current;
    const marker = targetMarkerRef.current;
    const popup = targetPopupRef.current;
    const target = pinnedTargetRef.current;
    // No marker for a cone search: the drawn circle and Aladin's own center reticle mark it.
    if (!aladin || !el || !popup || !target) return;

    // world2pix is relative to the Aladin container, but the marker/popup are positioned within
    // all-sky-wrapper, where the container sits below the header, so shift by the container's
    // offset. In fullscreen both are viewport-relative (see isFullscreen above), so no shift.
    // Measured against the popup's containing block rather than via el.offsetLeft/offsetTop,
    // since the container's offsetParent is its (positioned) webgl-context-lost-host wrapper, not
    // all-sky-wrapper.
    let shiftX = 0;
    let shiftY = 0;
    const containingBlock = popup.offsetParent;
    if (!isFullscreenRef.current && containingBlock) {
      const elRect = el.getBoundingClientRect();
      const blockRect = containingBlock.getBoundingClientRect();
      shiftX = elRect.left - blockRect.left - containingBlock.clientLeft;
      shiftY = elRect.top - blockRect.top - containingBlock.clientTop;
    }
    const viewWidth = el.clientWidth;
    const viewHeight = el.clientHeight;
    const xy = aladin.world2pix(target.ra, target.dec);
    const isInView =
      xy !== null &&
      xy[0] >= 0 &&
      xy[0] <= viewWidth &&
      xy[1] >= 0 &&
      xy[1] <= viewHeight;
    // Hidden rather than unmounted while panned out of view, so it reappears on panning back.
    const visibility = isInView ? 'visible' : 'hidden';
    if (popup.style.visibility !== visibility) {
      popup.style.visibility = visibility;
      if (marker) marker.style.visibility = visibility;
    }
    if (!isInView) return;

    const [x, y] = xy;
    const flipLeft = x + TOOLTIP_OFFSET + popup.offsetWidth > viewWidth;
    const flipUp = y + TOOLTIP_OFFSET + popup.offsetHeight > viewHeight;
    const popupX = flipLeft
      ? x - TOOLTIP_OFFSET - popup.offsetWidth
      : x + TOOLTIP_OFFSET;
    const popupY = flipUp
      ? y - TOOLTIP_OFFSET - popup.offsetHeight
      : y + TOOLTIP_OFFSET;
    if (marker) {
      marker.style.left = `${shiftX + x}px`;
      marker.style.top = `${shiftY + y}px`;
    }
    popup.style.left = `${shiftX + popupX}px`;
    popup.style.top = `${shiftY + popupY}px`;
  }, []);

  // Initialize the Aladin viewer once; it's never torn down for the lifetime of this
  // component (see App.tsx, which keeps Main mounted across navigation). The one exception is
  // when the user reloads it after the browser killed its WebGL context, in which case this
  // reruns to build a fresh viewer in its place.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const stopInit = initAladin(
      (A) => {
        // Clear out the previous viewer's DOM and any state tied to it when rebuilding after a
        // lost context. Aladin Lite has no teardown API, so the old instance itself can't be freed.
        el.replaceChildren();
        setHoveredSource(null);
        setIsFullscreen(false);
        // calculate a FOV based on user's viewport width to enforce full [360,180] on load
        const fov =
          window.innerWidth < height
            ? 360 / (window.innerWidth / height)
            : 360 * (window.innerWidth / height);
        const aladin = A.aladin(el, {
          fov,
          cooFrame: 'equatorial',
          projection: 'MOL',
        });
        // for good measure, in case aladin ignores the init structure
        aladin.setFov(fov);
        aladinInstanceRef.current = aladin;
        allSkyFovRef.current = fov;

        aladin.on('objectClicked', (object) => {
          const sourceId = object?.data?.sourceId;
          if (typeof sourceId === 'string') {
            setClickedSourceIdRef.current(sourceId);
          }
        });

        aladin.on('objectHovered', (object, xyMouseCoords) => {
          const name = object.data?.name;
          if (
            typeof name === 'string' &&
            typeof object.ra === 'number' &&
            typeof object.dec === 'number'
          ) {
            const containerWidth = containerRef.current?.clientWidth ?? 0;
            const containerHeight = containerRef.current?.clientHeight ?? 0;
            const wouldOverflowRight =
              xyMouseCoords.x + TOOLTIP_WIDTH_ESTIMATE + 12 > containerWidth;
            const wouldOverflowBottom =
              xyMouseCoords.y + TOOLTIP_HEIGHT_ESTIMATE + 12 > containerHeight;
            setHoveredSource({
              name,
              ra: object.ra,
              dec: object.dec,
              horizontal: wouldOverflowRight
                ? { side: 'right', offset: containerWidth - xyMouseCoords.x }
                : { side: 'left', offset: xyMouseCoords.x },
              vertical: wouldOverflowBottom
                ? { side: 'bottom', offset: containerHeight - xyMouseCoords.y }
                : { side: 'top', offset: xyMouseCoords.y },
            });
          }
        });
        aladin.on('objectHoveredStop', () => setHoveredSource(null));

        // The resulting size change is picked up by the view watcher below.
        aladin.on('fullScreenToggled', setIsFullscreen);

        setLoadStatus('ready');
        setViewerGeneration((generation) => generation + 1);
      },
      () => setLoadStatus('failed')
    );

    return () => {
      stopInit();
      // On a reload, stop every other effect (which read this ref) from acting on the dead viewer
      // while the new one is still being created; they re-run once it's ready (viewerGeneration).
      aladinInstanceRef.current = null;
    };
    // This must only run once for the component's whole lifetime, aside from a reload (see
    // setClickedSourceIdRef comment above for why setClickedSourceId itself isn't a dependency
    // here).
  }, [contextRecoveryCount]);

  // Recomputes the in-view set whenever the view actually changes, by checking its center, zoom
  // and size every frame, rather than relying on Aladin's positionChanged/zoomChanged events.
  // zoomChanged only fires when the reported FOV changes, and that is capped at 360°, while the
  // zoom itself keeps going (zoom factor ~1 -> 2, shrinking the sky ellipse into view). So the
  // last event of a full zoom-out came while the top and bottom of the sky were still off-screen,
  // and the table kept that stale set (e.g. 9-15 of 16 sources, with all 16 visible). Checking
  // every frame covers every way the view can change: drag, scroll, inertia, the zoom buttons,
  // fullscreen, resizing and programmatic moves.
  //
  // Changes too small to see are ignored: Aladin eases a scroll-zoom out over a tail of a second
  // or more of sub-pixel steps, and counting those as movement kept restarting the debounce, so
  // the table updated well after the map had visibly stopped. Instead, the view is compared with
  // where it was at the last recompute, and a new one is only scheduled once something at the
  // view's edge has moved by at least VIEW_CHANGE_THRESHOLD_PX since then (comparing with the last
  // recompute rather than the previous frame means a slow, steady pan still adds up and
  // triggers). The final in-view set is therefore always within a pixel of the settled view.
  // Keyed on viewerGeneration so it switches over to the new viewer after a reload.
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin) return;
    let frame = 0;
    let lastView: {
      ra: number;
      dec: number;
      zoom: number;
      width: number;
      height: number;
    } | null = null;
    const watchView = () => {
      const el = containerRef.current;
      // Skipped while the page is hidden (display:none, see App.tsx): nothing can change then
      if (el && el.clientWidth > 0) {
        const width = el.clientWidth;
        const height = el.clientHeight;
        const zoom = aladin.getZoomFactor();
        let hasMoved =
          !lastView || width !== lastView.width || height !== lastView.height;
        if (!hasMoved && lastView) {
          // How far the last recompute's center has drifted from the view's center (pan), and how
          // far a zoom by this ratio moves the view's edges
          const xy = aladin.world2pix(lastView.ra, lastView.dec);
          const panPx = xy
            ? Math.hypot(xy[0] - width / 2, xy[1] - height / 2)
            : Infinity;
          const zoomPx =
            (Math.abs(1 - zoom / lastView.zoom) * Math.max(width, height)) / 2;
          hasMoved =
            panPx >= VIEW_CHANGE_THRESHOLD_PX ||
            zoomPx >= VIEW_CHANGE_THRESHOLD_PX;
        }
        if (hasMoved) {
          const [ra, dec] = aladin.getRaDec();
          lastView = { ra, dec, zoom, width, height };
          scheduleInViewUpdate();
        }
      }
      frame = window.requestAnimationFrame(watchView);
    };
    frame = window.requestAnimationFrame(watchView);
    return () => window.cancelAnimationFrame(frame);
  }, [viewerGeneration, scheduleInViewUpdate]);

  // Repopulate the sources catalog whenever the source list changes. Relies on the caller
  // (Main.tsx) memoizing `sources` so this doesn't refire on unrelated re-renders - this
  // component stays mounted for the whole session now (see App.tsx), so an unmemoized caller
  // would otherwise retrigger a full catalog teardown/rebuild on every re-render, including
  // ones that happen while hidden (display:none), which Aladin doesn't reliably recover from.
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || !window.A) return;

    aladin.removeLayers();

    const catalog = window.A.catalog({
      name: 'All sources',
      shape: getShapeFunction(''),
    });
    aladin.addCatalog(catalog);
    catalog.addSources(
      sources.map((s) =>
        window.A!.source(s.ra, s.dec, {
          sourceId: s.sourceId,
          name: s.name,
        })
      )
    );
    catalogRef.current = catalog;
    // A new source list means a new in-view set even if the camera hasn't moved; this also
    // produces the initial set once Aladin is ready.
    scheduleInViewUpdate();
  }, [sources, viewerGeneration, scheduleInViewUpdate]);

  // Applies the derived visible set to the Aladin catalog. Re-runs whenever `visibleSources`
  // changes, which includes right after the catalog-rebuild effect above runs (since that
  // effect shares the `sources` and `viewerGeneration` dependencies), so a newly rebuilt catalog
  // picks the active filter back up instead of momentarily showing every source.
  useEffect(() => {
    const catalog = catalogRef.current;
    if (!catalog) return;
    const visibleIds = new Set(visibleSources.map((s) => s.sourceId));
    catalog.setShape(getShapeFunction(appliedBand));
    catalog.getSources().forEach((s) => {
      const isVisible = visibleIds.has(s.data?.sourceId);
      if (isVisible) {
        s.show();
      } else {
        s.hide();
      }
    });
  }, [visibleSources, appliedBand, viewerGeneration]);

  // Centers and zooms on a target from the navigation bar's catalog or cone search, then pins a
  // popup (position and a link-out) to it until dismissed. A named object gets a
  // fixed zoom; a cone is zoomed to fit inside the view (see fovForCone). Keyed on
  // requestId (tracked in a ref) so a target set before Aladin finished initializing is applied
  // once it's ready, without re-applying a stale one later and yanking the camera back. A new
  // target arriving while the viewer's WebGL context is lost (e.g. searched from another page
  // while this one was hidden) reloads the viewer, since the search is the user asking to see the
  // map; it's then applied to the new viewer once that's ready (viewerGeneration).
  const { skyTarget } = useSkyTarget();
  const appliedTargetIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (!skyTarget) return;
    if (appliedTargetIdRef.current === skyTarget.requestId) return;
    if (isContextLost) {
      recover();
      return;
    }
    const aladin = aladinInstanceRef.current;
    if (!aladin) return;
    appliedTargetIdRef.current = skyTarget.requestId;

    let applied = false;
    const applyTarget = () => {
      applied = true;
      aladin.gotoRaDec(normalizeRa(skyTarget.ra), skyTarget.dec);
      const el = containerRef.current;
      aladin.setFov(
        skyTarget.kind === 'cone'
          ? Math.min(
              fovForCone(
                skyTarget.radiusDeg,
                el?.clientWidth ?? 0,
                el?.clientHeight ?? 0
              ),
              allSkyFovRef.current
            )
          : CATALOG_SEARCH_FOV_DEG
      );
      // Aladin doesn't reliably emit positionChanged/zoomChanged for programmatic moves, so
      // recompute the in-view set (and so the table) explicitly rather than relying on them.
      scheduleInViewUpdate();
      setPinnedTarget(skyTarget);
      containerRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'nearest',
      });
    };

    // A search from another route navigates home in the same commit that sets the target, so
    // this page was display:none until just now, which Aladin's resize handling recorded as a
    // 1x1 view. It only re-measures after the browser's next layout pass, then resizes its
    // renderer on a short debounce, and that resize recomputes the zoom for the new size. A
    // setFov made before all that is computed against the 1x1 view and comes out as the whole
    // sky. So wait until Aladin's view size (getSize, updated as soon as it re-measures) matches
    // the container's, then give the debounced renderer resize a moment before moving.
    const startedAt = performance.now();
    let frame = 0;
    let settleTimeout: number | undefined;
    const applyOnceSized = (isFirstCheck: boolean) => {
      const el = containerRef.current;
      const [aladinWidth, aladinHeight] = aladin.getSize();
      // Measured the same way Aladin does (floored bounding-box size)
      const rect = el?.getBoundingClientRect();
      const isSized =
        !!rect &&
        rect.width > 0 &&
        aladinWidth === Math.floor(rect.width) &&
        aladinHeight === Math.floor(rect.height);
      if (isSized && isFirstCheck) {
        // Already visible at its real size (searched from the home page): nothing pending
        applyTarget();
      } else if (
        isSized ||
        performance.now() - startedAt > TARGET_SIZE_WAIT_LIMIT_MS
      ) {
        settleTimeout = window.setTimeout(applyTarget, ALADIN_RESIZE_SETTLE_MS);
      } else {
        frame = window.requestAnimationFrame(() => applyOnceSized(false));
      }
    };
    applyOnceSized(true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(settleTimeout);
      // The move never happened, so let the next run (e.g. StrictMode's re-run) apply it.
      if (!applied) appliedTargetIdRef.current = null;
    };
  }, [
    skyTarget,
    viewerGeneration,
    isContextLost,
    recover,
    scheduleInViewUpdate,
  ]);

  // Draws a pinned cone search's cone as a circle on the map, removed again once the result is
  // dismissed or replaced. Also re-runs after the catalog-rebuild effect above (shared `sources`
  // and `viewerGeneration` dependencies), since that effect's removeLayers() detaches every
  // overlay, this one included, and a reloaded viewer starts out without it.
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || !window.A || pinnedTarget?.kind !== 'cone') return;
    const overlay = window.A.graphicOverlay({
      name: 'Cone search',
      color: CONE_OUTLINE_COLOR,
      lineWidth: 2,
    });
    aladin.addOverlay(overlay);
    overlay.addFootprints(
      window.A.circle(pinnedTarget.ra, pinnedTarget.dec, pinnedTarget.radiusDeg)
    );
    return () => aladin.removeOverlay(overlay);
  }, [pinnedTarget, sources, viewerGeneration]);

  // Places a newly pinned popup before it's first painted (so it never flashes at the container's
  // top-left), and again when fullscreen toggles since its coordinate space changes with it.
  useLayoutEffect(() => {
    positionTargetPopup();
  }, [pinnedTarget, isFullscreen, positionTargetPopup]);

  // Re-positions the pinned popup every frame while one is shown, rather than on Aladin's
  // positionChanged/zoomChanged: those are throttled to ~100ms, and zoomChanged doesn't follow
  // the animated zoom that continues after a scroll, so positions read from them lag behind or
  // end up stale. One world2pix call per frame is cheap, and requestAnimationFrame
  // pauses on its own while the browser tab is in the background.
  useEffect(() => {
    if (!pinnedTarget) return;
    let frame = 0;
    const tick = () => {
      positionTargetPopup();
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [pinnedTarget, positionTargetPopup]);

  // A reloaded viewer starts back at the whole sky; if a search result is still pinned, clear the
  // applied marker so the skyTarget effect moves the new viewer back to it (a pinned target is
  // always the latest skyTarget, so this can't resurrect a dismissed or replaced one).
  const handleReload = useCallback(() => {
    if (pinnedTargetRef.current) appliedTargetIdRef.current = null;
    recover();
  }, [recover]);

  // Stable identities so the memoized SourceFluxFilter doesn't re-render just because AllSkyMap
  // re-rendered for an unrelated reason (e.g. hoveredSource changing on every mouse move). The
  // setters are SkyExplorer's useState setters, so they never change either.
  const handleApplyFilter = useCallback(
    (band: string, range: number[]) => {
      setAppliedBand(band);
      setAppliedRange(range);
    },
    [setAppliedBand, setAppliedRange]
  );

  const handleClearFilter = useCallback(() => {
    setAppliedBand('');
    setAppliedRange(MIN_MAX_FLUX_VALUES);
  }, [setAppliedBand, setAppliedRange]);

  return (
    <div className="all-sky-wrapper">
      <div className="all-sky-header">
        <div className="title-container">
          <p className="title-text">{title}</p>
          <p className="subtitle-text">{subtitle}</p>
        </div>
        <SourceFluxFilter
          sources={sources}
          bands={bands}
          visibleCount={visibleSources.length}
          appliedBand={appliedBand}
          appliedRange={appliedRange}
          onApply={handleApplyFilter}
          onClear={handleClearFilter}
        />
      </div>
      <div
        className="webgl-context-lost-host"
        style={
          loadStatus === 'failed' ? { height: FAILED_MAP_HEIGHT } : undefined
        }
      >
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height,
            visibility: loadStatus === 'ready' ? 'visible' : 'hidden',
            ...(loadStatus === 'failed' && {
              position: 'absolute',
              top: 0,
              left: 0,
            }),
          }}
        />
        <SkyMapStatusOverlay status={loadStatus} />
        {isContextLost && <WebGLContextLostOverlay onReload={handleReload} />}
      </div>
      {hoveredSource && (
        <div
          className="all-sky-tooltip"
          style={{
            // In fullscreen, the Aladin container (and so xyMouseCoords, which these values are
            // derived from) is viewport-relative rather than relative to all-sky-wrapper - see
            // isFullscreen's comment above - so the tooltip has to switch to matching
            // viewport-relative positioning too, or it ends up anchored to a box that no longer
            // lines up with where the map is actually rendered.
            position: isFullscreen ? 'fixed' : 'absolute',
            [hoveredSource.horizontal.side]:
              hoveredSource.horizontal.offset + 12,
            [hoveredSource.vertical.side]: hoveredSource.vertical.offset + 12,
          }}
        >
          <div className="all-sky-tooltip-name">{hoveredSource.name}</div>
          <div>RA: {hoveredSource.ra.toFixed(3)}°</div>
          <div>Dec: {hoveredSource.dec.toFixed(3)}°</div>
        </div>
      )}
      {pinnedTarget && (
        <>
          {pinnedTarget.kind === 'object' && (
            <div
              ref={targetMarkerRef}
              className="all-sky-target-marker"
              aria-hidden="true"
              // Same fullscreen coordinate-space switch as the hover tooltip above.
              style={{ position: isFullscreen ? 'fixed' : 'absolute' }}
            />
          )}
          <div
            ref={targetPopupRef}
            className="all-sky-tooltip all-sky-target-popup"
            role="group"
            aria-label={
              pinnedTarget.kind === 'cone'
                ? 'Cone search result'
                : `Search result: ${pinnedTarget.name}`
            }
            style={{ position: isFullscreen ? 'fixed' : 'absolute' }}
          >
            <div className="all-sky-target-popup-header">
              <div className="all-sky-tooltip-name">
                {pinnedTarget.kind === 'cone'
                  ? 'Cone search'
                  : pinnedTarget.name}
              </div>
              <button
                type="button"
                className="all-sky-target-popup-close"
                aria-label="Dismiss search result"
                onClick={() => setPinnedTarget(null)}
              >
                <CloseIcon width={12} height={12} />
              </button>
            </div>
            <div>RA: {pinnedTarget.ra.toFixed(3)}°</div>
            <div>Dec: {pinnedTarget.dec.toFixed(3)}°</div>
            {pinnedTarget.kind === 'cone' && (
              <div>Radius: {pinnedTarget.radiusDeg.toFixed(3)}°</div>
            )}
            {pinnedTarget.kind === 'cone' ? (
              // The standalone results page, for anyone who just wants a plain table of the
              // sources in the cone (the table below the map includes the view's corners too)
              <Link
                className="all-sky-target-popup-link"
                to={coneSearchResultsPath(pinnedTarget)}
                target="_blank"
              >
                Open results table
                <LinkOutIcon width={12} height={12} />
              </Link>
            ) : (
              <a
                className="all-sky-target-popup-link"
                href={buildSimbadConeSearchUrl(
                  pinnedTarget.ra,
                  pinnedTarget.dec,
                  CATALOG_SEARCH_CONE_RADIUS_ARCMIN
                )}
                target="_blank"
                rel="noreferrer"
              >
                SIMBAD cone search ({CATALOG_SEARCH_CONE_RADIUS_ARCMIN}′)
                <LinkOutIcon width={12} height={12} />
              </a>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// Memoized so SkyExplorer re-rendering for table-only reasons (a new in-view set, which never
// changes any of this component's props) doesn't re-render the map.
export default memo(AllSkyMap);

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import SourceFluxFilter from './SourceFluxFilter';
import {
  CATALOG_SEARCH_CONE_RADIUS_ARCMIN,
  CATALOG_SEARCH_FOV_DEG,
  MIN_MAX_FLUX_VALUES,
} from '../configs/constants';
import {
  FREQUENCY_COLORS,
  SO_FALLBACK_COLOR,
  frequencyKey,
} from '../configs/socolors';
import { SkyExplorerProps } from './SkyExplorer';
import { SkySource } from '../types';
import { SkyTarget, useSkyTarget } from '../contexts/SkyTargetContext';
import { prefersReducedMotion } from '../utils/prefersReducedMotion';
import { buildSimbadConeSearchUrl } from '../utils/simbad';
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
};

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

// How long the camera has to sit still (no pan/zoom/resize events) before the in-view source
// set is recomputed. Aladin fires positionChanged/zoomChanged on nearly every frame of a drag or
// scroll, so recomputing (and re-rendering the parent) on each one would make panning choppy.
const IN_VIEW_DEBOUNCE_MS = 150;

// Gap (px) between a marker and the tooltip/popup anchored to it; matches the hover tooltip's.
const TOOLTIP_OFFSET = 12;

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
 * Aladin Lite (loaded globally as window.A via the script tag in index.html);
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
}: AllSkyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);
  const catalogRef = useRef<Catalog | null>(null);

  // setClickedSourceId isn't guaranteed to be a stable reference across every render (its
  // caller may recreate it), so keep it in a ref for the init effect below to read. Putting it
  // directly in the init effect's deps would tear down and recreate the entire Aladin/WebGL
  // instance on nearly every re-render. But the catalog-rebuild effect doesn't rerun when that
  // happens bc its own deps are unchanged, so the fresh instance would be left with no markers.
  // The ref lets the init effect depend on nothing while always calling the current callback.
  const setClickedSourceIdRef = useRef(onSourceClick);
  setClickedSourceIdRef.current = onSourceClick;

  const [isDataReady, setIsDataReady] = useState(false);
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

  // The catalog-search target currently pinned on the map (see the skyTarget effect below); null
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
    if (!aladin || !el || !marker || !popup || !target) return;

    // world2pix is relative to the Aladin container, but the marker/popup are positioned within
    // all-sky-wrapper, where the container sits below the header, so shift by the container's
    // offset. In fullscreen both are viewport-relative (see isFullscreen above), so no shift.
    const shiftX = isFullscreenRef.current ? 0 : el.offsetLeft;
    const shiftY = isFullscreenRef.current ? 0 : el.offsetTop;
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
    if (marker.style.visibility !== visibility) {
      marker.style.visibility = popup.style.visibility = visibility;
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
    marker.style.left = `${shiftX + x}px`;
    marker.style.top = `${shiftY + y}px`;
    popup.style.left = `${shiftX + popupX}px`;
    popup.style.top = `${shiftY + popupY}px`;
  }, []);

  // Initialize the Aladin viewer once; it's never torn down for the lifetime of this
  // component (see App.tsx, which keeps Main mounted across navigation).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!window.A) {
      console.error('Aladin API is not loaded.');
      return;
    }

    let cancelled = false;

    window.A.init
      .then(() => {
        if (cancelled || !window.A) return;
        // calculate a FOV based on user's viewport width to enforce full [360,180] on load
        const fov =
          window.innerWidth < height
            ? 360 / (window.innerWidth / height)
            : 360 * (window.innerWidth / height);
        const aladin = window.A.aladin(el, {
          fov,
          cooFrame: 'equatorial',
          projection: 'MOL',
        });
        // for good measure, in case aladin ignores the init structure
        aladin.setFov(fov);
        aladinInstanceRef.current = aladin;

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

        aladin.on('fullScreenToggled', (isInFullscreen) => {
          setIsFullscreen(isInFullscreen);
          // The view's size changes along with fullscreen, which changes what's in view.
          scheduleInViewUpdate();
        });

        // Note that Aladin's on() keeps only one callback per event (a later on() for the same
        // event replaces this one), so any other reaction to these has to go through it.
        aladin.on('positionChanged', scheduleInViewUpdate);
        aladin.on('zoomChanged', scheduleInViewUpdate);
        aladin.on('resizeChanged', scheduleInViewUpdate);

        setIsDataReady(true);
      })
      .catch(() => {
        console.error('Aladin API failed to initialize.');
      });

    return () => {
      cancelled = true;
    };
    // This must only run once for the component's whole lifetime (see setClickedSourceIdRef
    // comment above for why setClickedSourceId itself isn't a dependency here);
    // scheduleInViewUpdate has a permanently stable identity, so listing it doesn't change that.
  }, [scheduleInViewUpdate]);

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
  }, [sources, isDataReady, scheduleInViewUpdate]);

  // Applies the derived visible set to the Aladin catalog. Re-runs whenever `visibleSources`
  // changes, which includes right after the catalog-rebuild effect above runs (since that
  // effect shares the `sources` dependency), so a newly rebuilt catalog picks the active filter
  // back up instead of momentarily showing every source.
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
  }, [visibleSources, appliedBand]);

  // Centers and zooms on a target resolved by the navigation bar's catalog search, then pins a
  // marker and popup (name, position, SIMBAD link-out) to it until dismissed. Keyed on
  // requestId (tracked in a ref) so a target set before Aladin finished initializing is applied
  // once it's ready, without re-applying a stale one later and yanking the camera back.
  const { skyTarget } = useSkyTarget();
  const appliedTargetIdRef = useRef<number | null>(null);
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || !skyTarget) return;
    if (appliedTargetIdRef.current === skyTarget.requestId) return;
    appliedTargetIdRef.current = skyTarget.requestId;

    // A search from another route navigates home in the same commit that sets the target, so
    // this page was display:none until just now; waiting a frame lets Aladin pick up its real
    // size again before moving the camera, which keeps both the zoom and the in-view check
    // below from being computed against a zero-sized view.
    const frame = window.requestAnimationFrame(() => {
      aladin.gotoRaDec(skyTarget.ra, skyTarget.dec);
      aladin.setFov(CATALOG_SEARCH_FOV_DEG);
      // Aladin doesn't reliably emit positionChanged/zoomChanged for programmatic moves, so
      // recompute the in-view set (and so the table) explicitly rather than relying on them.
      scheduleInViewUpdate();
      setPinnedTarget(skyTarget);
      containerRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'nearest',
      });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      // The move never happened, so let the next run (e.g. StrictMode's re-run) apply it.
      appliedTargetIdRef.current = null;
    };
  }, [skyTarget, isDataReady, scheduleInViewUpdate]);

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
        ref={containerRef}
        style={{
          width: '100%',
          height,
          visibility: isDataReady ? 'visible' : 'hidden',
        }}
      />
      {!isDataReady && (
        <div className="lightcurve-loading" style={{ height, width: '100%' }}>
          Loading...
        </div>
      )}
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
          <div
            ref={targetMarkerRef}
            className="all-sky-target-marker"
            aria-hidden="true"
            // Same fullscreen coordinate-space switch as the hover tooltip above.
            style={{ position: isFullscreen ? 'fixed' : 'absolute' }}
          />
          <div
            ref={targetPopupRef}
            className="all-sky-tooltip all-sky-target-popup"
            role="group"
            aria-label={`Search result: ${pinnedTarget.name}`}
            style={{ position: isFullscreen ? 'fixed' : 'absolute' }}
          >
            <div className="all-sky-target-popup-header">
              <div className="all-sky-tooltip-name">{pinnedTarget.name}</div>
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
          </div>
        </>
      )}
    </div>
  );
}

// Memoized so SkyExplorer re-rendering for table-only reasons (a new in-view set, which never
// changes any of this component's props) doesn't re-render the map.
export default memo(AllSkyMap);

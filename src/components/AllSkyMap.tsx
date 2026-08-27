import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import SourceFluxFilter from './SourceFluxFilter';
import { MIN_MAX_FLUX_VALUES } from '../configs/constants';
import { FREQUENCY_COLORS, SO_FALLBACK_COLOR } from '../configs/socolors';

export interface SkySource {
  sourceId: string;
  ra: number;
  dec: number;
  name: string;
  properties?: {
    median_flux: Record<string, number>;
  };
}

interface AllSkyMapProps {
  sources: SkySource[];
  bands: Set<string>;
  title?: string;
  subtitle?: string;
  height?: number;
  setClickedSourceId: (id: string) => void;
}

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

// Creates a shape function for Aladin's catalogs used to update the marker color
const getShapeFunction =
  (appliedBand: string) =>
  (source: { x: number; y: number }, canvasCtx: CanvasRenderingContext2D) => {
    canvasCtx.beginPath();
    canvasCtx.arc(source.x, source.y, 4, 0, 2 * Math.PI, false);
    canvasCtx.closePath();
    // Sets AllSkyMap marker colors to the filter's applied freq band, if selected
    // and defined in FREQUENCY_COLORS
    canvasCtx.fillStyle = FREQUENCY_COLORS[appliedBand] ?? SO_FALLBACK_COLOR;
    canvasCtx.globalAlpha = 0.8;
    canvasCtx.fill();
  };

/**
 * Renders every source's (RA, Dec) position on an all-sky Mollweide projection using
 * Aladin Lite (loaded globally as window.A via the script tag in index.html - see
 * AladinViewer.tsx for the same pattern used on the Source page).
 */
export default function AllSkyMap({
  sources,
  bands,
  title = 'Sources by position',
  subtitle = "Click a source's marker to preview its light curve",
  height = 600,
  setClickedSourceId,
}: AllSkyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);
  const catalogRef = useRef<Catalog | null>(null);
  const [appliedBand, setAppliedBand] = useState('');
  const [appliedRange, setAppliedRange] = useState(MIN_MAX_FLUX_VALUES);

  // setClickedSourceId isn't guaranteed to be a stable reference across every render (its
  // caller may recreate it), so keep it in a ref for the init effect below to read. Putting it
  // directly in the init effect's deps would tear down and recreate the entire Aladin/WebGL
  // instance on nearly every re-render. But the catalog-rebuild effect doesn't rerun when that
  // happens bc its own deps are unchanged, so the fresh instance would be left with no markers.
  // The ref lets the init effect depend on nothing while always calling the current callback.
  const setClickedSourceIdRef = useRef(setClickedSourceId);
  setClickedSourceIdRef.current = setClickedSourceId;

  const [isDataReady, setIsDataReady] = useState(false);
  const [hoveredSource, setHoveredSource] = useState<HoveredSource | null>(
    null
  );
  // Aladin's fullscreen mode (with the default realFullscreen: false) doesn't use the browser's
  // real Fullscreen API; instead, it makes the container div position:fixed and covers the whole
  // viewport via a CSS class. That means xyMouseCoords (already relative to the container's own
  // top-left) become viewport-relative too, but our tooltip's own position:absolute is anchored
  // to all-sky-wrapper - a box that no longer corresponds to where the map is actually rendered
  // once the container escapes it via position:fixed. Tracking this lets the tooltip switch to
  // position:fixed itself (see the render below) so it keeps tracking the cursor in both modes.
  const [isFullscreen, setIsFullscreen] = useState(false);

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
        });

        setIsDataReady(true);
      })
      .catch(() => {
        console.error('Aladin API failed to initialize.');
      });

    return () => {
      cancelled = true;
    };
    // Intentionally empty: this must only run once for the component's whole lifetime (see
    // setClickedSourceIdRef comment above for why setClickedSourceId itself isn't a dependency here).
  }, []);

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
  }, [sources, isDataReady]);

  // The set of sources currently shown on the map. Derived (rather than copied into its own
  // state on "Apply") so that it automatically recomputes if `sources` itself changes (e.g. a
  // refetch) while a filter is active - otherwise a stale filter snapshot would keep hiding
  // markers from the old source list after the catalog below has already been rebuilt with new
  // ones.
  const visibleSources = useMemo(() => {
    if (appliedBand === '') return sources;
    return sources.filter((s) => {
      const flux = s.properties?.median_flux[appliedBand];
      return flux != null && flux >= appliedRange[0] && flux <= appliedRange[1];
    });
  }, [sources, appliedBand, appliedRange]);

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

  // Stable identities so the memoized SourceFluxFilter doesn't re-render just because AllSkyMap
  // re-rendered for an unrelated reason (e.g. hoveredSource changing on every mouse move).
  const handleApplyFilter = useCallback((band: string, range: number[]) => {
    setAppliedBand(band);
    setAppliedRange(range);
  }, []);

  const handleClearFilter = useCallback(() => {
    setAppliedBand('');
    setAppliedRange(MIN_MAX_FLUX_VALUES);
  }, []);

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
    </div>
  );
}

import {
  CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
  useMemo,
} from 'react';
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
  height?: CSSProperties['height'];
  setClickedSourceId: (id: string) => void;
}

interface HoveredSource {
  name: string;
  ra: number;
  dec: number;
  y: number;
  /** Which side of the marker the tooltip is anchored to, and how far from it;
   * lets the tooltip flip to the marker's left near the right edge instead of
   * overflowing the (overflow: hidden) all-sky-wrapper. */
  horizontal: { side: 'left' | 'right'; offset: number };
}

// Rough upper bound on the tooltip's rendered width (name + RA/Dec lines), used to decide
// whether anchoring it to the marker's right edge would run it past the container's edge.
const TOOLTIP_WIDTH_ESTIMATE = 180;

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
        const aladin = window.A.aladin(el, {
          fov: 360,
          cooFrame: 'equatorial',
          projection: 'MOL',
        });
        // fov as an init option is unreliable on this build; set it explicitly.
        aladin.setFov(360);
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
            const wouldOverflowRight =
              xyMouseCoords.x + TOOLTIP_WIDTH_ESTIMATE + 12 > containerWidth;
            setHoveredSource({
              name,
              ra: object.ra,
              dec: object.dec,
              y: xyMouseCoords.y,
              horizontal: wouldOverflowRight
                ? { side: 'right', offset: containerWidth - xyMouseCoords.x }
                : { side: 'left', offset: xyMouseCoords.x },
            });
          }
        });
        aladin.on('objectHoveredStop', () => setHoveredSource(null));

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
            [hoveredSource.horizontal.side]:
              hoveredSource.horizontal.offset + 12,
            top: hoveredSource.y + 12,
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

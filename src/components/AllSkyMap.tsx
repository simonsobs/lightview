import { CSSProperties, useEffect, useRef, useState } from 'react';

export interface SkySource {
  sourceId: string;
  ra: number;
  dec: number;
  name: string;
}

interface AllSkyMapProps {
  sources: SkySource[];
  title?: string;
  subtitle?: string;
  height?: CSSProperties['height'];
  setClickedSourceId: (id: string) => void;
}

interface HoveredSource {
  name: string;
  ra: number;
  dec: number;
  x: number;
  y: number;
}

/**
 * Renders every source's (RA, Dec) position on an all-sky Mollweide projection using
 * Aladin Lite (loaded globally as window.A via the script tag in index.html - see
 * AladinViewer.tsx for the same pattern used on the Source page).
 */
export default function AllSkyMap({
  sources,
  title = 'Sources by position',
  subtitle = "Click a source's marker to preview its light curve",
  height = 600,
  setClickedSourceId,
}: AllSkyMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);

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
            setHoveredSource({
              name,
              ra: object.ra,
              dec: object.dec,
              x: xyMouseCoords.x,
              y: xyMouseCoords.y,
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
      shape: (source, canvasCtx) => {
        canvasCtx.beginPath();
        canvasCtx.arc(source.x, source.y, 4, 0, 2 * Math.PI, false);
        canvasCtx.closePath();
        canvasCtx.fillStyle = '#1f77b4';
        canvasCtx.globalAlpha = 0.8;
        canvasCtx.fill();
      },
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
  }, [sources, isDataReady]);

  return (
    <div className="all-sky-wrapper">
      <div className="title-container">
        <p className="title-text">{title}</p>
        <p className="subtitle-text">{subtitle}</p>
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
          style={{ left: hoveredSource.x + 12, top: hoveredSource.y + 12 }}
        >
          <div className="all-sky-tooltip-name">{hoveredSource.name}</div>
          <div>RA: {hoveredSource.ra.toFixed(3)}°</div>
          <div>Dec: {hoveredSource.dec.toFixed(3)}°</div>
        </div>
      )}
    </div>
  );
}

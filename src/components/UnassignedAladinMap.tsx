import { useEffect, useRef, useState } from 'react';
import { SimbadMatch } from '../types';
import {
  releaseAladinWebGLContext,
  useWebGLContextRecovery,
} from '../hooks/useWebGLContextRecovery';
import { WebGLContextLostOverlay } from './WebGLContextLostOverlay';
import { SkyMapStatusOverlay } from './SkyMapStatusOverlay';
import { AladinLoadStatus, initAladin } from '../utils/initAladin';

type SkyPoint = { ra: number; dec: number };

type UnassignedAladinMapProps = {
  sourceRa: number;
  sourceDec: number;
  survey: string;
  beamRadiusArcmin: number;
  measurements: SkyPoint[];
  nearby: SkyPoint[];
  simbadMatches: SimbadMatch[];
  height?: number;
};

/** Not every SIMBAD match has a position, so filter to plottable ones (and narrowing ra/dec to number) */
function hasPosition(
  match: SimbadMatch
): match is SimbadMatch & { ra: number; dec: number } {
  return Number.isFinite(match.ra) && Number.isFinite(match.dec);
}

const DETECTIONS_COLOR = '#0077BB';
const NEARBY_COLOR = '#F26522';
const BEAM_COLOR = '#F26522';
const SIMBAD_COLOR = '#CC3311';
const SIMBAD_SOURCE_SIZE = 18;
const MIN_FOV_DEGREES = 0.05;

/** Escapes untrusted text before handing it to Aladin's popupTitle/popupDesc, which render as
 * raw HTML inside Aladin's own (non-React) popup DOM rather than being escaped by JSX. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Interactive Aladin Lite sky map for a source under cross-matching review: this source's own
 * detections (blue), other nearby still-unmatched candidates (orange), the configured search
 * radius (dashed orange circle), and clickable SIMBAD matches (large red triangles). */
export function UnassignedAladinMap({
  sourceRa,
  sourceDec,
  survey,
  beamRadiusArcmin,
  measurements,
  nearby,
  simbadMatches,
  height = 448,
}: UnassignedAladinMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);
  // Bumped each time a viewer is (re)created, so the catalog-rebuild effect re-applies to it
  const [viewerGeneration, setViewerGeneration] = useState(0);
  // Aladin can't be torn down, so rather than rebuilding on our own after a lost context, show an
  // overlay and let the user choose when to rebuild (see WebGLContextLostOverlay)
  const {
    isContextLost,
    recoveryCount: contextRecoveryCount,
    recover,
  } = useWebGLContextRecovery(containerRef, { autoRecover: false });

  // Free the viewer's WebGL context on unmount (this page remounts per source id), since the
  // viewer itself is never garbage collected
  useEffect(() => {
    const el = containerRef.current;
    return () => {
      if (el) releaseAladinWebGLContext(el);
    };
  }, []);
  const [loadStatus, setLoadStatus] = useState<AladinLoadStatus>('loading');

  // Initializes Aladin once per mount. sourceRa/sourceDec/survey/beamRadiusArcmin are stable for
  // the lifetime of one mount (this page remounts fresh per source id); measurements/nearby/
  // simbadMatches stream in asynchronously afterwards and are applied by the catalog-rebuild
  // effect below instead, so re-running this on every data update isn't needed and would
  // flicker or duplicate the viewer inside the same container. The one exception is when the
  // user reloads it after the browser killed its WebGL context, which builds a fresh viewer.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const stopInit = initAladin(
      (A) => {
        // Clear out the previous viewer's DOM when rebuilding after a lost context; Aladin Lite
        // has no teardown API, so the old instance itself can't be freed
        el.replaceChildren();
        const fov = Math.max((beamRadiusArcmin * 8) / 60, MIN_FOV_DEGREES);
        const aladin = A.aladin(el, { survey, fov });
        aladin.gotoRaDec(sourceRa, sourceDec);
        aladinInstanceRef.current = aladin;
        setLoadStatus('ready');
        setViewerGeneration((generation) => generation + 1);
      },
      () => setLoadStatus('failed')
    );

    return () => {
      stopInit();
      aladinInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contextRecoveryCount]);

  // Rebuilds every overlay/catalog whenever the underlying data changes, e.g. once the
  // asynchronous SIMBAD lookup resolves after the initial render.
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || !window.A) return;

    try {
      aladin.removeLayers();

      const beamOverlay = window.A.graphicOverlay({
        name: 'Configured search radius',
        color: BEAM_COLOR,
        lineWidth: 2,
        lineDash: [5, 4],
      });
      beamOverlay.addFootprints(
        window.A.circle(sourceRa, sourceDec, beamRadiusArcmin / 60)
      );
      aladin.addOverlay(beamOverlay);

      const detectionsCatalog = window.A.catalog({
        name: 'Candidate detections',
        color: DETECTIONS_COLOR,
      });
      measurements.forEach((point) =>
        detectionsCatalog.addSources([
          window.A!.source(point.ra, point.dec, {}),
        ])
      );
      aladin.addCatalog(detectionsCatalog);

      if (nearby.length) {
        const nearbyCatalog = window.A.catalog({
          name: 'Nearby unassigned candidates',
          color: NEARBY_COLOR,
        });
        nearby.forEach((point) =>
          nearbyCatalog.addSources([window.A!.source(point.ra, point.dec, {})])
        );
        aladin.addCatalog(nearbyCatalog);
      }

      const validSimbadMatches = simbadMatches.filter(hasPosition);
      if (validSimbadMatches.length) {
        const simbadCatalog = window.A.catalog({
          name: 'SIMBAD matches',
          color: SIMBAD_COLOR,
          shape: 'triangle',
          sourceSize: SIMBAD_SOURCE_SIZE,
        });
        simbadCatalog.addSources(
          validSimbadMatches.map((match) =>
            window.A!.marker(match.ra, match.dec, {
              popupTitle: escapeHtml(match.identifier || 'SIMBAD object'),
              popupDesc: [
                '<strong>SIMBAD match</strong>',
                `Object type: ${escapeHtml(match.objectType ?? 'Unavailable')}`,
                `ICRS: ${match.ra.toFixed(6)}°, ${match.dec.toFixed(6)}°`,
              ].join('<br>'),
              useMarkerDefaultIcon: false,
            })
          )
        );
        aladin.addCatalog(simbadCatalog);
      }
    } catch (error) {
      console.error('Aladin map overlays could not be added', error);
      setLoadStatus('failed');
    }
  }, [
    viewerGeneration,
    sourceRa,
    sourceDec,
    beamRadiusArcmin,
    measurements,
    nearby,
    simbadMatches,
  ]);

  return (
    <div className="webgl-context-lost-host">
      <div
        ref={containerRef}
        className="unassigned-aladin-container"
        style={{ height }}
        aria-label="Aladin-Lite sky map"
      />
      <SkyMapStatusOverlay status={loadStatus} />
      {isContextLost && <WebGLContextLostOverlay onReload={recover} />}
    </div>
  );
}

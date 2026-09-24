import { useEffect, useRef, useState } from 'react';
import { SimbadMatch } from '../types';

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
const UNAVAILABLE_MESSAGE = 'Interactive sky map is unavailable.';

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
  const [isReady, setIsReady] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState<
    string | undefined
  >(undefined);

  // Initializes Aladin once per mount. sourceRa/sourceDec/survey/beamRadiusArcmin are stable for
  // the lifetime of one mount (this page remounts fresh per source id); measurements/nearby/
  // simbadMatches stream in asynchronously afterwards and are applied by the catalog-rebuild
  // effect below instead, so re-running this on every data update isn't needed and would
  // flicker or duplicate the viewer inside the same container.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (!window.A) {
      console.error('Aladin API is not loaded.');
      setUnavailableMessage(UNAVAILABLE_MESSAGE);
      return;
    }

    let cancelled = false;

    window.A.init
      .then(() => {
        if (cancelled || !window.A) return;
        const fov = Math.max((beamRadiusArcmin * 8) / 60, MIN_FOV_DEGREES);
        const aladin = window.A.aladin(el, { survey, fov });
        aladin.gotoRaDec(sourceRa, sourceDec);
        aladinInstanceRef.current = aladin;
        setIsReady(true);
      })
      .catch((error: unknown) => {
        console.error('Aladin map could not be initialized', error);
        setUnavailableMessage(UNAVAILABLE_MESSAGE);
      });

    return () => {
      cancelled = true;
      aladinInstanceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Rebuilds every overlay/catalog whenever the underlying data changes, e.g. once the
  // asynchronous SIMBAD lookup resolves after the initial render.
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || !window.A || !isReady) return;

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
      console.error('Aladin map could not be initialized', error);
      setUnavailableMessage(UNAVAILABLE_MESSAGE);
    }
  }, [
    isReady,
    sourceRa,
    sourceDec,
    beamRadiusArcmin,
    measurements,
    nearby,
    simbadMatches,
  ]);

  if (unavailableMessage) {
    return (
      <div
        className="unassigned-aladin-container unassigned-aladin-unavailable"
        style={{ height }}
      >
        {unavailableMessage}
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="unassigned-aladin-container"
      style={{ height }}
      aria-label="Aladin-Lite sky map"
    />
  );
}

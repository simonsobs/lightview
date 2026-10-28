import { useEffect, useRef, useState } from 'react';
import { SourceResponse } from '../types';
import {
  releaseAladinWebGLContext,
  useWebGLContextRecovery,
} from '../hooks/useWebGLContextRecovery';
import { WebGLContextLostOverlay } from './WebGLContextLostOverlay';
import { SkyMapStatusOverlay } from './SkyMapStatusOverlay';
import { AladinLoadStatus, initAladin } from '../utils/initAladin';

type AladinViewerProps = {
  source: SourceResponse;
  nearbySources: SourceResponse[];
};

export function AladinViewer({ source, nearbySources }: AladinViewerProps) {
  const aladinContainerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);
  // Bumped each time a viewer is (re)created, so the effects below re-apply to the new instance
  const [viewerGeneration, setViewerGeneration] = useState(0);
  const [loadStatus, setLoadStatus] = useState<AladinLoadStatus>('loading');
  // Aladin can't be torn down, so rather than rebuilding on our own after a lost context, show an
  // overlay and let the user choose when to rebuild (see WebGLContextLostOverlay)
  const {
    isContextLost,
    recoveryCount: contextRecoveryCount,
    recover,
  } = useWebGLContextRecovery(aladinContainerRef, { autoRecover: false });

  // Free the viewer's WebGL context on unmount (e.g. navigating to another source), since the
  // viewer itself is never garbage collected
  useEffect(() => {
    const el = aladinContainerRef.current;
    return () => {
      if (el) releaseAladinWebGLContext(el);
    };
  }, []);

  // Creates the viewer once per mount, plus again when the user reloads it after the browser
  // killed its WebGL context. Aladin Lite has no teardown API and its redraw loop never
  // stops, so a replaced viewer is never freed, which is why changing data (e.g. the nearby
  // sources radius) must update the existing viewer below rather than create a new one here.
  useEffect(() => {
    const el = aladinContainerRef.current;
    if (!el) return;

    const stopInit = initAladin(
      (A) => {
        // Clear out the previous viewer's DOM when rebuilding after a lost context
        el.replaceChildren();

        aladinInstanceRef.current = A.aladin(el, {
          survey: 'P/2MASS/color',
          fov: 5 / 60,
          cooFrame: 'ICRSd',
          projection: 'ZEA',
        });
        setLoadStatus('ready');
        setViewerGeneration((generation) => generation + 1);
      },
      () => setLoadStatus('failed')
    );

    return () => {
      stopInit();
      aladinInstanceRef.current = null;
    };
  }, [contextRecoveryCount]);

  // Center Aladin's cursor on the source's location
  useEffect(() => {
    aladinInstanceRef.current?.gotoRaDec(source.ra, source.dec);
  }, [viewerGeneration, source.ra, source.dec]);

  // Replaces the source/nearby sources catalog whenever they change
  useEffect(() => {
    const aladin = aladinInstanceRef.current;
    if (!aladin || !window.A) return;

    aladin.removeLayers();

    // Create catalog for source and nearby sources
    const cat = window.A.catalog({
      name: 'Source and nearby sources',
      shape: function (
        source: { x: number; y: number },
        canvasCtx: CanvasRenderingContext2D
      ) {
        canvasCtx.beginPath();
        canvasCtx.arc(source.x, source.y, 8, 0, 2 * Math.PI, false);
        canvasCtx.closePath();
        canvasCtx.strokeStyle = '#c38';
        canvasCtx.lineWidth = 3;
        canvasCtx.globalAlpha = 0.7;
        canvasCtx.stroke();
      },
      onClick: 'showPopup',
    });
    aladin.addCatalog(cat);

    // Add markers for the source and nearby sources
    cat.addSources([
      window.A.source(source.ra, source.dec, {
        name: source.name,
        RA: source.ra.toFixed(3),
        Dec: source.dec.toFixed(3),
      }),
    ]);

    if (nearbySources.length) {
      cat.addSources(
        nearbySources.map((nearbySource) =>
          window.A!.source(nearbySource.ra, nearbySource.dec, {
            name: nearbySource.name,
            RA: nearbySource.ra.toFixed(3),
            Dec: nearbySource.dec.toFixed(3),
          })
        )
      );
    }
  }, [viewerGeneration, source.name, source.ra, source.dec, nearbySources]);

  return (
    <div className="webgl-context-lost-host aladin-viewer-host">
      <div ref={aladinContainerRef} className="aladin-viewer-container" />
      <SkyMapStatusOverlay status={loadStatus} />
      {isContextLost && <WebGLContextLostOverlay onReload={recover} />}
    </div>
  );
}

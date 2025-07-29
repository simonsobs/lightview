import { useEffect, useRef } from 'react';
import { SourceResponse } from '../types';

type AladinViewerProps = {
  source: SourceResponse;
  nearbySources: SourceResponse[];
};

export function AladinViewer({ source, nearbySources }: AladinViewerProps) {
  const aladinContainerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);

  useEffect(() => {
    // Script is loaded in index.html, so the Aladin API should have loaded; return early if it hasn't
    if (!window.A) {
      console.error('Aladin API is not loaded.');
      return;
    }

    // Initialize the Aladin plugin
    window.A.init
      .then(() => {
        if (aladinContainerRef.current) {
          // We know window.A exists, so instantiate Aladin viewer with given options
          aladinInstanceRef.current = window.A!.aladin(
            aladinContainerRef.current,
            {
              survey: 'P/2MASS/color',
              fov: 5 / 60,
              cooFrame: 'ICRSd',
              projection: 'ZEA',
            }
          );

          // Create catalog for source and nearby sources
          const cat = window.A!.catalog({
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
            onClick: 'showTable',
          });
          aladinInstanceRef.current.addCatalog(cat);

          // Add markers for the source and nearby sources
          cat.addSources([
            window.A!.source(source.ra, source.dec, {
              name: 'SO-' + source.id,
              '(ra,dec)': `(${source.ra.toFixed(3)},${source.dec.toFixed(3)})`,
            }),
          ]);

          if (nearbySources.length) {
            cat.addSources(
              nearbySources.map((nearbySource) =>
                window.A!.source(nearbySource.ra, nearbySource.dec, {
                  name: 'SO-' + nearbySource.id,
                  '(ra,dec)': `(${nearbySource.ra.toFixed(3)},${nearbySource.dec.toFixed(3)})`,
                })
              )
            );
          }

          // Center Aladin's cursor on the source's location
          aladinInstanceRef.current.gotoRaDec(source.ra, source.dec);
        }
      })
      .catch(() => {
        console.error('Aladin API failed to initialize.');
      });

    // Clean up function
    return () => {
      aladinInstanceRef.current = null;
    };
  }, [source.id, source.ra, source.dec, nearbySources]);

  return <div ref={aladinContainerRef} className="aladin-viewer-container" />;
}

import { useEffect, useRef } from 'react';
import { SourceResponse } from '../types';

type AladinViewerProps = {
  source: SourceResponse;
};

export function AladinViewer({ source }: AladinViewerProps) {
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
              fov: 60,
              cooFrame: 'ICRSd',
              projection: 'ZEA',
            }
          );
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
  }, [source.ra, source.dec]);

  return <div ref={aladinContainerRef} className="aladin-viewer-container" />;
}

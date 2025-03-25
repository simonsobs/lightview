import { useEffect, useRef } from 'react';
import { SourceResponse } from '../types';

type AladinViewerProps = {
  source: SourceResponse;
};

export function AladinViewer({ source }: AladinViewerProps) {
  const aladinContainerRef = useRef<HTMLDivElement | null>(null);
  const aladinInstanceRef = useRef<Aladin | null>(null);

  useEffect(() => {
    if (!window.A) {
      console.error('Aladin API is not loaded.');
      return;
    }

    window.A.init
      .then(() => {
        if (aladinContainerRef.current) {
          aladinInstanceRef.current = window.A!.aladin(
            aladinContainerRef.current,
            {
              survey: 'P/SDSS9/color',
              fov: 60,
              cooFrame: 'ICRSd',
              projection: 'ZEA',
            }
          );
          aladinInstanceRef.current.gotoRaDec(source.ra, source.dec);
        }
      })
      .catch(() => {
        console.error('Aladin API failed to initialize.');
      });

    return () => {
      aladinInstanceRef.current = null;
    };
  }, [source.ra, source.dec]);

  return <div ref={aladinContainerRef} className="aladin-viewer-container" />;
}

import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { SourceSummary } from '../types';
import { SERVICE_URL } from '../configs/constants';
import { SourceHeader } from './SourceHeader';

export function Source() {
  const { id } = useParams();
  const [sourceSummary, setSourceSummary] = useState<SourceSummary | undefined>(
    undefined
  );

  useEffect(() => {
    async function getSourceSummary() {
      const response: Response = await fetch(
        `${SERVICE_URL}/sources/${id}/summary`
      );
      if (!response.ok) {
        throw new Error(
          `Error fetching source summary: ${response.statusText}`
        );
      }
      const data: SourceSummary = (await response.json()) as SourceSummary;
      setSourceSummary(data);
    }
    void getSourceSummary();
  }, [id]);

  return (
    sourceSummary && (
      <>
        <SourceHeader
          id={sourceSummary.source.id}
          ra={sourceSummary.source.ra}
          dec={sourceSummary.source.dec}
          sourceClass="Aliens"
          maxFlux={0}
          medianFlux={0}
          freqForMaxAndMedian={140}
        />
      </>
    )
  );
}

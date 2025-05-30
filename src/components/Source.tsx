import { useMemo } from 'react';
import { useParams } from 'react-router';
import { LightcurveData, SourceSummary } from '../types';
import { SourceHeader } from './SourceHeader';
import {
  findMidBand,
  getMaxFlux,
  getMedianFlux,
} from '../utils/lightcurveDataHelpers';
import { Lightcurve } from './Lightcurve';
import { CrossMatchSection } from './CrossMatchSection';
import { NearbySourcesSection } from './NearbySourcesSection';
import { AladinViewer } from './AladinViewer';
import { LightcurveDataTable } from './LightcurveDataTable';
import { useQuery } from '../hooks/useQuery';

/**
 * Renders all the components related to a Source, like:
 * - SourceHeader
 * - Lightcurve
 * - CrossMatchSection
 * - NearbySourcesSection
 * - AladinViewer
 * - LightcurveDataTable
 */
export function Source() {
  // Use the route's id parameter to get the source's ID; could just as easily pass it in as a prop though
  const { id } = useParams();

  const { data: sourceSummary, error: sourceSummaryError } = useQuery<
    SourceSummary | undefined
  >({
    initialData: undefined,
    queryKey: [id],
    queryFn: async () => {
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/sources/${id}/summary`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Source with ID ${id} not found.`);
        } else {
          throw new Error(
            `Error fetching source summary: ${response.statusText}`
          );
        }
      }

      const data: SourceSummary = (await response.json()) as SourceSummary;

      return data;
    },
  });

  const { data: lightcurveData, error: lightcurveDataError } = useQuery<
    LightcurveData | undefined
  >({
    initialData: undefined,
    queryKey: [id, sourceSummary],
    queryFn: async () => {
      if (!sourceSummary) return;

      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/lightcurves/${id}/all`
      );
      if (!response.ok) {
        throw new Error(
          `Error fetching lightcurve data: ${response.statusText}`
        );
      }

      const data: LightcurveData = (await response.json()) as LightcurveData;
      // Sort data by the frequency band so the plotly legend is sorted in ascending order
      data.bands.sort((a, b) => a.band.frequency - b.band.frequency);

      return data;
    },
  });

  // Memoize the "expensive" data used for the badges
  const badgeData = useMemo(() => {
    if (!lightcurveData) return;
    const bandForMaxAndMedian = findMidBand(lightcurveData.bands);
    const medianFlux = getMedianFlux(bandForMaxAndMedian);
    const maxFlux = getMaxFlux(bandForMaxAndMedian);
    return {
      freqForMaxAndMedian: bandForMaxAndMedian.band.name,
      medianFlux,
      maxFlux,
    };
  }, [lightcurveData]);

  if (sourceSummaryError) {
    throw sourceSummaryError;
  }

  if (lightcurveDataError) {
    throw lightcurveDataError;
  }

  return (
    sourceSummary && (
      <main>
        {badgeData && (
          <SourceHeader
            id={sourceSummary.source.id}
            ra={sourceSummary.source.ra}
            dec={sourceSummary.source.dec}
            sourceClass="ACT"
            maxFlux={badgeData.maxFlux}
            medianFlux={badgeData.medianFlux}
            freqForMaxAndMedian={badgeData.freqForMaxAndMedian}
          />
        )}
        {lightcurveData && <Lightcurve lightcurveData={lightcurveData} />}
        <div className="source-grid-container">
          <div>
            <CrossMatchSection
              crossMatches={sourceSummary.source.extra.cross_matches}
            />
            <NearbySourcesSection
              id={sourceSummary.source.id}
              ra={sourceSummary.source.ra}
              dec={sourceSummary.source.dec}
            />
          </div>
          <AladinViewer source={sourceSummary.source} />
        </div>
        {lightcurveData && (
          <LightcurveDataTable lightcurveData={lightcurveData} />
        )}
      </main>
    )
  );
}

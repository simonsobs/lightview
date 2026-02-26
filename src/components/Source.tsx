import { useState } from 'react';
import { useParams } from 'react-router';
import {
  InstrumentLightcurveData,
  FrequencyLightcurveData,
  SourceSummary,
  SourceResponse,
} from '../types';
import { SourceHeader } from './SourceHeader';
import { Lightcurve } from './Lightcurve';
import { CrossMatchSection } from './CrossMatchSection';
import { NearbySourcesSection } from './NearbySourcesSection';
import { AladinViewer } from './AladinViewer';
import { LightcurveDataTable } from './LightcurveDataTable';
import { useQuery } from '../hooks/useQuery';
import { DEFAULT_NEARBY_SOURCE_RADIUS } from '../configs/constants';

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
  const [nearbySourceRadius, setNearbySourceRadius] = useState(
    DEFAULT_NEARBY_SOURCE_RADIUS
  );

  const { data: sourceData, error: sourceDataError } = useQuery<
    SourceResponse | undefined
  >({
    initialData: undefined,
    queryKey: [id],
    queryFn: async () => {
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/sources/${id}`
      );

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error(`Source with ID ${id} not found.`);
        } else {
          throw new Error(`Error fetching source data: ${response.statusText}`);
        }
      }

      const data: SourceResponse = (await response.json()) as SourceResponse;

      return data;
    },
  });

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
    InstrumentLightcurveData | FrequencyLightcurveData | undefined
  >({
    initialData: undefined,
    queryKey: [id],
    queryFn: async () => {
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/lightcurves/${id}/unbinned`
      );
      if (!response.ok) {
        throw new Error(
          `Error fetching lightcurve data: ${response.statusText}`
        );
      }

      const data = (await response.json()) as
        | InstrumentLightcurveData
        | FrequencyLightcurveData;

      return data;
    },
  });

  const {
    data: nearbySources,
    isLoading,
    error,
  } = useQuery({
    initialData: undefined,
    queryKey: [sourceData, nearbySourceRadius],
    queryFn: async () => {
      if (!sourceData) return;
      const { source_id, ra, dec } = sourceData;
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/sources/cone?ra=${ra}&dec=${dec}&radius=${nearbySourceRadius}`
      );
      if (!response.ok) {
        throw new Error(
          `Error fetching nearby sources: ${response.statusText}`
        );
      }
      const data: SourceResponse[] =
        (await response.json()) as SourceResponse[];
      // Filter out current source's data
      return data.filter((d) => d.source_id !== source_id);
    },
  });

  if (sourceDataError) {
    throw sourceDataError;
  }

  if (sourceSummaryError) {
    throw sourceSummaryError;
  }

  if (lightcurveDataError) {
    throw lightcurveDataError;
  }

  return (
    sourceSummary &&
    sourceData && (
      <main>
        <SourceHeader
          name={sourceData.name}
          ra={sourceData.ra}
          dec={sourceData.dec}
          stats={sourceSummary}
        />
        {lightcurveData && <Lightcurve lightcurveData={lightcurveData} />}
        <div className="source-grid-container">
          <div>
            <CrossMatchSection crossMatches={sourceData.extra?.cross_matches} />
            <NearbySourcesSection
              nearbySources={nearbySources}
              isLoading={isLoading}
              error={error}
              nearbySourceRadius={nearbySourceRadius}
              setNearbySourceRadius={setNearbySourceRadius}
            />
          </div>
          {nearbySources && (
            <AladinViewer source={sourceData} nearbySources={nearbySources} />
          )}
        </div>
        {lightcurveData && (
          <LightcurveDataTable lightcurveData={lightcurveData} />
        )}
      </main>
    )
  );
}

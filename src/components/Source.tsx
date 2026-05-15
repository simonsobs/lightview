import { useState } from 'react';
import { useParams } from 'react-router';
import {
  InstrumentLightcurveData,
  FrequencyLightcurveData,
  SourceResponse,
  SelectionStrategy,
} from '../types';
import { SourceHeader } from './SourceHeader';
import { Lightcurve } from './Lightcurve';
import { CrossMatchSection } from './CrossMatchSection';
import { NearbySourcesSection } from './NearbySourcesSection';
import { AladinViewer } from './AladinViewer';
import { LightcurveDataTable } from './LightcurveDataTable';
import { useQuery } from '../hooks/useQuery';
import { DEFAULT_NEARBY_SOURCE_RADIUS } from '../configs/constants';
import { lightcurveApi } from '../api/client';

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
  const [selectionStrategy, setSelectionStrategy] =
    useState<SelectionStrategy>('instrument');

  const { data: sourceData, error: sourceDataError } = useQuery<
    SourceResponse | undefined
  >({
    initialData: undefined,
    queryKey: [id],
    queryFn: async () => {
      if (!id) return;
      return await lightcurveApi.getSourceData(id);
    },
  });

  const { data: lightcurveData, error: lightcurveDataError } = useQuery<
    InstrumentLightcurveData | FrequencyLightcurveData | undefined
  >({
    initialData: undefined,
    queryKey: [id, selectionStrategy],
    queryFn: async () => {
      if (!id) return;
      return await lightcurveApi.getLightcurveData(id, selectionStrategy);
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
      const data = await lightcurveApi.getNearbySources(
        `?ra=${ra}&dec=${dec}&radius=${nearbySourceRadius}`
      );
      // Filter out current source's data
      return data.filter((d) => d.source_id !== source_id);
    },
  });

  if (sourceDataError) {
    throw sourceDataError;
  }

  if (lightcurveDataError) {
    throw lightcurveDataError;
  }

  return (
    sourceData && (
      <main>
        <SourceHeader
          sourceId={sourceData.source_id}
          name={sourceData.name}
          ra={sourceData.ra}
          dec={sourceData.dec}
        />
        {lightcurveData ? (
          <div className="source-lightcurve-container">
            <Lightcurve
              lightcurveData={lightcurveData}
              selectionStrategy={selectionStrategy}
              setSelectionStrategy={setSelectionStrategy}
            />
          </div>
        ) : (
          <div className="source-lightcurve-placeholder" />
        )}
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

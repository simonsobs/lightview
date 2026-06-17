import {
  FrequencyLightcurveData,
  InstrumentLightcurveData,
  SelectionStrategy,
  SourceResponse,
} from '../types';
import { useQuery } from '../hooks/useQuery';
import { Lightcurve } from './Lightcurve';
import { DEFAULT_HOMEPAGE_PLOT_LAYOUT } from '../configs/constants';
import { Link } from 'react-router';
import { useState } from 'react';
import { lightcurveApi } from '../api/client';
import AllSkyMap from './AllSkyMap';
import { LinkOutIcon } from './icons/LinkOutIcon';

/** Renders the "home" page of the web app */
export function Main() {
  const [selectionStrategy, setSelectionStrategy] =
    useState<SelectionStrategy>('instrument');

  const { data: initialLoadData, error: initialLoadError } = useQuery<
    | {
        sources: SourceResponse[];
        lightcurveData: FrequencyLightcurveData | InstrumentLightcurveData;
      }
    | undefined
  >({
    initialData: undefined,
    queryKey: [selectionStrategy],
    queryFn: async () => {
      const sources = await lightcurveApi.getSources();
      if (!sources) return;
      const lightcurveData = await lightcurveApi.getLightcurveData(
        sources[0].source_id,
        selectionStrategy
      );
      return { sources, lightcurveData };
    },
  });

  if (initialLoadError) {
    throw initialLoadError;
  }

  const sourceUrl = initialLoadData?.sources
    ? '/source/' + initialLoadData.sources[0].source_id
    : undefined;

  if (!sourceUrl) return null;

  return (
    <main>
      <h2 className="home-page-header">
        Use the interactive map below or the search feature above to explore
        light curves.
      </h2>
      {initialLoadData?.sources ? (
        <div className="sources-plot-container">
          <AllSkyMap
            sources={initialLoadData.sources.map((s) => ({
              ra: s.ra,
              dec: s.dec,
              name: s.name,
              sourceId: s.source_id,
            }))}
          />
        </div>
      ) : (
        <div className="home-lightcurve-placeholder"></div>
      )}
      {initialLoadData?.lightcurveData ? (
        <div className="home-light-curve">
          <Lightcurve
            lightcurveData={initialLoadData.lightcurveData}
            plotLayout={DEFAULT_HOMEPAGE_PLOT_LAYOUT}
            selectionStrategy={selectionStrategy}
            setSelectionStrategy={setSelectionStrategy}
            hideStrategyToggle={true}
            hideFlaggedObsToggle={true}
            title="Example light curve"
            subtitle="View the source page to learn more"
          />
          <div className="home-source-link-container">
            <Link className="home-source-link" to={sourceUrl}>
              <span>
                View source page <LinkOutIcon width={16} height={16} />
              </span>
            </Link>
          </div>
        </div>
      ) : (
        <div className="home-lightcurve-placeholder" />
      )}
    </main>
  );
}

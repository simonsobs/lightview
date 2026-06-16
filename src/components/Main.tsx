import {
  FrequencyLightcurveData,
  InstrumentLightcurveData,
  SelectionStrategy,
  SourceResponse,
} from '../types';
import { useQuery } from '../hooks/useQuery';
import { Lightcurve } from './Lightcurve';
import { DEFAULT_HOMEPAGE_PLOT_LAYOUT } from '../configs/constants';
import home_content from '../configs/home_content.md?raw';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router';
import { useState } from 'react';
import { lightcurveApi } from '../api/client';
import AllSkyMap from './AllSkyMap';

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
      <ReactMarkdown>{home_content}</ReactMarkdown>
      <p>
        Below is a plot of sources by their (RA,Dec) position. Click a source's
        marker to view its light curve and data on its source page.
      </p>
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
        <div className="sources-plot-placeholder"></div>
      )}
      <p>
        Below is an example light curve.{' '}
        <Link to={sourceUrl}>View the source page</Link> to learn more about the
        source and its data.
      </p>
      {initialLoadData?.lightcurveData ? (
        <div className="home-light-curve">
          <Lightcurve
            lightcurveData={initialLoadData.lightcurveData}
            plotLayout={DEFAULT_HOMEPAGE_PLOT_LAYOUT}
            selectionStrategy={selectionStrategy}
            setSelectionStrategy={setSelectionStrategy}
          />
          <Link className="home-source-link" to={sourceUrl}>
            View source page
          </Link>
        </div>
      ) : (
        <div className="home-lightcurve-placeholder" />
      )}
    </main>
  );
}

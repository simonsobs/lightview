import {
  FrequencyLightcurveData,
  InstrumentLightcurveData,
  SourceResponse,
} from '../types';
import { useQuery } from '../hooks/useQuery';
import { Lightcurve } from './Lightcurve';
import { DEFAULT_HOMEPAGE_PLOT_LAYOUT } from '../configs/constants';
import home_content from '../configs/home_content.md?raw';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router';
import { useEffect, useState } from 'react';
import { AllSourcesPlot } from './AllSourcesPlot';

/** Renders the "home" page of the web app */
export function Main() {
  // const [defaultId, setDefaultId] = useState<string | undefined>(undefined);
  const [sources, setSources] = useState<SourceResponse[] | undefined>(
    undefined
  );
  const [selectionStrategy, setSelectionStrategy] = useState<
    'instrument' | 'frequency'
  >('instrument');

  const { data: lightcurveData, error: lightcurveDataError } = useQuery<
    FrequencyLightcurveData | InstrumentLightcurveData | undefined
  >({
    initialData: undefined,
    queryKey: [sources, selectionStrategy],
    queryFn: async () => {
      if (!sources) return;
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/lightcurves/${sources[0].source_id}/unbinned?selection_strategy=${selectionStrategy}`
      );
      if (!response.ok) {
        throw new Error(
          `Error fetching lightcurve data: ${response.statusText}`
        );
      }

      const data = (await response.json()) as
        | FrequencyLightcurveData
        | InstrumentLightcurveData;

      return data;
    },
  });

  useEffect(() => {
    const fetchSources = async () => {
      const sourcesReq = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/sources/`
      );
      const response = (await sourcesReq.json()) as SourceResponse[];

      setSources(response);
    };

    void fetchSources();
  }, []);

  if (lightcurveDataError) {
    throw lightcurveDataError;
  }

  const sourceUrl = sources ? '/source/' + sources[0].source_id : undefined;

  if (!sourceUrl) return null;

  return (
    <main>
      <ReactMarkdown>{home_content}</ReactMarkdown>
      <p>
        Below is an example light curve.{' '}
        <Link to={sourceUrl}>View the source page</Link> to learn more about the
        source and its data.
      </p>
      {lightcurveData ? (
        <div className="home-light-curve">
          <Lightcurve
            lightcurveData={lightcurveData}
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
      <p>
        Below is a plot of sources by their (RA,Dec) position. Click a source's
        marker to view its light curve and data on its source page.
      </p>
      {sources ? (
        <div className="sources-plot-container">
          <AllSourcesPlot sources={sources} />
        </div>
      ) : (
        <div className="sources-plot-placeholder"></div>
      )}
    </main>
  );
}

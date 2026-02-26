import {
  FrequencyLightcurveData,
  InstrumentLightcurveData,
  SourcesFeedResponse,
} from '../types';
import { useQuery } from '../hooks/useQuery';
import { Lightcurve } from './Lightcurve';
import { DEFAULT_HOMEPAGE_PLOT_LAYOUT } from '../configs/constants';
import home_content from '../configs/home_content.md?raw';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router';
import { useEffect, useState } from 'react';

/** Renders the "home" page of the web app */
export function Main() {
  const [defaultId, setDefaultId] = useState<string | undefined>(undefined);

  const { data: lightcurveData, error: lightcurveDataError } = useQuery<
    FrequencyLightcurveData | InstrumentLightcurveData | undefined
  >({
    initialData: undefined,
    queryKey: [defaultId],
    queryFn: async () => {
      if (!defaultId) return;
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/lightcurves/${defaultId}/unbinned`
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
    const fetchDefaultId = async () => {
      const sourcesFeed = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/sources/feed`
      );
      const response = (await sourcesFeed.json()) as SourcesFeedResponse;

      setDefaultId(response.items[0].source_id);
    };

    void fetchDefaultId();
  }, []);

  if (lightcurveDataError) {
    throw lightcurveDataError;
  }

  const sourceUrl = '/source/' + defaultId;

  return (
    <main>
      <ReactMarkdown>{home_content}</ReactMarkdown>
      {defaultId && (
        <p>
          Below is an example light curve.{' '}
          <Link to={sourceUrl}>View the source page</Link> to learn more about
          the source and its data.
        </p>
      )}
      {lightcurveData && (
        <div className="home-light-curve">
          <Lightcurve
            lightcurveData={lightcurveData}
            plotLayout={DEFAULT_HOMEPAGE_PLOT_LAYOUT}
          />
          <Link className="home-source-link" to={sourceUrl}>
            View source page
          </Link>
        </div>
      )}
    </main>
  );
}

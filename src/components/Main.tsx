import { LightcurveData } from '../types';
import { useQuery } from '../hooks/useQuery';
import { Lightcurve } from './Lightcurve';
import { DEFAULT_HOMEPAGE_PLOT_LAYOUT } from '../configs/constants';
import home_content from '../configs/home_content.md?raw';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router';

/** Renders the "home" page of the web app */
export function Main() {
  const { data: lightcurveData, error: lightcurveDataError } = useQuery<
    LightcurveData | undefined
  >({
    initialData: undefined,
    queryKey: [],
    queryFn: async () => {
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/lightcurves/${import.meta.env.VITE_DEFAULT_HOMEPAGE_SOURCE_ID}/all`
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

  if (lightcurveDataError) {
    throw lightcurveDataError;
  }

  const sourceUrl =
    '/source/' + import.meta.env.VITE_DEFAULT_HOMEPAGE_SOURCE_ID;

  return (
    <main>
      <ReactMarkdown>{home_content}</ReactMarkdown>
      <p>
        Below is an example light curve.{' '}
        <Link to={sourceUrl}>View the source page</Link> to learn more about the
        source and its data.
      </p>
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

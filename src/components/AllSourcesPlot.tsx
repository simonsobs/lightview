import Plotly, {
  Config,
  Data,
  Layout,
  PlotlyHTMLElement,
  PlotMouseEvent,
} from 'plotly.js-dist-min';
import { useRef, useEffect, useMemo } from 'react';
import { SourceResponse } from '../types';
import { useNavigate } from 'react-router';

type AllSourcesPlotProps = {
  sources: SourceResponse[];
};

export function AllSourcesPlot({ sources }: AllSourcesPlotProps) {
  const navigate = useNavigate();
  const sourcesPlotRef = useRef<PlotlyHTMLElement | null>(null);

  const plotConfig: Partial<Config> = useMemo(() => {
    return {
      displayModeBar: true,
      displaylogo: false,
    };
  }, []);

  const layout = useMemo(
    () =>
      ({
        width: 960,
        xaxis: {
          title: { text: 'RA' },
          autorange: 'reversed',
        },
        yaxis: {
          title: { text: 'Dec' },
        },
        font: {
          family: 'sans-serif',
        },
        title: {
          text: 'Sources',
        },
      }) as Layout,
    []
  );

  const trace: Partial<Data> = useMemo(() => {
    return {
      type: 'scatter',
      mode: 'markers',
      x: sources.map((s) => s.ra),
      y: sources.map((s) => s.dec),
      customdata: sources.map((s) => s.source_id),
      hovertemplate: 'Click to view source page at (%{x}, %{y})<extra></extra>',
    };
  }, [sources]);

  useEffect(() => {
    const stablePlotlyReference = sourcesPlotRef.current;
    if (!stablePlotlyReference) return;
    void Plotly.newPlot(stablePlotlyReference, [trace], layout, plotConfig);
    void stablePlotlyReference.on('plotly_click', (e: PlotMouseEvent) => {
      e.event.preventDefault();
      e.event.stopPropagation();
      const sourceId = e.points[0].customdata as string;
      const sourcePageUrl = '/source/' + sourceId;
      void navigate(sourcePageUrl);
    });

    return () => {
      if (stablePlotlyReference) {
        Plotly.purge(stablePlotlyReference);
      }
    };
  }, [sourcesPlotRef, layout, trace, navigate, plotConfig]);

  /* @ts-expect-error plotlyRef is an extended version of an HTMLDivElement*/
  return <div ref={sourcesPlotRef} />;
}

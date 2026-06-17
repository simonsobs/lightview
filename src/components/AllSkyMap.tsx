import { useEffect, useRef, useMemo, useState } from 'react';
import Plotly, {
  Layout,
  Data,
  PlotMouseEvent,
  PlotlyHTMLElement,
} from 'plotly.js-dist-min';
import { useNavigate } from 'react-router';

export interface SkySource {
  sourceId: string;
  ra: number;
  dec: number;
  name: string;
  /** Optional: drives marker color via a continuous colorscale */
  value?: number;
}

interface AllSkyMapProps {
  sources: SkySource[];
  /** Plotly geo projection type. Aitoff and Mollweide are the most common for astronomy. */
  projection?:
    | 'mollweide'
    | 'aitoff'
    | 'orthographic'
    | 'equirectangular'
    | 'stereographic';
  /** Axis system label shown on the plot – purely cosmetic, does NOT reproject the data */
  coordinateSystem?: 'Equatorial (RA/Dec)' | 'Galactic (l/b)';
  /** Color the markers by this field. "none" uses a flat color. */
  colorBy?: 'value' | 'dec' | 'none';
  title?: string;
  subtitle?: string;
  height?: number;
}

/**
 * Remap RA from [0, 360) → [-180, 180] so the map centers on RA = 0h.
 * Plotly's geo treats longitude 0 as the center; this keeps the center at RA 0h.
 */
function raToLon(ra: number): number {
  return ra > 180 ? ra - 360 : ra;
}

export default function AllSkyMap({
  sources,
  projection = 'mollweide',
  coordinateSystem = 'Equatorial (RA/Dec)',
  colorBy = 'none',
  title = 'Sources by position',
  subtitle = "Click a source's marker to view its light curve",
  height = 500,
}: AllSkyMapProps) {
  const containerRef = useRef<PlotlyHTMLElement>(null);
  const navigate = useNavigate();
  const [isDataReady, setIsDataReady] = useState(false);

  const lon = useMemo(() => sources.map((s) => raToLon(s.ra)), [sources]);
  const lat = useMemo(() => sources.map((s) => s.dec), [sources]);
  const customdata = useMemo(() => sources.map((s) => s.sourceId), [sources]);

  const markerColor: number[] | string = useMemo(() => {
    if (colorBy === 'value') return sources.map((s) => s.value ?? 0);
    if (colorBy === 'dec') return lat;
    return '#1f77b4';
  }, [sources, colorBy, lat]);

  const hoverText = useMemo(
    () =>
      sources.map(
        (s) =>
          `${s.name ?? 'Source'}<br>RA: ${s.ra.toFixed(3)}°<br>Dec: ${s.dec.toFixed(3)}°${
            s.value !== undefined ? `<br>Value: ${s.value.toFixed(3)}` : ''
          }`
      ),
    [sources]
  );

  const isColored = colorBy !== 'none';

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setIsDataReady(false);

    const data: Data[] = [
      {
        type: 'scattergeo',
        lon,
        lat,
        customdata,
        mode: 'markers',
        text: hoverText,
        hoverinfo: 'text',
        marker: {
          size: 5,
          opacity: 0.8,
          color: markerColor as never,
          ...(isColored
            ? {
                colorscale: 'Viridis',
                showscale: true,
                colorbar: {
                  title: colorBy === 'dec' ? 'Dec (°)' : 'Value',
                  thickness: 12,
                  len: 0.6,
                },
              }
            : {}),
        },
      },
    ];

    const layout: Partial<Layout> = {
      height,
      margin: { t: title ? 48 : 24, b: 8, l: 8, r: 8 },
      paper_bgcolor: 'transparent',
      plot_bgcolor: 'transparent',
      geo: {
        projection: { type: projection as never },
        showland: false,
        showocean: false,
        showlakes: false,
        showcoastlines: false,
        showcountries: false,
        showframe: true,
        framewidth: 1,
        lonaxis: {
          showgrid: true,
          gridcolor: '#2a3a4a',
          gridwidth: 0.5,
          dtick: 30,
          tick0: 0,
        },
        lataxis: {
          showgrid: true,
          gridcolor: '#2a3a4a',
          gridwidth: 0.5,
          dtick: 30,
        },
      },
      modebar: {
        bgcolor: 'rgba(255,255,255,0.5)',
      },
      annotations: [
        {
          text: coordinateSystem,
          xref: 'paper',
          yref: 'paper',
          x: 0.01,
          y: 0.01,
          showarrow: false,
          font: { size: 11, color: '#888888' },
        },
      ],
    };

    void Plotly.react(el, data, layout, {
      displayModeBar: true,
      displaylogo: false,
      modeBarButtonsToRemove: ['select2d', 'lasso2d'],
      responsive: true,
    });

    void el.on('plotly_click', (e: PlotMouseEvent) => {
      e.event.preventDefault();
      e.event.stopPropagation();
      const sourceId = e.points[0].customdata as string;
      const sourcePageUrl = '/source/' + sourceId;
      void navigate(sourcePageUrl);
    });

    void el.on('plotly_afterplot', () => setIsDataReady(true));

    return () => {
      Plotly.purge(el);
    };
  }, [
    lon,
    lat,
    customdata,
    navigate,
    markerColor,
    hoverText,
    isColored,
    colorBy,
    projection,
    coordinateSystem,
    title,
    height,
  ]);

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'absolute' }}>
        <p style={{ fontWeight: 'bold', margin: 0, marginLeft: 10 }}>{title}</p>
        <p style={{ fontSize: 13, color: '#888', margin: 0, marginLeft: 10 }}>
          {subtitle}
        </p>
      </div>
      <div
        // @ts-expect-error plotlyRef is an extended version of an HTMLDivElement
        ref={containerRef}
        style={{
          width: '100%',
          visibility: isDataReady ? 'visible' : 'hidden',
        }}
      />
      {!isDataReady && (
        <div className="lightcurve-loading" style={{ height, width: '100%' }}>
          Loading...
        </div>
      )}
    </div>
  );
}

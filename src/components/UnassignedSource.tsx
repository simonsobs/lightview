import { Link, useParams } from 'react-router';
import { useQuery } from '../hooks/useQuery';
import { lightcurveApi } from '../api/client';
import {
  UnassignedFluxMeasurement,
  UnassignedSourceData,
  SimbadConeResponse,
  SimbadMatch,
} from '../types';
import {
  SIMBAD_BASE_URL,
  UNASSIGNED_ALADIN_SURVEY,
  UNASSIGNED_BEAM_RADIUS_ARCMIN,
} from '../configs/constants';
import './styles/cross-matcher.css';
import { ReactNode, useState } from 'react';
import { UnassignedLightcurvePlot } from './UnassignedLightcurvePlot';
import { UnassignedSkyPlot } from './UnassignedSkyPlot';
import { UnassignedAladinMap } from './UnassignedAladinMap';
import { CrossMatchHeader } from './UnassignedSourcesTable';

/** Converts our -180<ra<180 convention to SIMBAD's expected 0->360 convention. */
function toSimbadRa(ra: number): number {
  return ((ra % 360) + 360) % 360;
}

export function UnassignedSource() {
  const { id } = useParams();
  const [selectedSimbadMatch, setSelectedSimbadMatch] = useState<
    string | undefined
  >(undefined);

  const { data, error } = useQuery<
    | { source: UnassignedSourceData; flux: UnassignedFluxMeasurement[] }
    | undefined
  >({
    initialData: undefined,
    queryKey: [id],
    queryFn: async () => {
      if (!id) return;
      const sourcePromise = lightcurveApi.getUnassignedSourceData(id);
      const fluxPromise = lightcurveApi.getUnassignedFluxBySource(id);
      const [unassignedSource, unassignedFlux] = await Promise.all([
        sourcePromise,
        fluxPromise,
      ]);
      if (!unassignedSource || !unassignedFlux) return;
      return { source: unassignedSource, flux: unassignedFlux };
    },
  });

  const {
    data: nearbySimbadSources,
    error: simbadError,
    isLoading: isSimbadQueryActive,
  } = useQuery<{
    data: SimbadMatch[];
    queryTimestamp: undefined | string;
  }>({
    initialData: { data: [], queryTimestamp: undefined },
    queryKey: [id, data],
    queryFn: async () => {
      if (!id || !data) return { data: [], queryTimestamp: undefined };
      let matches: SimbadMatch[] = [];
      const getSimbadHits = await fetch(
        SIMBAD_BASE_URL +
          '/cone' +
          `?ra=${toSimbadRa(data.source.ra)}&dec=${data.source.dec}&sr=${UNASSIGNED_BEAM_RADIUS_ARCMIN / 60}&verb=2&maxrec=10&responseformat=json&order_by=nb_ref&order_dir=desc`
      );
      try {
        const hitsJson = (await getSimbadHits.json()) as SimbadConeResponse;
        matches = hitsJson.data.map((row) => ({
          identifier: row[1] ?? 'SIMBAD object',
          objectType: row[4] ?? null,
          ra: row[2] ?? null,
          dec: row[3] ?? null,
          separationArcmin: row[0] != null ? row[0] * 60 : null,
        }));
      } catch {
        console.error(
          'An error occurred when querying for nearby SIMBAD sources.'
        );
      }
      return {
        data: matches,
        queryTimestamp: new Date(Date.now()).toString(),
      };
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  if (simbadError) {
    throw new Error(simbadError.message);
  }

  return (
    <div className="unassigned-source-page-container">
      <CrossMatchHeader />
      <header className="unassigned-source-page-header">
        <div className="to-unassigned-sources-container">
          <Link
            className="text-so-blue font-medium to-unassigned-sources"
            to={'/unassigned/'}
          >
            ← All unassigned sources
          </Link>
        </div>
        <div className="unassigned-source-page-header-container">
          <p className="uppercase-subheader text-so-blue font-medium">
            Source Review
          </p>
          <p className="source-heading-id font-mono">{id}</p>
          <p>
            RA: {data?.source.ra.toFixed(5)}&deg;, Dec:{' '}
            {data?.source.dec.toFixed(5)}&deg; (ICRS)
          </p>
        </div>
        <div className="detections-container unassigned-source-page-header-container">
          <p className="text-so-blue font-medium">
            {data?.flux.length} detections
          </p>
          <p>
            {data?.source.first_seen} to {data?.source.last_seen}
          </p>
        </div>
      </header>
      <div className="unassigned-source-cards-group">
        <UnassignedSourceCard
          headingLeft="Light curve"
          headingRight="Flux (mJy) versus time"
        >
          {data ? (
            <UnassignedLightcurvePlot measurements={data.flux} />
          ) : (
            'Loading...'
          )}
        </UnassignedSourceCard>
        <UnassignedSourceCard
          headingLeft="Sky position"
          headingRight="Colour: frequency | marker: optics tube"
        >
          {data ? (
            <UnassignedSkyPlot
              sourceRa={data.source.ra}
              sourceDec={data.source.dec}
              measurements={data.flux}
              beamRadiusArcmin={UNASSIGNED_BEAM_RADIUS_ARCMIN}
            />
          ) : (
            'Loading...'
          )}
          <p className="small-txt">
            Dashed circle: {UNASSIGNED_BEAM_RADIUS_ARCMIN.toFixed(1)} arcminute
            beam radius.
          </p>
        </UnassignedSourceCard>
      </div>
      <UnassignedSourceCard
        headingLeft="Interactive sky map"
        headingRight={`Layer: ${UNASSIGNED_ALADIN_SURVEY}`}
      >
        {data ? (
          <UnassignedAladinMap
            sourceRa={data.source.ra}
            sourceDec={data.source.dec}
            survey={UNASSIGNED_ALADIN_SURVEY}
            beamRadiusArcmin={UNASSIGNED_BEAM_RADIUS_ARCMIN}
            measurements={data.flux}
            nearby={data.source.in_radius}
            simbadMatches={nearbySimbadSources.data}
          />
        ) : (
          'Loading...'
        )}
        <p className="small-txt">
          Blue markers are this source’s detections; orange markers are other
          still-unmatched candidates; the dashed orange circle is the configured
          2.0 arcminute search radius; large red triangles are clickable SIMBAD
          matches.
        </p>
      </UnassignedSourceCard>
      <div className="unassigned-source-cards-group">
        <UnassignedSourceCard headingLeft="Nearby unassigned sources">
          <p className="small-txt">
            Within 2.0 arcminutes. Merge a source into the candidate under
            review when they represent the same object.
          </p>
          <div className="unassigned-list-container">
            {data?.source.in_radius.length
              ? data?.source.in_radius.map((s) => (
                  <div key={s.source_id}>
                    <Link
                      className="possible-matches-link font-medium"
                      to={`/unassigned/${s.source_id}`}
                    >
                      {s.source_id}
                    </Link>
                    {/* <p>{s[4]} | {Number(s[0] * 60).toFixed(5)} arcmin</p> */}
                  </div>
                ))
              : 'No still-unmatched sources fall within the configured search radius.'}
          </div>
        </UnassignedSourceCard>
        <UnassignedSourceCard headingLeft="Potential SIMBAD matches">
          {isSimbadQueryActive ? (
            <p>Loading...</p>
          ) : (
            <>
              <p className="small-txt">
                Query completed at {nearbySimbadSources.queryTimestamp}
              </p>
              <div className="unassigned-list-container">
                {nearbySimbadSources.data.length
                  ? nearbySimbadSources.data.map((match) => (
                      <div
                        key={match.identifier}
                        className="possible-matches-container"
                      >
                        <div>
                          <Link
                            className="possible-matches-link font-medium"
                            target="_blank"
                            to={
                              SIMBAD_BASE_URL + '/?target=' + match.identifier
                            }
                          >
                            {match.identifier}
                          </Link>
                          <p className="small-txt margin-top-sm">
                            {match.objectType ?? 'Unknown type'} ·{' '}
                            {match.separationArcmin != null
                              ? match.separationArcmin.toFixed(2)
                              : '—'}{' '}
                            arcmin
                          </p>
                        </div>
                        <input
                          onChange={() =>
                            setSelectedSimbadMatch(match.identifier)
                          }
                          checked={selectedSimbadMatch === match.identifier}
                          className="possible-match-input"
                          type="radio"
                        ></input>
                      </div>
                    ))
                  : 'No nearby SIMBAD sources fall within the configured search radius.'}
              </div>
            </>
          )}
        </UnassignedSourceCard>
      </div>
    </div>
  );
}

function UnassignedSourceCard({
  headingLeft,
  headingRight,
  children,
}: {
  headingLeft: string;
  headingRight?: string;
  children: ReactNode;
}) {
  return (
    <div className="unassigned-source-card-container">
      <div className="unassigned-source-card-header">
        <h3>{headingLeft}</h3>
        {headingRight && <p className="small-txt">{headingRight}</p>}
      </div>
      {children}
    </div>
  );
}

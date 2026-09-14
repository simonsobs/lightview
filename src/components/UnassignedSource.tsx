import { Link, useParams } from 'react-router';
import { useQuery } from '../hooks/useQuery';
import { lightcurveApi } from '../api/client';
import {
  UnassignedFluxMeasurement,
  UnassignedSourceData,
  SimbadConeResponse,
} from '../types';
import { SIMBAD_BASE_URL } from '../configs/constants';
import './styles/cross-matcher.css';
import { ReactNode, useState } from 'react';

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

  const { data: nearbySimbadSources, error: simbadError } = useQuery<{
    data: string[];
    queryTimestamp: undefined | string;
  }>({
    initialData: { data: [], queryTimestamp: undefined },
    queryKey: [id, data],
    queryFn: async () => {
      if (!id || !data) return { data: [], queryTimestamp: undefined };
      const simbadHits = (await (
        await fetch(
          SIMBAD_BASE_URL +
            '/cone' +
            `?ra=${data.source.ra}&dec=${data.source.dec}&sr=${2 / 60}&verb=2&maxrec=10&responseformat=json&order_br=nb_ref&order_dir=desc`
        )
      ).json()) as SimbadConeResponse;
      return {
        data: simbadHits.data ?? [],
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
      <header className="unassigned-source-page-header">
        <Link
          className="text-so-blue font-medium to-unassigned-sources"
          to={'/unassigned/'}
        >
          ← All unassigned sources
        </Link>
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
      <UnassignedSourceCard
        headingLeft="Lightcurve"
        headingRight="Flux (mJy) versus time"
      >
        Insert plot
      </UnassignedSourceCard>
      <UnassignedSourceCard
        headingLeft="Sky position"
        headingRight="Colour: frequency | marker: optics tube"
      >
        Insert plot
        <p className="small-txt">Dashed circle: 2.0 arcminute beam radius.</p>
      </UnassignedSourceCard>
      <UnassignedSourceCard
        headingLeft="Interactive sky map"
        headingRight="Layer: P/DSS2/color"
      >
        Insert Aladin with markers
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
          <p className="small-txt">
            Query completed at {nearbySimbadSources.queryTimestamp}
          </p>
          <div className="unassigned-list-container">
            {nearbySimbadSources.data.map((s) => (
              <div key={s[1]} className="possible-matches-container">
                <div>
                  <Link
                    className="possible-matches-link font-medium"
                    target="_blank"
                    to={SIMBAD_BASE_URL + '/?target=' + s[1]}
                  >
                    {s[1]}
                  </Link>
                  <p className="small-txt margin-top-sm">
                    {s[4]} · {Number(Number(s[0]) * 60).toFixed(5)} arcmin
                  </p>
                </div>
                <input
                  onChange={() => setSelectedSimbadMatch(s[1])}
                  checked={selectedSimbadMatch === s[1]}
                  className="possible-match-input"
                  type="radio"
                ></input>
              </div>
            ))}
          </div>
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

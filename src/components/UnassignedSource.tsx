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
import { ReactNode, useCallback, useState } from 'react';
import { UnassignedLightcurvePlot } from './UnassignedLightcurvePlot';
import { UnassignedSkyPlot } from './UnassignedSkyPlot';
import { UnassignedAladinMap } from './UnassignedAladinMap';
import { CrossMatchHeader } from './UnassignedSourcesTable';
import { ConfirmDialog } from './ConfirmDialog';

/** Converts our -180<ra<180 convention to SIMBAD's expected 0->360 convention. */
function toSimbadRa(ra: number): number {
  return ((ra % 360) + 360) % 360;
}

export function UnassignedSource() {
  const { id } = useParams();
  const [selectedSimbadMatch, setSelectedSimbadMatch] = useState<
    SimbadMatch | undefined
  >(undefined);
  const [shouldOpenConfirmDialog, setShouldOpenConfirmDialog] = useState(false);
  const [confirmDialogState, setConfirmDialogState] = useState<
    { title: string; description: ReactNode } | undefined
  >(undefined);
  const [crossmatchActionState, setCrossmatchActionState] = useState<
    { action: string; matchedId: string } | undefined
  >(undefined);
  const [novelSourceName, setNovelSourceName] = useState<undefined | string>(
    undefined
  );
  const [isNoiseChecked, setIsNoiseChecked] = useState(false);

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

  const handleCancelAction = useCallback(() => {
    setShouldOpenConfirmDialog(false);
    setConfirmDialogState(undefined);
    setCrossmatchActionState(undefined);
  }, []);

  const handleConfirmAction = useCallback(() => {
    console.log('send request');
  }, [crossmatchActionState]);

  if (error) {
    throw new Error(error.message);
  }

  if (simbadError) {
    throw new Error(simbadError.message);
  }

  return (
    <div className="unassigned-source-page-container">
      <ConfirmDialog
        open={shouldOpenConfirmDialog}
        title={confirmDialogState?.title}
        description={confirmDialogState?.description}
        onCancel={handleCancelAction}
        onConfirm={handleConfirmAction}
      />
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
          <p className="small-text">
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
        <p className="small-text">
          Blue markers are this source’s detections; orange markers are other
          still-unmatched candidates; the dashed orange circle is the configured
          2.0 arcminute search radius; large red triangles are clickable SIMBAD
          matches.
        </p>
      </UnassignedSourceCard>
      <div className="unassigned-source-cards-group">
        <UnassignedSourceCard headingLeft="Nearby unassigned sources">
          <p className="small-text">
            Within 2.0 arcminutes. Merge a source into the candidate under
            review when they represent the same object.
          </p>
          <div className="unassigned-list-container">
            {data?.source.in_radius.length
              ? data?.source.in_radius.map((s) => (
                  <div className="possible-matches-container" key={s.source_id}>
                    <div className="possible-matches-link-wrapper">
                      <Link
                        className="possible-matches-link font-medium"
                        to={`/unassigned/${s.source_id}`}
                      >
                        {s.source_id}
                      </Link>
                    </div>
                    <button
                      className="cross-match-btn possible-match-input"
                      onClick={() => {
                        setShouldOpenConfirmDialog(true);
                        setConfirmDialogState({
                          title: 'Confirm Merge',
                          description:
                            'Merge this nearby source into the candidate under review? All of its detections will be re-parented and the action recorded.',
                        });
                        setCrossmatchActionState({
                          action: 'merge',
                          matchedId: s.source_id,
                        });
                      }}
                    >
                      Merge
                    </button>
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
              <p className="small-text">
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
                          <p className="small-text margin-top-sm">
                            {match.objectType ?? 'Unknown type'} ·{' '}
                            {match.separationArcmin != null
                              ? match.separationArcmin.toFixed(2)
                              : '—'}{' '}
                            arcmin
                          </p>
                        </div>
                        <input
                          onChange={() => setSelectedSimbadMatch(match)}
                          checked={
                            selectedSimbadMatch?.identifier === match.identifier
                          }
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
      <UnassignedSourceCard
        headingLeft="Review decision"
        headingRight="Reviewer: <insert user>"
        containerClassname="review-decision-card"
      >
        <p className="small-text">
          Unmatched is the default: leave the source unchanged if more
          detections are needed.
        </p>
        <div className="review-decision-container">
          <div>
            <h4>Terminal outcomes</h4>
            <p className="small-text">
              External and novel decisions register with SOCat before completing
              the local review action.
            </p>
          </div>
          <div className="review-decision-action">
            Select a server-validated SIMBAD object above, then confirm this
            external cross-match.
            <p className="small-text selected-external-match-text">
              {selectedSimbadMatch?.identifier ? (
                <>
                  <em>Selected SIMBAD object:</em>{' '}
                  <strong>{selectedSimbadMatch.identifier}</strong>
                </>
              ) : (
                ''
              )}
            </p>
            <button
              title={
                selectedSimbadMatch === undefined
                  ? 'You must first select a SIMBAD object.'
                  : undefined
              }
              className="cross-match-btn"
              disabled={selectedSimbadMatch === undefined}
            >
              Accept external match
            </button>
          </div>
          <div className="review-decision-action">
            <label className="new-source-input-wrapper">
              <span className="small-text">New source name</span>
              <input
                onChange={(e) => setNovelSourceName(e.target.value)}
                className="new-source-input"
                placeholder="enter a name for this novel source..."
                type="text"
                value={novelSourceName}
              />
            </label>
            <button
              disabled={novelSourceName === undefined}
              title={
                !novelSourceName?.length
                  ? 'You must first enter a name for the novel source.'
                  : undefined
              }
              className="cross-match-btn"
            >
              Register novel source
            </button>
          </div>
          <div className="review-decision-action noise-wrapper">
            <label>
              <input
                type="checkbox"
                checked={isNoiseChecked}
                onChange={() => setIsNoiseChecked((prev) => !prev)}
              />
              <span className="noise-confirmation-statement">
                I confirm this source is noise. Its immutable candidate
                detections will remain available as review provenance.
              </span>
            </label>
            <button
              title={
                !isNoiseChecked
                  ? 'You must first check the box to confirm this source is a noise.'
                  : undefined
              }
              disabled={!isNoiseChecked}
              className="cross-match-btn noise-btn"
            >
              Classify as noise
            </button>
          </div>
        </div>
      </UnassignedSourceCard>
    </div>
  );
}

function UnassignedSourceCard({
  headingLeft,
  headingRight,
  children,
  containerClassname = '',
}: {
  headingLeft: string;
  headingRight?: string;
  children: ReactNode;
  containerClassname?: string;
}) {
  return (
    <div
      className={'unassigned-source-card-container' + ' ' + containerClassname}
    >
      <div className="unassigned-source-card-header">
        <h3>{headingLeft}</h3>
        {headingRight && <p className="small-text">{headingRight}</p>}
      </div>
      {children}
    </div>
  );
}

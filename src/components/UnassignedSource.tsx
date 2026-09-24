import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '../hooks/useQuery';
import { lightcurveApi } from '../api/client';
import {
  UnassignedFluxMeasurement,
  UnassignedSourceData,
  ReviewMetadata,
  SimbadConeResponse,
  SimbadMatch,
} from '../types';
import {
  SIMBAD_BASE_LINK_OUT_URL,
  SIMBAD_BASE_URL,
  UNASSIGNED_ALADIN_SURVEY,
  UNASSIGNED_BEAM_RADIUS_ARCMIN,
} from '../configs/constants';
import './styles/cross-matcher.css';
import { ChangeEvent, ReactNode, useCallback, useState } from 'react';
import { UnassignedLightcurvePlot } from './UnassignedLightcurvePlot';
import { UnassignedSkyPlot } from './UnassignedSkyPlot';
import { UnassignedAladinMap } from './UnassignedAladinMap';
import { CrossMatchHeader } from './UnassignedSourcesTable';
import { ConfirmDialog } from './ConfirmDialog';

/** Converts our -180<ra<180 convention to SIMBAD's expected 0->360 convention. */
function toSimbadRa(ra: number): number {
  return ((ra % 360) + 360) % 360;
}

const STATUS_TO_EXCLUDE_SIMBAD_SEARCH = ['external_match', 'novel', 'merged'];
const STATUS_TO_EXCLUDE_STATUS_BANNER = ['unmatched', 'merged'];

/** Stable reference for StatusBanner's reviewMetadata default - a fresh {} literal there would
 * be recreated on every render. */
const EMPTY_REVIEW_METADATA: ReviewMetadata = {};

/** localStorage key for the reviewer-name field: there's no auth-derived identity available on
 * the frontend, so this is remembered per-browser to save re-typing it on every review. */
const REVIEWER_NAME_STORAGE_KEY = 'unassigned_reviewer_name';

type CrossmatchAction =
  | { action: 'merge'; sourceId: string; expectedVersion: number }
  | { action: 'external_match' }
  | { action: 'novel' }
  | { action: 'noise' };

export function UnassignedSource() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [selectedSimbadMatch, setSelectedSimbadMatch] = useState<
    SimbadMatch | undefined
  >(undefined);
  const [shouldOpenConfirmDialog, setShouldOpenConfirmDialog] = useState(false);
  const [confirmDialogState, setConfirmDialogState] = useState<
    { title: string; description: ReactNode } | undefined
  >(undefined);
  const [crossmatchActionState, setCrossmatchActionState] = useState<
    CrossmatchAction | undefined
  >(undefined);
  const [actionError, setActionError] = useState<string | undefined>(undefined);
  const [novelSourceName, setNovelSourceName] = useState<undefined | string>(
    undefined
  );
  const [isNoiseChecked, setIsNoiseChecked] = useState(false);
  const [reviewerName, setReviewerName] = useState<string>(
    () => localStorage.getItem(REVIEWER_NAME_STORAGE_KEY) ?? ''
  );

  const handleReviewerNameChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setReviewerName(value);
      localStorage.setItem(REVIEWER_NAME_STORAGE_KEY, value);
    },
    []
  );

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
      if (
        !id ||
        !data ||
        STATUS_TO_EXCLUDE_SIMBAD_SEARCH.includes(data.source.status)
      )
        return { data: [], queryTimestamp: undefined };
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
        // ISO 8601, not a locale-formatted string: this doubles as the `queried_at` sent to the
        // server's external_evidence.queried_at (a datetime field) if the reviewer accepts one
        // of these matches - it's formatted for display separately, below.
        data: matches,
        queryTimestamp: new Date(Date.now()).toISOString(),
      };
    },
  });

  const handleCancelAction = useCallback(() => {
    setShouldOpenConfirmDialog(false);
    setConfirmDialogState(undefined);
    setCrossmatchActionState(undefined);
    setActionError(undefined);
  }, []);

  const openConfirmDialog = useCallback(
    (title: string, description: ReactNode, action: CrossmatchAction) => {
      setActionError(undefined);
      setConfirmDialogState({ title, description });
      setCrossmatchActionState(action);
      setShouldOpenConfirmDialog(true);
    },
    []
  );

  const handleConfirmAction = useCallback(async () => {
    if (!id || !data || !crossmatchActionState) return;

    const reviewer = reviewerName.trim();
    if (!reviewer) {
      setActionError('Enter your name before confirming.');
      throw new Error('Missing reviewer name');
    }
    setActionError(undefined);

    try {
      switch (crossmatchActionState.action) {
        case 'merge':
          await lightcurveApi.mergeUnassignedSource({
            source_id: crossmatchActionState.sourceId,
            target_source_id: id,
            expected_version: crossmatchActionState.expectedVersion,
            reviewer,
          });
          break;
        case 'external_match':
          if (!selectedSimbadMatch) return;
          await lightcurveApi.decideUnassignedSource({
            source_id: id,
            expected_version: data.source.version,
            outcome: 'external_match',
            reviewer,
            external_evidence: {
              identifier: selectedSimbadMatch.identifier,
              object_type: selectedSimbadMatch.objectType,
              ra: selectedSimbadMatch.ra,
              dec: selectedSimbadMatch.dec,
              separation_arcmin: selectedSimbadMatch.separationArcmin,
              queried_at:
                nearbySimbadSources.queryTimestamp ?? new Date().toISOString(),
            },
          });
          break;
        case 'novel': {
          const name = novelSourceName?.trim();
          if (!name) return;
          await lightcurveApi.decideUnassignedSource({
            source_id: id,
            expected_version: data.source.version,
            outcome: 'novel',
            reviewer,
            novel_name: name,
          });
          break;
        }
        case 'noise':
          await lightcurveApi.decideUnassignedSource({
            source_id: id,
            expected_version: data.source.version,
            outcome: 'noise',
            reviewer,
          });
          break;
      }
      // The reviewed source's status/version (and, for a merge, the merged-away candidate's)
      // just changed server-side; this page has no refetch mechanism, so return to the list
      // rather than show now-stale data.
      void navigate('/unassigned/');
    } catch (e) {
      setActionError(
        e instanceof Error
          ? e.message
          : 'Something went wrong. Please try again.'
      );
      throw e;
    }
  }, [
    id,
    data,
    crossmatchActionState,
    reviewerName,
    selectedSimbadMatch,
    novelSourceName,
    nearbySimbadSources.queryTimestamp,
    navigate,
  ]);

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
        error={actionError}
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
        {data?.source.status !== 'merged' ? (
          <DetectionsCard
            count={data?.flux.length}
            firstSeen={data?.source.first_seen}
            lastSeen={data?.source.last_seen}
          />
        ) : (
          <MergedCard
            targetSourceId={
              data?.source.review_metadata?.target_source_id ?? ''
            }
            reviewer={data?.source.reviewed_by ?? ''}
            reviewDate={data?.source.reviewed_at ?? ''}
          />
        )}
      </header>
      {data &&
        !STATUS_TO_EXCLUDE_STATUS_BANNER.includes(data.source.status) && (
          <StatusBanner
            status={data.source.status}
            reviewer={data.source.reviewed_by}
            reviewDate={data.source.reviewed_at}
            reviewMetadata={data.source.review_metadata}
          />
        )}
      <div className="unassigned-source-cards-group">
        <UnassignedSourceCard
          headingLeft="Light curve"
          headingRight="Flux (mJy) versus time"
          showCard={data?.source.status !== 'merged'}
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
          showCard={data?.source.status !== 'merged'}
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
        showCard={data?.source.status !== 'merged'}
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
        <UnassignedSourceCard
          headingLeft="Nearby unassigned sources"
          showCard={data?.source.status !== 'merged'}
        >
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
                        className="link-outs font-medium"
                        to={`/unassigned/${s.source_id}`}
                      >
                        {s.source_id}
                      </Link>
                    </div>
                    {data.source.status === 'unmatched' && (
                      <button
                        type="button"
                        className="cross-match-btn possible-match-input"
                        disabled={!reviewerName.trim()}
                        title={
                          !reviewerName.trim()
                            ? 'You must first enter your name as reviewer.'
                            : undefined
                        }
                        onClick={() =>
                          openConfirmDialog(
                            'Confirm merge',
                            `Merge ${s.source_id} into the candidate under review? All of its detections will be re-parented and the action recorded.`,
                            {
                              action: 'merge',
                              sourceId: s.source_id,
                              expectedVersion: s.version,
                            }
                          )
                        }
                      >
                        Merge
                      </button>
                    )}
                  </div>
                ))
              : 'No still-unmatched sources fall within the configured search radius.'}
          </div>
        </UnassignedSourceCard>
        <UnassignedSourceCard
          headingLeft="Potential SIMBAD matches"
          showCard={
            !STATUS_TO_EXCLUDE_SIMBAD_SEARCH.includes(data?.source.status ?? '')
          }
        >
          {isSimbadQueryActive ? (
            <p>Loading...</p>
          ) : (
            <>
              <p className="small-text">
                Query completed at{' '}
                {nearbySimbadSources.queryTimestamp
                  ? new Date(
                      nearbySimbadSources.queryTimestamp
                    ).toLocaleString()
                  : ''}
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
                            className="link-outs font-medium"
                            target="_blank"
                            to={SIMBAD_BASE_LINK_OUT_URL + match.identifier}
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
                        {data?.source.status === 'unmatched' && (
                          <input
                            onChange={() => setSelectedSimbadMatch(match)}
                            checked={
                              selectedSimbadMatch?.identifier ===
                              match.identifier
                            }
                            className="possible-match-input"
                            type="radio"
                          ></input>
                        )}
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
        headingRight={
          <label className="reviewer-name-wrapper">
            Reviewer:{' '}
            <input
              className="reviewer-name-input"
              type="text"
              placeholder="your name"
              value={reviewerName}
              onChange={handleReviewerNameChange}
            />
          </label>
        }
        containerClassname="review-decision-card"
        showCard={data?.source.status === 'unmatched'}
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
              type="button"
              title={
                selectedSimbadMatch === undefined
                  ? 'You must first select a SIMBAD object.'
                  : !reviewerName.trim()
                    ? 'You must first enter your name as reviewer.'
                    : undefined
              }
              className="cross-match-btn"
              disabled={
                selectedSimbadMatch === undefined || !reviewerName.trim()
              }
              onClick={() =>
                openConfirmDialog(
                  'Confirm external match',
                  <>
                    Accept <strong>{selectedSimbadMatch?.identifier}</strong> as
                    this source&rsquo;s external catalogue cross-match? This is
                    a terminal decision and cannot be undone.
                  </>,
                  { action: 'external_match' }
                )
              }
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
              type="button"
              disabled={!novelSourceName?.trim() || !reviewerName.trim()}
              title={
                !novelSourceName?.trim()
                  ? 'You must first enter a name for the novel source.'
                  : !reviewerName.trim()
                    ? 'You must first enter your name as reviewer.'
                    : undefined
              }
              className="cross-match-btn"
              onClick={() =>
                openConfirmDialog(
                  'Confirm novel source',
                  <>
                    Register this candidate as a new source named{' '}
                    <strong>{novelSourceName?.trim()}</strong>? This is a
                    terminal decision and cannot be undone.
                  </>,
                  { action: 'novel' }
                )
              }
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
              type="button"
              title={
                !isNoiseChecked
                  ? 'You must first check the box to confirm this source is a noise.'
                  : !reviewerName.trim()
                    ? 'You must first enter your name as reviewer.'
                    : undefined
              }
              disabled={!isNoiseChecked || !reviewerName.trim()}
              className="cross-match-btn noise-btn"
              onClick={() =>
                openConfirmDialog(
                  'Confirm noise classification',
                  'Classify this candidate as noise? This is a terminal decision and cannot be undone; its detections remain available as review provenance.',
                  { action: 'noise' }
                )
              }
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
  showCard = true,
}: {
  headingLeft: string;
  headingRight?: ReactNode;
  children: ReactNode;
  containerClassname?: string;
  showCard: boolean;
}) {
  if (!showCard) return null;

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

function DetectionsCard({
  count,
  firstSeen,
  lastSeen,
}: {
  count?: number;
  firstSeen?: string;
  lastSeen?: string;
}) {
  return (
    <div className="detections-container unassigned-source-page-header-container">
      <p className="text-so-blue font-medium">{count} detections</p>
      <p>
        {firstSeen} to {lastSeen}
      </p>
    </div>
  );
}

function MergedCard({
  targetSourceId,
  reviewer,
  reviewDate,
}: {
  targetSourceId?: string;
  reviewer: string;
  reviewDate: string;
}) {
  return (
    <div className="merged-container unassigned-source-page-header-container">
      <p>
        Merged with{' '}
        <Link className="link-outs" to={`/unassigned/${targetSourceId}`}>
          {targetSourceId}
        </Link>{' '}
        by {reviewer} on {reviewDate}
      </p>
    </div>
  );
}

function StatusBanner({
  status,
  reviewer = '',
  reviewDate = '',
  reviewMetadata = EMPTY_REVIEW_METADATA,
}: {
  status: string;
  reviewer?: string;
  reviewDate?: string;
  reviewMetadata?: ReviewMetadata;
}) {
  let info: ReactNode;
  if (status === 'noise' || status === 'novel') {
    info = (
      <p>
        Classified as <strong>{status}</strong> by {reviewer} on {reviewDate}
      </p>
    );
  } else {
    info = (
      <p>
        Cross-matched with{' '}
        <Link
          className="link-outs"
          target="_blank"
          to={
            SIMBAD_BASE_URL +
            '/?target=' +
            reviewMetadata?.external_evidence?.identifier
          }
        >
          {reviewMetadata?.external_evidence?.identifier}
        </Link>{' '}
        by {reviewer} on {reviewDate}
      </p>
    );
  }

  return <div className="status-banner">{info}</div>;
}

import {
  useCallback,
  useDeferredValue,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link } from 'react-router';
import { ColumnDef, InitialTableState } from '@tanstack/react-table';
import AllSkyMap from './AllSkyMap';
import { SkySource, DataFileExtensions } from '../types';
import { DATA_EXT_OPTIONS, MIN_MAX_FLUX_VALUES } from '../configs/constants';
import { Table } from './Table';
import { DownloadIcon } from './icons/DownloadIcon';
import { LinkOutIcon } from './icons/LinkOutIcon';
import { prefersReducedMotion } from '../utils/prefersReducedMotion';
import { lightcurveApi } from '../api/client';
import { useSkyTarget } from '../contexts/SkyTargetContext';
import { AladinLoadStatus } from '../utils/initAladin';
import { coneSearchResultsPath, isWithinCone } from '../utils/coneSearch';
import './styles/sky-explorer.css';

export interface SkyExplorerProps {
  sources: SkySource[];
  bands: Set<string>;
  onSourceClick: (id: string) => void;
  title?: string;
  subtitle?: string;
  height?: number;
}

// Module-level so its identity never changes; the table is paginated because at the default
// all-sky zoom every source is in view.
const TABLE_INITIAL_STATE: InitialTableState = {
  pagination: { pageSize: 25 },
};

// Name isn't here since its cell needs SkyExplorer's preview handler; see `columns` below.
const POSITION_COLUMNS: ColumnDef<SkySource>[] = [
  {
    header: 'RA (deg)',
    accessorFn: (row) => row.ra,
    cell: ({ row }) => (
      <span title={String(row.original.ra)}>{row.original.ra.toFixed(3)}</span>
    ),
    size: 100,
  },
  {
    header: 'Dec (deg)',
    accessorFn: (row) => row.dec,
    cell: ({ row }) => (
      <span title={String(row.original.dec)}>
        {row.original.dec.toFixed(3)}
      </span>
    ),
    size: 100,
  },
];

/**
 * Renders the all-sky map and, below it, a table of the sources that are both within the map's
 * current field of view and pass its active flux filter. Owns the state shared between the two so
 * that map interactions only re-render this subtree, not the rest of the home page (Main.tsx).
 */
export function SkyExplorer({
  sources,
  bands,
  onSourceClick,
}: SkyExplorerProps) {
  const [appliedBand, setAppliedBand] = useState('');
  const [appliedRange, setAppliedRange] = useState(MIN_MAX_FLUX_VALUES);
  // The set of sources currently shown on the map. Derived (rather than copied into its own
  // state on "Apply") so that it automatically recomputes if `sources` itself changes (e.g. a
  // refetch) while a filter is active; otherwise, a stale filter snapshot would keep hiding
  // markers from the old source list after the catalog below has already been rebuilt with new
  // ones.
  const visibleSources = useMemo(() => {
    if (appliedBand === '') return sources;
    return sources.filter((s) => {
      const flux = s.properties?.median_flux[appliedBand];
      return flux != null && flux >= appliedRange[0] && flux <= appliedRange[1];
    });
  }, [sources, appliedBand, appliedRange]);

  // Ids of every source (filtered or not) within the map's current field of view, reported by
  // AllSkyMap once the camera settles after a pan/zoom/resize. null until Aladin has
  // initialized, meaning "treat every source as in view".
  const [inViewIds, setInViewIds] = useState<Set<string> | null>(null);
  const [dataDownloadExt, setDataDownloadExt] = useState(DATA_EXT_OPTIONS[0]);

  // A cone search normally moves the map, which then filters the table by its field of view.
  // When the map couldn't load, nothing would visibly happen, so the table is filtered by the
  // cone itself instead, until the user clears it. If Aladin finishes loading late, the map takes
  // the search over again (see AllSkyMap's skyTarget effect) and this switches itself off.
  const [mapStatus, setMapStatus] = useState<AladinLoadStatus>('loading');
  const { skyTarget } = useSkyTarget();
  const [clearedConeRequestId, setClearedConeRequestId] = useState<
    number | null
  >(null);
  const fallbackCone =
    mapStatus === 'failed' &&
    skyTarget?.kind === 'cone' &&
    skyTarget.requestId !== clearedConeRequestId
      ? skyTarget
      : null;

  const sourcesInView = useMemo(() => {
    if (fallbackCone) {
      return visibleSources.filter((s) => isWithinCone(s, fallbackCone));
    }
    return inViewIds
      ? visibleSources.filter((s) => inViewIds.has(s.sourceId))
      : visibleSources;
  }, [visibleSources, inViewIds, fallbackCone]);

  // Lets React render the (possibly large) table update at a lower priority than the map, so
  // re-sorting/re-rendering rows never blocks interacting with Aladin.
  const deferredSourcesInView = useDeferredValue(sourcesInView);

  const mapRef = useRef<HTMLDivElement>(null);

  // Opens the same lightcurve preview a map marker click does, then scrolls the map back into
  // view; makes clear to the user that the lightcurve preview has opened
  const handlePreview = useCallback(
    (sourceId: string) => {
      onSourceClick(sourceId);
      mapRef.current?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
    },
    [onSourceClick]
  );

  // Only changes when a filter is applied/cleared or when download extension
  // selector changes; handlePreview is stable, since Main's onSourceClick is
  const columns = useMemo<ColumnDef<SkySource>[]>(() => {
    return [
      {
        header: 'Name',
        accessorFn: (row) => row.name,
        cell: ({ row }) => (
          <button
            type="button"
            className="source-name-btn text-so-blue"
            title="Preview light curve"
            onClick={() => handlePreview(row.original.sourceId)}
          >
            {row.original.name}
          </button>
        ),
        size: 100,
        enableSorting: false,
      },
      ...POSITION_COLUMNS,
      {
        header:
          'Median Flux' +
          (appliedBand === '' ? ', (unselected)' : `, ${appliedBand} (mJy)`),
        accessorFn: (row) => row.properties?.median_flux[appliedBand],
        cell: ({ row }) => {
          const flux = row.original.properties?.median_flux[appliedBand];
          return flux == null ? (
            '-'
          ) : (
            <span title={String(flux)}>{flux.toFixed(3)}</span>
          );
        },
        enableSorting: appliedBand === '' ? false : true,
      },
      {
        id: 'sourcePage',
        header: 'Source Page',
        cell: ({ row }) => (
          <Link
            className="text-so-blue"
            target="_blank"
            to={`/source/${row.original.sourceId}`}
            aria-label={`Open ${row.original.name} source page in a new tab`}
            title="Open source page in a new tab"
          >
            <LinkOutIcon width={14} height={14} />
          </Link>
        ),
        size: 60,
        enableSorting: false,
      },
      {
        id: 'download',
        header: () => (
          <label className="main-table-download">
            Download as{' '}
            <select
              className="select-data-format"
              value={dataDownloadExt}
              onChange={(e) => setDataDownloadExt(e.target.value)}
            >
              {DATA_EXT_OPTIONS.map((ext) => (
                <option key={ext} value={ext}>
                  {ext.toUpperCase()}
                </option>
              ))}
            </select>
          </label>
        ),
        cell: ({ row }) => (
          <button
            type="button"
            className="table-download-btn main-page-table"
            aria-label={`Download ${row.original.name} data as ${dataDownloadExt}`}
            onClick={() =>
              void lightcurveApi.downloadTableData(
                row.original.sourceId,
                dataDownloadExt as DataFileExtensions
              )
            }
          >
            <DownloadIcon width={12} height={12} />
          </button>
        ),
        size: 100,
        enableSorting: false,
      },
    ];
  }, [appliedBand, handlePreview, dataDownloadExt]);

  return (
    <>
      <div ref={mapRef}>
        <AllSkyMap
          sources={sources}
          bands={bands}
          onSourceClick={onSourceClick}
          appliedBand={appliedBand}
          setAppliedBand={setAppliedBand}
          appliedRange={appliedRange}
          setAppliedRange={setAppliedRange}
          visibleSources={visibleSources}
          setInViewIds={setInViewIds}
          onLoadStatusChange={setMapStatus}
        />
      </div>
      {fallbackCone && (
        <div className="all-sky-cone-fallback" role="status">
          <p>
            The sky map is unavailable, so this table is filtered to sources
            within {fallbackCone.radiusDeg}° of RA {fallbackCone.ra}°, Dec{' '}
            {fallbackCone.dec}°.
          </p>
          <div className="all-sky-cone-fallback-actions">
            <Link
              className="all-sky-cone-fallback-link"
              to={coneSearchResultsPath(fallbackCone)}
              target="_blank"
            >
              Open results table
              <LinkOutIcon width={12} height={12} />
            </Link>
            <button
              type="button"
              className="all-sky-cone-fallback-clear"
              onClick={() => setClearedConeRequestId(fallbackCone.requestId)}
            >
              Show all sources
            </button>
          </div>
        </div>
      )}
      {/* Helps differentiate the table's count vs the map's filtered count */}
      <p className="all-sky-table-caption">
        {fallbackCone ? 'Sources in cone' : 'Sources in view'}:{' '}
        {deferredSourcesInView.length.toLocaleString()}
        {appliedBand !== '' && (
          <span className="all-sky-table-caption-note"> (matching filter)</span>
        )}
      </p>
      <Table
        data={deferredSourcesInView}
        columns={columns}
        initialState={TABLE_INITIAL_STATE}
        paginationControlsPosition="bottom"
        className="all-sky-table-wrapper themed-table"
        paginationClassName="all-sky-pagination"
        customNoResultsMsg={
          fallbackCone
            ? 'No sources within the cone search'
            : "No sources detected in the map's field of view"
        }
      />
    </>
  );
}

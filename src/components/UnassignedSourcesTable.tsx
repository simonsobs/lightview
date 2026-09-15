import { useMemo, useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { lightcurveApi } from '../api/client';
import { SourceStatuses, UnassignedSourceResponse } from '../types';
import { Table } from './Table';
import { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router';
import { formatSourceStatus } from '../utils/lightcurveDataHelpers';
import './styles/cross-matcher.css';

type UnassignedSourcesTableData = {
  id: string;
  position: string;
  // detections: number;
  first_seen: string;
  last_seen: string;
  status: string;
  review: string;
};

const INCLUDE_ALL_STATUSES = 'All statuses';

export function UnassignedSourcesTable() {
  const [statusFilter, setStatusFilter] = useState(INCLUDE_ALL_STATUSES);

  const { data, error } = useQuery<UnassignedSourceResponse[] | undefined>({
    initialData: undefined,
    queryKey: [],
    queryFn: async () => {
      const unassignedSources = await lightcurveApi.getUnassignedSources();
      if (!unassignedSources) return;
      return unassignedSources;
    },
  });

  if (error) {
    throw new Error(error.message);
  }

  const tableData = useMemo(() => {
    if (!data) return [];
    return data
      .filter((s) =>
        statusFilter === 'All statuses' ? s : s.status === statusFilter
      )
      .map((s) => ({
        id: s.source_id,
        position: `RA: ${s.ra.toFixed(5)}\u00B0, Dec: ${s.dec.toFixed(5)}\u00B0`,
        // detections: getDetections([s.first_seen, s.last_seen]),
        first_seen: s.first_seen,
        last_seen: s.last_seen,
        status: s.status,
        review: s.source_id,
      }));
  }, [data, statusFilter]);

  const columns = useMemo(() => {
    return [
      {
        header: 'Source ID',
        accessorFn: (row) => row.id,
        size: 250,
      },
      {
        header: 'Position (ICRS)',
        accessorKey: 'position',
      },
      // {
      //   header: 'Detections',
      //   accessorKey: 'detections'
      // },
      {
        header: 'First Seen',
        accessorKey: 'first_seen',
      },
      {
        header: 'Last Seen',
        accessorKey: 'last_seen',
      },
      {
        header: 'Status',
        size: 100,
        accessorKey: 'status',
      },
      {
        header: 'Review',
        accessorFn: (row) => row.review,
        size: 100,
        cell: ({ getValue }) => {
          const id = getValue() as string;
          return (
            <Link
              className="text-so-blue to-unassigned-sources font-bold"
              to={id}
            >
              Review
            </Link>
          );
        },
      },
    ] as ColumnDef<UnassignedSourcesTableData>[];
  }, []);

  return (
    <div className="unassigned-source-page-container">
      <CrossMatchHeader />
      <div className="unassigned-sources-table-subheader">
        <div>
          <h3>Unassigned sources</h3>
          <p>Detected sources awaiting review</p>
        </div>
        <div className="unassigned-status-filter-container">
          <label
            htmlFor="unassigned-status-filter"
            className="small-txt font-medium"
          >
            Status
          </label>
          <select
            className="unassigned-status-select"
            id="unassigned-status-filter"
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            {[INCLUDE_ALL_STATUSES].concat(SourceStatuses).map((s) => (
              <option key={s} value={s}>
                {formatSourceStatus(s)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <p className="small-txt">
        {tableData.length}{' '}
        {statusFilter === INCLUDE_ALL_STATUSES
          ? 'detected'
          : formatSourceStatus(statusFilter).toLowerCase()}{' '}
        sources awaiting review
      </p>
      <Table
        className="unassigned-sources-table"
        data={tableData}
        columns={columns}
      />
    </div>
  );
}

export function CrossMatchHeader() {
  return (
    <div className="cross-match-header">
      <h2>Cross Matcher</h2>
      <p>
        Review unassigned LightcurveDB detections before any catalogue action.
      </p>
    </div>
  );
}

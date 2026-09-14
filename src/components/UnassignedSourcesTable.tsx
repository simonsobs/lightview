import { useMemo, useState } from 'react';
import { useQuery } from '../hooks/useQuery';
import { lightcurveApi } from '../api/client';
import { SourceStatuses, UnassignedSourceResponse } from '../types';
import { Table } from './Table';
import { ColumnDef } from '@tanstack/react-table';
import { Link } from 'react-router';
import { formatSourceStatus } from '../utils/lightcurveDataHelpers';

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
        size: 310,
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
        accessorKey: 'status',
      },
      {
        header: 'Review',
        accessorFn: (row) => row.review,
        cell: ({ getValue }) => {
          const id = getValue() as string;
          return <Link to={id}>Review</Link>;
        },
      },
    ] as ColumnDef<UnassignedSourcesTableData>[];
  }, []);

  return (
    <div>
      <div>
        <h2>Cross Matcher</h2>
        <p>
          Review unassigned LightcurveDB detections before any catalogue action.
        </p>
      </div>
      <div>
        <div>
          <h3>Unassigned sources</h3>
          <p>Detected sources awaiting review</p>
        </div>
        <div>
          <label>
            Status
            <select onChange={(e) => setStatusFilter(e.target.value)}>
              {[INCLUDE_ALL_STATUSES].concat(SourceStatuses).map((s) => (
                <option key={s} value={s}>
                  {formatSourceStatus(s)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <div>
        {tableData.length}{' '}
        {statusFilter === INCLUDE_ALL_STATUSES
          ? 'detected'
          : formatSourceStatus(statusFilter).toLowerCase()}{' '}
        sources awaiting review
      </div>
      <Table data={tableData} columns={columns} />
    </div>
  );
}

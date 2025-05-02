import { useMemo } from 'react';
import { SourceResponse, SourceResponseWithNanoplot } from '../types';
import { SERVICE_URL } from '../configs/constants';
import { Table } from './Table';
import { Link } from 'react-router';
import { ColumnDef, InitialTableState } from '@tanstack/react-table';
import { useQuery } from '../hooks/useQuery';
import { getNanoPlotSVG } from '../utils/nanoPlotHelpers';
import './styles/table.css';

/**
 * Renders a Table of sources returned by the /sources endpoint
 */
export function Sources() {
  const { data: sources } = useQuery<SourceResponseWithNanoplot[] | undefined>({
    initialData: undefined,
    queryKey: [],
    queryFn: async () => {
      const response: Response = await fetch(`${SERVICE_URL}/sources/`);
      if (!response.ok) {
        throw new Error(`Error fetching sources: ${response.statusText}`);
      }
      const responseJson: SourceResponse[] =
        (await response.json()) as SourceResponse[];

      const sourcesWithNanoplot = await Promise.all(
        responseJson.map(async (r) => {
          const plot = await getNanoPlotSVG(r.id);
          return {
            ...r,
            nanoplot: plot ?? '',
          } as SourceResponseWithNanoplot;
        })
      );

      return sourcesWithNanoplot;
    },
  });

  const initialState: InitialTableState = useMemo(() => {
    return {
      pagination: {
        pageSize: 15,
      },
    };
  }, []);

  return (
    sources && (
      <Table
        initialState={initialState}
        data={sources}
        columns={
          [
            {
              header: 'ID',
              // Link to individual sources from the table
              cell: ({ row }) => (
                <Link to={`/source/${row.original.id}`}>{row.original.id}</Link>
              ),
              size: 50,
              accessorFn: (row) => row.id,
              sortingFn: (rowA, rowB) => rowA.original.id - rowB.original.id,
            },
            {
              header: 'ra',
              accessorFn: (row) => row.ra.toFixed(5),
              size: 50,
            },
            {
              header: 'dec',
              accessorFn: (row) => row.dec.toFixed(5),
              size: 50,
            },
            {
              header: 'flux',
              cell: ({ row }) => (
                <div
                  dangerouslySetInnerHTML={{ __html: row.original.nanoplot }}
                />
              ),
            },
          ] as ColumnDef<SourceResponseWithNanoplot>[]
        }
      />
    )
  );
}

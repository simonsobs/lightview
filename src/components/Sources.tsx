import { SourceResponse } from '../types';
import { SERVICE_URL } from '../configs/constants';
import { Table } from './Table';
import { Link } from 'react-router';
import { ColumnDef } from '@tanstack/react-table';
import './styles/table.css';
import { useQuery } from '../hooks/useQuery';

/**
 * Renders a Table of sources returned by the /sources endpoint
 */
export function Sources() {
  const { data: sources } = useQuery<SourceResponse[] | undefined>({
    initialData: undefined,
    queryKey: [],
    queryFn: async () => {
      const response: Response = await fetch(`${SERVICE_URL}/sources/`);
      if (!response.ok) {
        throw new Error(`Error fetching sources: ${response.statusText}`);
      }
      const responseJson: SourceResponse[] =
        (await response.json()) as SourceResponse[];
      return responseJson;
    },
  });

  return (
    sources && (
      <Table
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
              size: 125,
            },
            {
              header: 'dec',
              accessorFn: (row) => row.dec.toFixed(5),
              size: 125,
            },
          ] as ColumnDef<SourceResponse>[]
        }
      />
    )
  );
}

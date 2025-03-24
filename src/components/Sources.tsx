import { useState, useEffect } from 'react';
import { SourceResponse } from '../types';
import { SERVICE_URL } from '../configs/constants';
import { Table } from './Table';
import { Link } from 'react-router';
import { ColumnDef } from '@tanstack/react-table';
import './styles/table.css';

export function Sources() {
  const [sources, setSources] = useState<SourceResponse[] | undefined>(
    undefined
  );

  useEffect(() => {
    async function getSources() {
      try {
        const response: Response = await fetch(`${SERVICE_URL}/sources/`);
        if (!response.ok) {
          throw new Error(`Error fetching sources: ${response.statusText}`);
        }
        const sources: SourceResponse[] =
          (await response.json()) as SourceResponse[];
        setSources(sources);
      } catch (e) {
        console.error(e);
      }
    }
    void getSources();
  }, []);

  return (
    sources && (
      <Table
        data={sources}
        columns={
          [
            {
              header: 'ID',
              cell: ({ row }) => (
                <Link to={`/source/${row.original.id}`}>{row.original.id}</Link>
              ),
              size: 50,
              accessorFn: (row) => row.id,
              sortingFn: (rowA, rowB) =>
                rowA.original.id < rowB.original.id ? -1 : 1,
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

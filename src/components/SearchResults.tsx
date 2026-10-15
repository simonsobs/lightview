import { useMemo } from 'react';
import { useLocation, useParams, Link } from 'react-router';
import { SourceResponse } from '../types';
import { ColumnDef } from '@tanstack/react-table';
import { Table } from './Table';
import { lightcurveApi } from '../api/client';
import { useQuery } from '../hooks/useQuery';

type SearchConfig = {
  label: string;
  search: (query: string) => Promise<SourceResponse[]>;
};

// Maps the `/search/<type>` route segment to its display label and fetcher; add future search
// types here. A Map (rather than an object) so a route like `/search/constructor` can't match an
// inherited property.
const SEARCHES = new Map<string, SearchConfig>([
  [
    'cone',
    {
      label: 'Cone search',
      search: (query) => lightcurveApi.getNearbySources(query),
    },
  ],
]);

export function SearchResults() {
  const params = useParams();
  const location = useLocation();
  const searchType = params['*'] ?? '';
  const searchConfig = SEARCHES.get(searchType);

  const { data: results, error } = useQuery<SourceResponse[] | undefined>({
    initialData: undefined,
    queryKey: [searchType, location.search],
    queryFn: async () => {
      if (!searchConfig) {
        throw new Error(`Unknown search type "${searchType}".`);
      }
      if (!location.search) {
        throw new Error('No search parameters were provided.');
      }
      return await searchConfig.search(location.search);
    },
  });

  // Handled by the ErrorBoundary, which shows the error's message (the server's `detail`, when
  // the API returns one)
  if (error) {
    throw error;
  }

  const searchParameters = useMemo(() => {
    if (!location.search) return;

    const params = new URLSearchParams(location.search);

    let paramsString = '{ ';

    let i = 1;
    for (const [key, value] of params.entries()) {
      paramsString += `{${key}: ${value}}`;
      if (i === params.size) {
        paramsString += ' }';
      } else {
        paramsString += ', ';
      }
      i++;
    }

    return paramsString;
  }, [location.search]);

  return (
    <main>
      {results ? (
        <>
          {searchParameters && (
            <h3>
              {searchConfig?.label} results for{' '}
              <span style={{ marginLeft: 10 }}>
                '<code>{searchParameters}</code>'
              </span>
            </h3>
          )}
          <Table
            className="themed-table"
            data={results}
            columns={
              [
                {
                  header: 'Source ID',
                  // Link to individual sources from the table
                  cell: ({ row }) => (
                    <Link
                      className="text-so-blue"
                      to={`/source/${row.original.source_id}`}
                    >
                      {row.original.source_id}
                    </Link>
                  ),
                  size: 50,
                  accessorFn: (row) => row.source_id,
                },
                {
                  header: 'RA (deg)',
                  accessorFn: (row) => row.ra,
                  cell: ({ row }) => (
                    <span title={String(row.original.ra)}>
                      {row.original.ra.toFixed(3)}
                    </span>
                  ),
                  size: 125,
                },
                {
                  header: 'Dec (deg)',
                  accessorFn: (row) => row.dec,
                  cell: ({ row }) => (
                    <span title={String(row.original.dec)}>
                      {row.original.dec.toFixed(3)}
                    </span>
                  ),
                  size: 125,
                },
              ] as ColumnDef<SourceResponse>[]
            }
          />
        </>
      ) : (
        <h3>Searching...</h3>
      )}
    </main>
  );
}

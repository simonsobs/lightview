import { useEffect, useMemo, useState } from 'react';
import { useLocation, useParams, Link } from 'react-router';
import { SERVICE_URL } from '../configs/constants';
import { SourceResponse } from '../types';
import { ColumnDef } from '@tanstack/react-table';
import { Table } from './Table';

export function SearchResults() {
  const params = useParams();
  const location = useLocation();
  const [results, setResults] = useState<SourceResponse[] | undefined>(
    undefined
  );

  useEffect(() => {
    async function getSearchResults() {
      if (params['*'] === 'cone' && location.search) {
        const response: Response = await fetch(
          `${SERVICE_URL}/sources/cone/${location.search}`
        );
        const data: SourceResponse[] =
          (await response.json()) as SourceResponse[];
        setResults(data);
      }
    }

    void getSearchResults();
  }, [params, location]);

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

  const searchType = params['*'] === 'cone' ? 'Cone search' : 'Search';

  return (
    <main>
      {results ? (
        <>
          {searchParameters && (
            <h3>
              {searchType} results for{' '}
              <span style={{ marginLeft: 10 }}>
                '<code>{searchParameters}</code>'
              </span>
            </h3>
          )}
          <Table
            data={results}
            columns={
              [
                {
                  header: 'ID',
                  // Link to individual sources from the table
                  cell: ({ row }) => (
                    <Link to={`/source/${row.original.id}`}>
                      {row.original.id}
                    </Link>
                  ),
                  size: 50,
                  accessorFn: (row) => row.id,
                  sortingFn: (rowA, rowB) =>
                    rowA.original.id - rowB.original.id,
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
        </>
      ) : (
        <h3>Searching...</h3>
      )}
    </main>
  );
}

import { useMemo, useState } from 'react';
import { SourcesFeedItem, SourcesFeedResponse } from '../types';
import { Table } from './Table';
import { Link } from 'react-router';
import { ColumnDef, InitialTableState } from '@tanstack/react-table';
import { useQuery } from '../hooks/useQuery';
import { getNanoPlotSVG } from '../utils/nanoPlotHelpers';
import './styles/table.css';
import { DEFAULT_SOURCES_PER_PAGE } from '../configs/constants';

/**
 * Renders a Table of sources returned by the /sources endpoint
 */
export function Sources() {
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const [totalSources, setTotalSources] = useState<number | undefined>(
    undefined
  );
  const { data: sources } = useQuery<SourcesFeedResponse['items'] | undefined>({
    initialData: undefined,
    queryKey: [currentPageNumber],
    queryFn: async () => {
      const start =
        currentPageNumber === 1
          ? 0
          : (currentPageNumber - 1) * DEFAULT_SOURCES_PER_PAGE + 1;
      const response: Response = await fetch(
        `${import.meta.env.VITE_SERVICE_URL}/sources/feed?start=${start}`
      );
      if (!response.ok) {
        throw new Error(`Error fetching sources: ${response.statusText}`);
      }

      const responseJson: SourcesFeedResponse =
        (await response.json()) as SourcesFeedResponse;

      setTotalSources(responseJson.total_number_of_sources);

      const sourcesWithNanoplot = (await Promise.all(
        responseJson.items.map(async (r) => {
          const plot = await getNanoPlotSVG(r.source_id);
          return {
            ...r,
            nanoplot: plot ?? '',
          };
        })
      )) as SourcesFeedResponse['items'];

      return sourcesWithNanoplot;
    },
  });

  const initialState: InitialTableState = useMemo(() => {
    return {
      pagination: {
        pageSize: DEFAULT_SOURCES_PER_PAGE,
      },
    };
  }, []);

  const customPaginationState = useMemo(() => {
    return {
      totalItems: totalSources ?? 0,
      itemsPerPage: DEFAULT_SOURCES_PER_PAGE,
      currentPageNumber,
      setCurrentPageNumber,
    };
  }, [totalSources, currentPageNumber]);

  return (
    <Table
      initialState={initialState}
      customPaginationState={customPaginationState}
      sortable={false}
      data={sources ?? []}
      columns={
        [
          {
            header: 'ID',
            // Link to individual sources from the table
            cell: ({ row }) => (
              <Link to={`/source/${row.original.source_id}`}>
                {row.original.source_id}
              </Link>
            ),
            size: 50,
            accessorFn: (row) => row.source_id,
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
                dangerouslySetInnerHTML={{
                  __html: row.original.nanoplot ?? '',
                }}
              />
            ),
          },
        ] as ColumnDef<SourcesFeedItem>[]
      }
    />
  );
}

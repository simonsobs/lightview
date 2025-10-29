import { useMemo, useState } from 'react';
import { SourcesFeedItem, SourcesFeedResponse } from '../types';
import { Table } from './Table';
import { Link } from 'react-router';
import { ColumnDef, InitialTableState } from '@tanstack/react-table';
import { useQuery } from '../hooks/useQuery';
import { getNanoPlotSVG } from '../utils/nanoPlotHelpers';
import { DEFAULT_SOURCES_PER_PAGE } from '../configs/constants';

/**
 * Renders a Table of sources returned by the /sources endpoint
 */
export function Sources() {
  const [currentPageNumber, setCurrentPageNumber] = useState(1);

  const { data, isLoading } = useQuery<
    | { sources: SourcesFeedResponse['items']; totalNumberOfSources: number }
    | undefined
  >({
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

      const sourcesWithNanoplot = (await Promise.all(
        responseJson.items.map(async (r) => {
          const plotData = {
            time: r.time,
            flux: r.flux,
          };
          const plot = await getNanoPlotSVG(plotData);
          return {
            ...r,
            nanoplot: plot ?? '',
          };
        })
      )) as SourcesFeedResponse['items'];

      return {
        sources: sourcesWithNanoplot,
        totalNumberOfSources: responseJson.total_number_of_sources,
      };
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
      totalItems: data?.totalNumberOfSources ?? 0,
      itemsPerPage: DEFAULT_SOURCES_PER_PAGE,
      currentPageNumber,
      setCurrentPageNumber,
    };
  }, [data?.totalNumberOfSources, currentPageNumber]);

  return (
    <Table
      initialState={initialState}
      customPaginationState={customPaginationState}
      paginationControlsPosition="top"
      sortable={false}
      loading={isLoading}
      data={data?.sources ?? []}
      rowHeight={70}
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
            // accessorFn: (row) => row.ra.toFixed(3),
            cell: ({ row }) => (
              <span title={String(row.original.ra)}>
                {row.original.ra.toFixed(3)}
              </span>
            ),
            size: 50,
          },
          {
            header: 'dec',
            // accessorFn: (row) => row.dec.toFixed(3),
            cell: ({ row }) => (
              <span title={String(row.original.dec)}>
                {row.original.dec.toFixed(3)}
              </span>
            ),
            size: 50,
          },
          {
            header: 'recent data',
            size: 200,
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

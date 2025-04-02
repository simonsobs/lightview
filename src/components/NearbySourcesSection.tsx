import {
  DEFAULT_NEARBY_SOURCE_RADIUS,
  SERVICE_URL,
} from '../configs/constants';
import { useQuery } from '../hooks/useQuery';
import { SourceResponse } from '../types';
import { Table } from './Table';
import { Link } from 'react-router';

type NearbySourcesProps = Omit<SourceResponse, 'variable'>;

/** Renders a Table of sources found within a cone search of x radius from a given source */
export function NearbySourcesSection({ id, ra, dec }: NearbySourcesProps) {
  const { data: nearbySources, isLoading } = useQuery({
    initialData: undefined,
    queryKey: [],
    queryFn: async () => {
      const response: Response = await fetch(
        `${SERVICE_URL}/sources/cone/?ra=${ra}&dec=${dec}&radius=${DEFAULT_NEARBY_SOURCE_RADIUS}`
      );
      if (!response.ok) {
        throw new Error(
          `Error fetching nearby sources: ${response.statusText}`
        );
      }
      const data: SourceResponse[] =
        (await response.json()) as SourceResponse[];
      // Filter out current source's data
      return data.filter((d) => d.id !== id);
    },
  });

  return (
    <div>
      <h3>Nearby</h3>
      {isLoading ? (
        <h4>Loading...</h4>
      ) : nearbySources && nearbySources.length ? (
        <Table
          data={nearbySources}
          columns={[
            {
              header: 'ID',
              // Link to individual sources from the table
              cell: ({ row }) => (
                <Link to={`/source/${row.original.id}`}>{row.original.id}</Link>
              ),
              accessorFn: (row) => row.id,
            },
            {
              header: 'Flux (latest)',
              accessorFn: () => Math.random() * 10,
              // accessorFn: (row) => row.latest_flux,
            },
            {
              header: 'Flux (1 mo)',
              accessorFn: () => Math.random() * 10,
              // accessorFn: (row) => row.month_old_flux,
            },
          ]}
        />
      ) : (
        <h4>
          <em>No results</em>
        </h4>
      )}
    </div>
  );
}

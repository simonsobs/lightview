import { DEFAULT_NEARBY_SOURCE_RADIUS } from '../configs/constants';
import { SourceResponse } from '../types';
import { Table } from './Table';
import { Link } from 'react-router';

type NearbySourcesProps = {
  nearbySources: SourceResponse[] | undefined;
  isLoading: boolean;
  error: Error | null;
};

/** Renders a Table of sources found within a cone search of x radius from a given source */
export function NearbySourcesSection({
  nearbySources,
  isLoading,
  error,
}: NearbySourcesProps) {
  return (
    <div>
      <h3
        className="source-section-h3"
        title={`Displays cone search results within ${DEFAULT_NEARBY_SOURCE_RADIUS}° radius of this source.`}
      >
        Nearby Sources
      </h3>
      {isLoading ? (
        <h4>Loading...</h4>
      ) : error ? (
        <h4>There was an error loading nearby sources.</h4>
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
              size: 75,
            },
            // {
            //   header: 'Flux (latest)',
            //   accessorFn: () => (Math.random() * 10).toFixed(1),
            //   // accessorFn: (row) => row.latest_flux,
            // },
            // {
            //   header: 'Flux (1 mo)',
            //   accessorFn: () => (Math.random() * 10).toFixed(1),
            //   // accessorFn: (row) => row.month_old_flux,
            // },
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

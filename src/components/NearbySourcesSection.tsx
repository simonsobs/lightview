import { SourceResponse } from '../types';
import { RangeInput } from './RangeInput';
import { Table } from './Table';
import { Link } from 'react-router';

type NearbySourcesProps = {
  nearbySources: SourceResponse[] | undefined;
  isLoading: boolean;
  error: Error | null;
  nearbySourceRadius: number;
  setNearbySourceRadius: (radius: number) => void;
};

/** Renders a Table of sources found within a cone search of x radius from a given source */
export function NearbySourcesSection({
  nearbySources,
  isLoading,
  error,
  nearbySourceRadius,
  setNearbySourceRadius,
}: NearbySourcesProps) {
  return (
    <div>
      <h3 className="source-section-h3">Nearby Sources</h3>
      <RangeInput
        min={0.1}
        max={5}
        step={0.1}
        defaultValue={nearbySourceRadius}
        onFinalChange={setNearbySourceRadius}
        label="Cone search radius:"
        units="degrees"
      />
      <div className="nearby-sources-results">
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
                  <Link to={`/source/${row.original.id}`}>
                    {row.original.id}
                  </Link>
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
    </div>
  );
}

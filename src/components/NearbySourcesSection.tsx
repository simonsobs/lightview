import { Table } from './Table';

const MOCK_NEARBY_DATA = [
  {
    id: 92838,
    latest_flux: 12.2,
    month_old_flux: 14.2,
  },
  {
    id: 99291,
    latest_flux: 12.1,
    month_old_flux: 1.2,
  },
] as { id: number; latest_flux: number; month_old_flux: number }[];

export function NearbySourcesSection() {
  return (
    <div>
      <h3>Nearby</h3>
      <Table
        data={MOCK_NEARBY_DATA}
        columns={[
          {
            header: 'ID',
            accessorFn: (row) => row.id,
          },
          {
            header: 'Flux (latest)',
            accessorFn: (row) => row.latest_flux,
          },
          {
            header: 'Flux (1 mo)',
            accessorFn: (row) => row.month_old_flux,
          },
        ]}
      />
    </div>
  );
}

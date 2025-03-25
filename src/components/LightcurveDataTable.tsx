import { useMemo } from 'react';
import { LightcurveData } from '../types';
import { Table } from './Table';
import { ColumnDef, InitialTableState } from '@tanstack/react-table';

type LightcurveTableData = {
  id: number;
  frequency: number;
  time: string;
  timeParsed: number;
  i_flux: number;
  i_uncertainty: number;
  q_flux: number;
  q_uncertainty: number;
  u_flux: number;
  u_uncertainty: number;
};
export function LightcurveDataTable({
  lightcurveData,
}: {
  lightcurveData: LightcurveData;
}) {
  const tableData = useMemo(() => {
    const data: LightcurveTableData[] = [];
    lightcurveData.bands.forEach((band) => {
      band.id.forEach((id, idx) => {
        data.push({
          id,
          frequency: band.band.frequency,
          time: band.time[idx],
          timeParsed: Date.parse(band.time[idx]),
          i_flux: band.i_flux[idx],
          i_uncertainty: band.i_uncertainty[idx],
          q_flux: band.q_flux[idx],
          q_uncertainty: band.q_uncertainty[idx],
          u_flux: band.u_flux[idx],
          u_uncertainty: band.u_uncertainty[idx],
        });
      });
    });
    return data;
  }, [lightcurveData]);

  const columns = useMemo(() => {
    return [
      {
        header: 'ID',
        accessorFn: (row) => row.id,
        sortingFn: (rowA, rowB) => rowA.original.id - rowB.original.id,
      },
      {
        header: 'Time',
        accessorKey: 'time',
        accessorFn: (row) => row.time,
        sortingFn: (rowA, rowB) =>
          rowA.original.timeParsed - rowB.original.timeParsed,
      },
      {
        header: 'Frequency',
        accessorFn: (row) => row.frequency,
        sortingFn: (rowA, rowB) =>
          rowA.original.frequency - rowB.original.frequency,
      },
      {
        header: 'Flux (I)',
        accessorFn: (row) => row.i_flux,
        sortingFn: (rowA, rowB) => rowA.original.i_flux - rowB.original.i_flux,
      },
      {
        header: 'Flux Uncertainty (I)',
        accessorFn: (row) => row.i_uncertainty,
        sortingFn: (rowA, rowB) =>
          rowA.original.i_uncertainty - rowB.original.i_uncertainty,
      },
      {
        header: 'Flux (Q)',
        accessorFn: (row) => row.q_flux,
        sortingFn: (rowA, rowB) => rowA.original.q_flux - rowB.original.q_flux,
      },
      {
        header: 'Flux Uncertainty (Q)',
        accessorFn: (row) => row.q_uncertainty,
        sortingFn: (rowA, rowB) =>
          rowA.original.q_uncertainty - rowB.original.q_uncertainty,
      },
      {
        header: 'Flux (U)',
        accessorFn: (row) => row.u_flux,
        sortingFn: (rowA, rowB) => rowA.original.u_flux - rowB.original.u_flux,
      },
      {
        header: 'Flux Uncertainty (U)',
        accessorFn: (row) => row.u_uncertainty,
        sortingFn: (rowA, rowB) =>
          rowA.original.u_uncertainty - rowB.original.u_uncertainty,
      },
    ] as ColumnDef<LightcurveTableData>[];
  }, [tableData]);

  const initialState: InitialTableState = useMemo(() => {
    return {
      sorting: [{ id: 'time', desc: false }],
      pagination: {
        pageSize: 25,
      },
    };
  }, []);

  return (
    <>
      <h3>Data Access</h3>
      <Table data={tableData} columns={columns} initialState={initialState} />
    </>
  );
}

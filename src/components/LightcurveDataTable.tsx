import { useCallback, useMemo, useState } from 'react';
import { DataFileExtensions, LightcurveData } from '../types';
import { Table } from './Table';
import { ColumnDef, InitialTableState } from '@tanstack/react-table';
import { DATA_EXT_OPTIONS } from '../configs/constants';
import { DownloadIcon } from './icons/DownloadIcon';
import { fetchTableData } from '../utils/fetchUtils';

type LightcurveTableData = {
  id: number;
  frequency: number;
  time: string;
  timeParsed: number;
  i_flux: number;
  i_uncertainty: number;
  flags: string[];
  // q_flux: number | undefined;
  // q_uncertainty: number | undefined;
  // u_flux: number | undefined;
  // u_uncertainty: number | undefined;
};

/** Renders the lightcurve data used in the Lightcurve plot as a table instead */
export function LightcurveDataTable({
  lightcurveData,
}: {
  lightcurveData: LightcurveData;
}) {
  const [dataExtension, setDataExtension] = useState(DATA_EXT_OPTIONS[0]);

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
          flags: band.extra[idx] ? band.extra[idx].flags : [],
          // q_flux: 'q_flux' in band ? band.q_flux[idx] : undefined,
          // q_uncertainty: 'q_uncertainty' in band ? band.q_uncertainty[idx] : undefined,
          // u_flux: 'u_flux' in band ?band.u_flux[idx] : undefined,
          // u_uncertainty: 'u_uncertainty' in band ? band.u_uncertainty[idx] : undefined,
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
        size: 75,
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
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return <span title={String(value)}>{value.toFixed(3)}</span>;
        },
        sortingFn: (rowA, rowB) => rowA.original.i_flux - rowB.original.i_flux,
      },
      {
        header: 'Flux Uncertainty (I)',
        accessorFn: (row) => row.i_uncertainty,
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return <span title={String(value)}>{value.toFixed(3)}</span>;
        },
        sortingFn: (rowA, rowB) =>
          rowA.original.i_uncertainty - rowB.original.i_uncertainty,
      },
      {
        header: 'Flags',
        accessorFn: (row) => (row.flags.length ? row.flags.join(', ') : 'n/a'),
      },
      // {
      //   header: 'Flux (Q)',
      //   accessorFn: (row) => 'q_flux' in row ? row.q_flux : 'n/a',
      //   // sortingFn: (rowA, rowB) => rowA.original.q_flux - rowB.original.q_flux,
      // },
      // {
      //   header: 'Flux Uncertainty (Q)',
      //   accessorFn: (row) => 'q_uncertainty' in row ? row.q_uncertainty : 'n/a',
      //   // sortingFn: (rowA, rowB) =>
      //     // rowA.original.q_uncertainty - rowB.original.q_uncertainty,
      // },
      // {
      //   header: 'Flux (U)',
      //   accessorFn: (row) => 'u_flux' in row ? row.u_flux : 'n/a',
      //   // sortingFn: (rowA, rowB) => rowA.original.u_flux - rowB.original.u_flux,
      // },
      // {
      //   header: 'Flux Uncertainty (U)',
      //   accessorFn: (row) => 'u_uncertainty' in row ? row.u_uncertainty : 'n/a',
      //   // sortingFn: (rowA, rowB) =>
      //     // rowA.original.u_uncertainty - rowB.original.u_uncertainty,
      // },
    ] as ColumnDef<LightcurveTableData>[];
  }, []);

  const initialState: InitialTableState = useMemo(() => {
    return {
      sorting: [{ id: 'time', desc: false }],
      pagination: {
        pageSize: 25,
      },
    };
  }, []);

  const downloadData = useCallback(() => {
    fetchTableData(
      lightcurveData.source.id,
      dataExtension as DataFileExtensions
    );
  }, [dataExtension, lightcurveData.source]);

  return (
    <div className="data-access-container">
      <div className="download-data-container">
        <h3 className="source-section-h3">Data Access</h3>
        <div className="download-data-controls-container">
          <p className="download-data-label">Download as</p>
          <div className="download-data-controls">
            <select
              className="select-data-format"
              onChange={(e) => setDataExtension(e.target.value)}
              value={dataExtension}
            >
              {DATA_EXT_OPTIONS.map((ext) => (
                <option key={ext} value={ext}>
                  {ext.toUpperCase()}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="download-data-btn"
              onClick={downloadData}
              title="Download light curve data"
            >
              <DownloadIcon width={12} height={12} />
            </button>
          </div>
        </div>
      </div>
      <Table
        data={tableData}
        columns={columns}
        initialState={initialState}
        paginationControlsPosition="top"
      />
    </div>
  );
}

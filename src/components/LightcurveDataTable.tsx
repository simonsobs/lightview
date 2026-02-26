import { useCallback, useMemo, useState } from 'react';
import {
  DataFileExtensions,
  FrequencyLightcurveData,
  InstrumentLightcurveData,
} from '../types';
import { Table } from './Table';
import { ColumnDef, InitialTableState } from '@tanstack/react-table';
import { DATA_EXT_OPTIONS } from '../configs/constants';
import { DownloadIcon } from './icons/DownloadIcon';
import { fetchTableData } from '../utils/fetchUtils';

type LightcurveTableData = {
  id: string;
  frequency: number;
  time: string;
  timeParsed: number;
  ra: number;
  dec: number;
  flux: number;
  flux_err: number;
  flags: string[];
};

/** Renders the lightcurve data used in the Lightcurve plot as a table instead */
export function LightcurveDataTable({
  lightcurveData,
}: {
  lightcurveData: FrequencyLightcurveData | InstrumentLightcurveData;
}) {
  const [dataExtension, setDataExtension] = useState(DATA_EXT_OPTIONS[0]);

  const tableData = useMemo(() => {
    const data: LightcurveTableData[] = [];
    const keys = Object.keys(lightcurveData.lightcurves);
    keys.forEach((k) => {
      lightcurveData.lightcurves[k].measurement_id.forEach((id, idx) => {
        data.push({
          id,
          frequency: lightcurveData.lightcurves[k].frequency,
          time: lightcurveData.lightcurves[k].time[idx],
          timeParsed: Date.parse(lightcurveData.lightcurves[k].time[idx]),
          ra: lightcurveData.lightcurves[k].ra[idx],
          dec: lightcurveData.lightcurves[k].dec[idx],
          flux: lightcurveData.lightcurves[k].flux[idx],
          flux_err: lightcurveData.lightcurves[k].flux_err[idx],
          flags: lightcurveData.lightcurves[k].extra[idx]?.flags ?? [],
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
        size: 325,
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
        size: 100,
      },
      {
        header: 'RA',
        accessorFn: (row) => row.ra.toFixed(3),
        sortingFn: (rowA, rowB) => rowA.original.ra - rowB.original.ra,
        size: 60,
      },
      {
        header: 'Dec',
        accessorFn: (row) => row.dec.toFixed(3),
        sortingFn: (rowA, rowB) => rowA.original.dec - rowB.original.dec,
        size: 60,
      },
      {
        header: 'Flux Density',
        accessorFn: (row) => row.flux,
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return <span title={String(value)}>{value.toPrecision(3)}</span>;
        },
        sortingFn: (rowA, rowB) => rowA.original.flux - rowB.original.flux,
        size: 60,
      },
      {
        header: 'Flux Density Uncertainty',
        accessorFn: (row) => row.flux_err,
        cell: ({ getValue }) => {
          const value = getValue() as number;
          return <span title={String(value)}>{value.toPrecision(3)}</span>;
        },
        sortingFn: (rowA, rowB) =>
          rowA.original.flux_err - rowB.original.flux_err,
        size: 100,
      },
      {
        header: 'Flags',
        accessorFn: (row) => (row.flags.length ? row.flags.join(', ') : 'n/a'),
      },
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
      lightcurveData.source_id,
      dataExtension as DataFileExtensions
    );
  }, [dataExtension, lightcurveData.source_id]);

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
              // title="Download light curve data"
              title="This feature is currently unavailable."
              disabled
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

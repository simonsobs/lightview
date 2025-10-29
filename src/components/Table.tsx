import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  useReactTable,
  flexRender,
  InitialTableState,
} from '@tanstack/react-table';
import { TablePaginationControls } from './TablePaginationControls';
import './styles/table.css';

export type TableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  initialState?: InitialTableState;
  paginationControlsPosition?: 'top' | 'bottom' | 'both';
  className?: string;
  customPaginationState?: {
    totalItems: number;
    itemsPerPage: number;
    currentPageNumber: number;
    setCurrentPageNumber: (pageNumber: number) => void;
  };
  sortable?: boolean;
  loading?: boolean;
  rowHeight?: number;
};

/**
 * Wraps the internals of the Tanstack React Table component. For now, all Table
 * components created will include sorting but pagination is optional.
 */
export function Table<T>({
  data,
  columns,
  initialState = undefined,
  className = undefined,
  customPaginationState,
  sortable = true,
  paginationControlsPosition = 'bottom',
  loading = false,
  rowHeight = undefined,
}: TableProps<T>) {
  const isPaginated = initialState && 'pagination' in initialState;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: sortable ? getSortedRowModel() : undefined,
    getPaginationRowModel: isPaginated ? getPaginationRowModel() : undefined,
    initialState,
  });

  return (
    <div className="table-wrapper">
      {isPaginated && ['top', 'both'].includes(paginationControlsPosition) && (
        <TablePaginationControls
          table={table}
          customPaginationState={customPaginationState}
        />
      )}
      <table className={className}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th
                  key={header.id}
                  style={{
                    width: `${header.getSize()}px`,
                  }}
                >
                  {header.isPlaceholder ? null : (
                    <div
                      style={
                        sortable
                          ? {
                              position: 'relative',
                              cursor: header.column.getCanSort()
                                ? 'pointer'
                                : 'cursor',
                            }
                          : undefined
                      }
                      onClick={
                        sortable
                          ? header.column.getToggleSortingHandler()
                          : undefined
                      }
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext()
                      )}
                      <span
                        style={{
                          position: 'absolute',
                          right: -5,
                          top: -6,
                          fontSize: '0.9em',
                        }}
                      >
                        {{
                          asc: '▲',
                          desc: '▼',
                        }[header.column.getIsSorted() as string] ?? null}
                      </span>
                    </div>
                  )}
                </th>
              ))}
            </tr>
          ))}
        </thead>
        <tbody>
          {loading ? (
            <tr
              style={
                rowHeight
                  ? {
                      height:
                        rowHeight * table.getState().pagination.pageSize + 'px',
                    }
                  : undefined
              }
            >
              <td
                colSpan={table.getAllLeafColumns().length}
                style={{ textAlign: 'left', verticalAlign: 'top' }}
              >
                <span>Loading...</span>
              </td>
            </tr>
          ) : (
            table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                style={rowHeight ? { height: rowHeight + 'px' } : undefined}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{ width: `${cell.column.getSize()}px` }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
      {isPaginated &&
        ['bottom', 'both'].includes(paginationControlsPosition) && (
          <TablePaginationControls
            table={table}
            customPaginationState={customPaginationState}
          />
        )}
    </div>
  );
}

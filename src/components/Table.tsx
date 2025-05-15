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
                <th key={header.id}>
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
                      <span style={{ position: 'absolute', right: 5 }}>
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
          {table.getRowModel().rows.map((row) => (
            <tr key={row.id}>
              {row.getVisibleCells().map((cell) => (
                <td
                  key={cell.id}
                  style={{ width: `${cell.column.getSize()}px` }}
                >
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </td>
              ))}
            </tr>
          ))}
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

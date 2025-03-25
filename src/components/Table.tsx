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

type TableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
  initialState?: InitialTableState;
  className?: string;
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
}: TableProps<T>) {
  const isPaginated = initialState && 'pagination' in initialState;

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: isPaginated ? getPaginationRowModel() : undefined,
    initialState,
  });

  return (
    <>
      <table className={className}>
        <thead>
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => (
                <th key={header.id}>
                  {header.isPlaceholder ? null : (
                    <div
                      style={{
                        position: 'relative',
                        cursor: header.column.getCanSort()
                          ? 'pointer'
                          : 'cursor',
                      }}
                      onClick={header.column.getToggleSortingHandler()}
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
      {isPaginated && <TablePaginationControls table={table} />}
    </>
  );
}

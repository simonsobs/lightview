import {
  ColumnDef,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
  flexRender,
} from '@tanstack/react-table';

type TableProps<T> = {
  data: T[];
  columns: ColumnDef<T>[];
};

export function Table<T>({ data, columns }: TableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <table>
      <thead>
        {table.getHeaderGroups().map((headerGroup) => (
          <tr key={headerGroup.id}>
            {headerGroup.headers.map((header) => (
              <th key={header.id}>
                {header.isPlaceholder ? null : (
                  <div
                    style={{
                      position: 'relative',
                      cursor: header.column.getCanSort() ? 'pointer' : 'cursor',
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
              <td key={cell.id} style={{ width: `${cell.column.getSize()}px` }}>
                {flexRender(cell.column.columnDef.cell, cell.getContext())}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

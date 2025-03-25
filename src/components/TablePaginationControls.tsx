import { Table } from '@tanstack/react-table';

type TablePaginationControlsProps<T> = {
  table: Table<T>;
};

export function TablePaginationControls<T>({
  table,
}: TablePaginationControlsProps<T>) {
  const { pagination } = table.getState();

  return (
    <div className="pagination-controls">
      <button
        className="pagination-btn"
        title="Go to first page"
        type="button"
        onClick={() => table.setPageIndex(0)}
        disabled={!table.getCanPreviousPage()}
      >
        &lt;&lt;
      </button>
      <button
        className="pagination-btn"
        title="Go to previous page"
        type="button"
        onClick={() => table.previousPage()}
        disabled={!table.getCanPreviousPage()}
      >
        &lt;
      </button>
      <span>
        Page {pagination.pageIndex + 1} of {table.getPageCount()}
      </span>
      <button
        className="pagination-btn"
        title="Go to next page"
        type="button"
        onClick={() => table.nextPage()}
        disabled={!table.getCanNextPage()}
      >
        &gt;
      </button>
      <button
        className="pagination-btn"
        title="Go to last page"
        type="button"
        onClick={() => table.setPageIndex(table.getPageCount() - 1)}
        disabled={!table.getCanNextPage()}
      >
        &gt;&gt;
      </button>
    </div>
  );
}

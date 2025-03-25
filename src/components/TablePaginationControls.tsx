import { Table } from '@tanstack/react-table';

type TablePaginationControlsProps<T> = {
  table: Table<T>;
};

/**
 * Renders page details for the Table component when pagination is enabled. Also includes
 * buttons that do the following:
 * - Go to the first page
 * - Go to the previous page
 * - Go to the next page
 * - Go to the last page
 */
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

import { Table } from '@tanstack/react-table';
import { TableProps } from './Table';
import { useCallback } from 'react';

type TablePaginationControlsProps<T> = {
  table: Table<T>;
  customPaginationState: TableProps<T>['customPaginationState'];
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
  customPaginationState,
}: TablePaginationControlsProps<T>) {
  const handleGoToFirstPage = useCallback(() => {
    if (customPaginationState) {
      customPaginationState.setCurrentPageNumber(1);
    } else {
      table.setPageIndex(0);
    }
  }, [table, customPaginationState]);

  const handleGoToLastPage = useCallback(() => {
    if (customPaginationState) {
      const { totalItems, itemsPerPage, setCurrentPageNumber } =
        customPaginationState;
      const lastPage = Math.ceil(totalItems / itemsPerPage);
      setCurrentPageNumber(lastPage);
    } else {
      table.setPageIndex(table.getPageCount() - 1);
    }
  }, [table, customPaginationState]);

  const handleGoToPreviousPage = useCallback(() => {
    if (customPaginationState) {
      const { currentPageNumber, setCurrentPageNumber } = customPaginationState;
      setCurrentPageNumber(currentPageNumber - 1);
    } else {
      table.previousPage();
    }
  }, [table, customPaginationState]);

  const handleGoToNextPage = useCallback(() => {
    if (customPaginationState) {
      const { currentPageNumber, setCurrentPageNumber } = customPaginationState;
      setCurrentPageNumber(currentPageNumber + 1);
    } else {
      table.nextPage();
    }
  }, [table, customPaginationState]);

  const { pagination } = table.getState();
  const totalRows = customPaginationState
    ? customPaginationState.totalItems
    : table.getRowCount();
  const currentItemStart = customPaginationState
    ? (customPaginationState.currentPageNumber - 1) *
        customPaginationState.itemsPerPage +
      1
    : pagination.pageIndex * pagination.pageSize + 1;
  const currentItemStop = customPaginationState
    ? customPaginationState.currentPageNumber *
        customPaginationState.itemsPerPage >
      totalRows
      ? totalRows
      : customPaginationState.currentPageNumber *
        customPaginationState.itemsPerPage
    : (pagination.pageIndex + 1) * pagination.pageSize > totalRows
      ? totalRows
      : (pagination.pageIndex + 1) * pagination.pageSize;

  return (
    <div className="pagination-container">
      <div className="pagination-details">
        Displaying{' '}
        <span>
          {currentItemStart} - {currentItemStop}
        </span>{' '}
        of <span>{totalRows}</span>
      </div>
      <div className="pagination-controls">
        <button
          className="pagination-btn"
          title="Go to first page"
          type="button"
          onClick={handleGoToFirstPage}
          disabled={
            customPaginationState
              ? customPaginationState.currentPageNumber === 1
              : !table.getCanPreviousPage()
          }
        >
          &lt;&lt;
        </button>
        <button
          className="pagination-btn"
          title="Go to previous page"
          type="button"
          onClick={handleGoToPreviousPage}
          disabled={
            customPaginationState
              ? customPaginationState.currentPageNumber === 1
              : !table.getCanPreviousPage()
          }
        >
          &lt;
        </button>
        <span>
          Page{' '}
          {customPaginationState
            ? customPaginationState.currentPageNumber
            : table.getState().pagination.pageIndex + 1}{' '}
          of{' '}
          {customPaginationState
            ? Math.ceil(
                customPaginationState.totalItems /
                  customPaginationState.itemsPerPage
              )
            : table.getPageCount()}
        </span>
        <button
          className="pagination-btn"
          title="Go to next page"
          type="button"
          onClick={handleGoToNextPage}
          disabled={
            customPaginationState
              ? customPaginationState.currentPageNumber ===
                Math.ceil(
                  customPaginationState.totalItems /
                    customPaginationState.itemsPerPage
                )
              : !table.getCanNextPage()
          }
        >
          &gt;
        </button>
        <button
          className="pagination-btn"
          title="Go to last page"
          type="button"
          onClick={handleGoToLastPage}
          disabled={
            customPaginationState
              ? customPaginationState.currentPageNumber ===
                Math.floor(
                  customPaginationState.totalItems /
                    customPaginationState.itemsPerPage
                ) +
                  1
              : !table.getCanNextPage()
          }
        >
          &gt;&gt;
        </button>
      </div>
    </div>
  );
}

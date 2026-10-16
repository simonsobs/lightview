import { Table } from '@tanstack/react-table';
import { TableProps } from './Table';
import { useCallback } from 'react';

type TablePaginationControlsProps<T> = {
  table: Table<T>;
  customPaginationState: TableProps<T>['customPaginationState'];
  className?: string;
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
  className = undefined,
}: TablePaginationControlsProps<T>) {
  const { pagination } = table.getState();
  const totalRows = customPaginationState
    ? customPaginationState.totalItems
    : table.getRowCount();
  const pageSize = customPaginationState
    ? customPaginationState.itemsPerPage
    : pagination.pageSize;
  const currentPageNumber = customPaginationState
    ? customPaginationState.currentPageNumber
    : pagination.pageIndex + 1;
  // At least 1, so an empty table reads "Page 1 of 1" rather than "Page 1 of 0"
  const pageCount = Math.max(1, Math.ceil(totalRows / pageSize));
  const canGoPrevious = currentPageNumber > 1;
  const canGoNext = currentPageNumber < pageCount;
  // An empty table shows "0 - 0" rather than "1 - 0"
  const currentItemStart =
    totalRows === 0 ? 0 : (currentPageNumber - 1) * pageSize + 1;
  const currentItemStop = Math.min(currentPageNumber * pageSize, totalRows);

  const handleGoToFirstPage = useCallback(() => {
    if (customPaginationState) {
      customPaginationState.setCurrentPageNumber(1);
    } else {
      table.setPageIndex(0);
    }
  }, [table, customPaginationState]);

  const handleGoToLastPage = useCallback(() => {
    if (customPaginationState) {
      customPaginationState.setCurrentPageNumber(pageCount);
    } else {
      table.setPageIndex(pageCount - 1);
    }
  }, [table, customPaginationState, pageCount]);

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

  return (
    <div className={'pagination-container ' + (className ?? '')}>
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
          disabled={!canGoPrevious}
        >
          &lt;&lt;
        </button>
        <button
          className="pagination-btn"
          title="Go to previous page"
          type="button"
          onClick={handleGoToPreviousPage}
          disabled={!canGoPrevious}
        >
          &lt;
        </button>
        <span>
          Page {currentPageNumber} of {pageCount}
        </span>
        <button
          className="pagination-btn"
          title="Go to next page"
          type="button"
          onClick={handleGoToNextPage}
          disabled={!canGoNext}
        >
          &gt;
        </button>
        <button
          className="pagination-btn"
          title="Go to last page"
          type="button"
          onClick={handleGoToLastPage}
          disabled={!canGoNext}
        >
          &gt;&gt;
        </button>
      </div>
    </div>
  );
}

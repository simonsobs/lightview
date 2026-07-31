import { useState } from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {
  ColumnDef,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table';

import { TablePaginationControls } from '../../src/components/TablePaginationControls';
import { TableProps } from '../../src/components/Table';

type Row = { id: number };

const columns: ColumnDef<Row>[] = [{ accessorKey: 'id', header: 'ID' }];

function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({ id: i + 1 }));
}

function TableModeHarness({
  data,
  pageSize,
}: {
  data: Row[];
  pageSize: number;
}) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });

  return (
    <TablePaginationControls table={table} customPaginationState={undefined} />
  );
}

function CustomModeHarness({
  totalItems,
  itemsPerPage,
}: {
  totalItems: number;
  itemsPerPage: number;
}) {
  const [currentPageNumber, setCurrentPageNumber] = useState(1);
  const table = useReactTable({
    data: [] as Row[],
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  const customPaginationState: TableProps<Row>['customPaginationState'] = {
    totalItems,
    itemsPerPage,
    currentPageNumber,
    setCurrentPageNumber,
  };

  return (
    <TablePaginationControls
      table={table}
      customPaginationState={customPaginationState}
    />
  );
}

describe('TablePaginationControls', () => {
  describe('table-driven pagination', () => {
    it('shows the current page details and disables first/previous on page one', () => {
      render(<TableModeHarness data={makeRows(5)} pageSize={2} />);

      expect(screen.getByText('1 - 2')).toBeInTheDocument();
      expect(screen.getByText('5')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
      expect(screen.getByTitle('Go to first page')).toBeDisabled();
      expect(screen.getByTitle('Go to previous page')).toBeDisabled();
      expect(screen.getByTitle('Go to next page')).toBeEnabled();
      expect(screen.getByTitle('Go to last page')).toBeEnabled();
    });

    it('navigates forward and backward through pages', async () => {
      const user = userEvent.setup();
      render(<TableModeHarness data={makeRows(5)} pageSize={2} />);

      await user.click(screen.getByTitle('Go to next page'));
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
      expect(screen.getByText('3 - 4')).toBeInTheDocument();

      await user.click(screen.getByTitle('Go to next page'));
      expect(screen.getByText(/Page 3 of 3/)).toBeInTheDocument();
      expect(screen.getByText('5 - 5')).toBeInTheDocument();
      expect(screen.getByTitle('Go to next page')).toBeDisabled();
      expect(screen.getByTitle('Go to last page')).toBeDisabled();

      await user.click(screen.getByTitle('Go to previous page'));
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
    });

    it('jumps to the first and last pages', async () => {
      const user = userEvent.setup();
      render(<TableModeHarness data={makeRows(5)} pageSize={2} />);

      await user.click(screen.getByTitle('Go to last page'));
      expect(screen.getByText(/Page 3 of 3/)).toBeInTheDocument();

      await user.click(screen.getByTitle('Go to first page'));
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    });
  });

  describe('custom pagination state', () => {
    it('shows page details computed from the custom pagination state', () => {
      render(<CustomModeHarness totalItems={25} itemsPerPage={10} />);

      expect(screen.getByText('1 - 10')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
      expect(screen.getByTitle('Go to first page')).toBeDisabled();
      expect(screen.getByTitle('Go to previous page')).toBeDisabled();
    });

    it('clamps the displayed range on the final, partial page', async () => {
      const user = userEvent.setup();
      render(<CustomModeHarness totalItems={25} itemsPerPage={10} />);

      await user.click(screen.getByTitle('Go to last page'));

      expect(screen.getByText(/Page 3 of 3/)).toBeInTheDocument();
      expect(screen.getByText('21 - 25')).toBeInTheDocument();
      expect(screen.getByTitle('Go to next page')).toBeDisabled();
      expect(screen.getByTitle('Go to last page')).toBeDisabled();
    });

    it('advances the custom page number via next/previous', async () => {
      const user = userEvent.setup();
      render(<CustomModeHarness totalItems={25} itemsPerPage={10} />);

      await user.click(screen.getByTitle('Go to next page'));
      expect(screen.getByText(/Page 2 of 3/)).toBeInTheDocument();
      expect(screen.getByText('11 - 20')).toBeInTheDocument();

      await user.click(screen.getByTitle('Go to previous page'));
      expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();
    });
  });
});

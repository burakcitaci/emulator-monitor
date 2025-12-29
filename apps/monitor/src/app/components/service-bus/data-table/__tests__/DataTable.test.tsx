import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { ColumnDef } from '@tanstack/react-table';
import { DataTable } from '../DataTable';

interface TestData {
  id: string;
  name: string;
  status: string;
}

const mockColumns: ColumnDef<TestData>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'status',
    header: 'Status',
    enableColumnFilter: true,
    filterFn: (row, id, value) => {
      if (!value || !Array.isArray(value)) return true;
      return value.includes(row.original.status);
    },
    meta: {
      variant: 'multiSelect',
      label: 'Status',
      options: [
        { label: 'Active', value: 'active' },
        { label: 'Inactive', value: 'inactive' },
      ],
    },
  },
];

const mockData: TestData[] = [
  { id: '1', name: 'Item 1', status: 'active' },
  { id: '2', name: 'Item 2', status: 'inactive' },
  { id: '3', name: 'Item 3', status: 'active' },
];

describe('DataTable', () => {
  it('should render table with data', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        searchKey="name"
        searchPlaceholder="Search items..."
      />
    );

    expect(screen.getByText('Item 1')).toBeInTheDocument();
    expect(screen.getByText('Item 2')).toBeInTheDocument();
    expect(screen.getByText('Item 3')).toBeInTheDocument();
  });

  it('should show "No results" when data is empty', () => {
    render(
      <DataTable
        columns={mockColumns}
        data={[]}
        searchKey="name"
        searchPlaceholder="Search items..."
      />
    );

    expect(screen.getByText('No results.')).toBeInTheDocument();
  });

  it('should filter data based on search input', async () => {
    const user = userEvent.setup();

    render(
      <DataTable
        columns={mockColumns}
        data={mockData}
        searchKey="name"
        searchPlaceholder="Search items..."
      />
    );

    const searchInput = screen.getByPlaceholderText('Search items...');
    await user.type(searchInput, 'Item 1');

    await waitFor(() => {
      expect(screen.getByText('Item 1')).toBeInTheDocument();
      expect(screen.queryByText('Item 2')).not.toBeInTheDocument();
      expect(screen.queryByText('Item 3')).not.toBeInTheDocument();
    });
  });

  it('should display pagination controls with multiple pages', () => {
    const largeData = Array.from({ length: 25 }, (_, i) => ({
      id: `${i}`,
      name: `Item ${i}`,
      status: i % 2 === 0 ? 'active' : 'inactive',
    }));

    render(
      <DataTable
        columns={mockColumns}
        data={largeData}
        searchKey="name"
        searchPlaceholder="Search items..."
      />
    );

    // Check for pagination text or next/previous buttons
    const paginationText = screen.queryByText(/Page \d+ of \d+/);
    const nextButton = screen.queryByRole('button', { name: /next/i });
    
    expect(paginationText || nextButton).toBeTruthy();
  });
});
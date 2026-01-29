# Data Table Section

Table with sorting, filtering, pagination, and row selection.

## Dependencies

```bash
pnpm add @tanstack/react-table
```

## Types

```typescript
import {
  ColumnDef,
  SortingState,
  ColumnFiltersState,
  VisibilityState,
  PaginationState,
  RowSelectionState,
} from '@tanstack/react-table';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  searchKey?: string;
  searchPlaceholder?: string;
  showPagination?: boolean;
  showColumnToggle?: boolean;
  showRowSelection?: boolean;
  pageSize?: number;
  onRowClick?: (row: TData) => void;
}
```

## Base Data Table

```typescript
'use client';

import * as React from 'react';
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';

function DataTable<TData, TValue>({
  columns,
  data,
  searchKey,
  searchPlaceholder = 'Search...',
  showPagination = true,
  showColumnToggle = false,
  showRowSelection = false,
  pageSize = 10,
  onRowClick,
}: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState<RowSelectionState>({});
  const [globalFilter, setGlobalFilter] = React.useState('');

  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    onGlobalFilterChange: setGlobalFilter,
    globalFilterFn: 'includesString',
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
      globalFilter,
    },
    initialState: {
      pagination: { pageSize },
    },
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <DataTableToolbar
        table={table}
        searchKey={searchKey}
        searchPlaceholder={searchPlaceholder}
        globalFilter={globalFilter}
        setGlobalFilter={setGlobalFilter}
        showColumnToggle={showColumnToggle}
      />

      {/* Table */}
      <div className="rounded-lg border">
        <table className="w-full">
          <thead className="border-b bg-muted/50">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className="px-4 py-3 text-left text-sm font-medium text-muted-foreground"
                    style={{ width: header.getSize() }}
                  >
                    {header.isPlaceholder ? null : (
                      <DataTableColumnHeader
                        column={header.column}
                        title={flexRender(header.column.columnDef.header, header.getContext())}
                      />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={cn(
                    'border-b transition-colors hover:bg-muted/50',
                    row.getIsSelected() && 'bg-muted',
                    onRowClick && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row.original)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-4 py-3 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-muted-foreground"
                >
                  No results found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {showPagination && <DataTablePagination table={table} showRowSelection={showRowSelection} />}
    </div>
  );
}
```

## Column Header with Sorting

```typescript
import { Column } from '@tanstack/react-table';

interface DataTableColumnHeaderProps<TData, TValue> {
  column: Column<TData, TValue>;
  title: React.ReactNode;
}

function DataTableColumnHeader<TData, TValue>({
  column,
  title,
}: DataTableColumnHeaderProps<TData, TValue>) {
  if (!column.getCanSort()) {
    return <span>{title}</span>;
  }

  return (
    <button
      className="flex items-center gap-1 hover:text-foreground transition-colors -ml-2 px-2 py-1 rounded"
      onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
    >
      {title}
      {column.getIsSorted() === 'asc' ? (
        <ChevronUp className="h-4 w-4" />
      ) : column.getIsSorted() === 'desc' ? (
        <ChevronDown className="h-4 w-4" />
      ) : (
        <ChevronsUpDown className="h-4 w-4 opacity-50" />
      )}
    </button>
  );
}
```

## Toolbar with Search and Filters

```typescript
import { Table } from '@tanstack/react-table';

interface DataTableToolbarProps<TData> {
  table: Table<TData>;
  searchKey?: string;
  searchPlaceholder?: string;
  globalFilter: string;
  setGlobalFilter: (value: string) => void;
  showColumnToggle?: boolean;
}

function DataTableToolbar<TData>({
  table,
  searchKey,
  searchPlaceholder,
  globalFilter,
  setGlobalFilter,
  showColumnToggle,
}: DataTableToolbarProps<TData>) {
  const isFiltered = table.getState().columnFilters.length > 0 || globalFilter.length > 0;

  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex flex-1 items-center gap-2">
        {/* Search input */}
        <div className="relative max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            placeholder={searchPlaceholder}
            value={searchKey ? (table.getColumn(searchKey)?.getFilterValue() as string) ?? '' : globalFilter}
            onChange={(e) =>
              searchKey
                ? table.getColumn(searchKey)?.setFilterValue(e.target.value)
                : setGlobalFilter(e.target.value)
            }
            className="h-10 w-full rounded-lg border bg-background pl-9 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Clear filters */}
        {isFiltered && (
          <button
            onClick={() => {
              table.resetColumnFilters();
              setGlobalFilter('');
            }}
            className="flex items-center gap-1 rounded-lg border px-3 py-2 text-sm hover:bg-muted"
          >
            Reset
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Column visibility toggle */}
      {showColumnToggle && <DataTableViewOptions table={table} />}
    </div>
  );
}
```

## Column Visibility Toggle

```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { Settings2 } from 'lucide-react';

function DataTableViewOptions<TData>({ table }: { table: Table<TData> }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm hover:bg-muted">
          <Settings2 className="h-4 w-4" />
          View
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className="z-50 min-w-[150px] rounded-lg border bg-popover p-1 shadow-md"
        >
          {table
            .getAllColumns()
            .filter((column) => column.getCanHide())
            .map((column) => (
              <DropdownMenu.CheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none hover:bg-muted"
              >
                <div className={cn(
                  'h-4 w-4 rounded border flex items-center justify-center',
                  column.getIsVisible() && 'bg-primary border-primary'
                )}>
                  {column.getIsVisible() && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                {column.id}
              </DropdownMenu.CheckboxItem>
            ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
```

## Pagination Component

```typescript
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface DataTablePaginationProps<TData> {
  table: Table<TData>;
  showRowSelection?: boolean;
}

function DataTablePagination<TData>({
  table,
  showRowSelection,
}: DataTablePaginationProps<TData>) {
  return (
    <div className="flex items-center justify-between">
      {/* Row selection info */}
      {showRowSelection && (
        <div className="text-sm text-muted-foreground">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected.
        </div>
      )}

      <div className="flex items-center gap-6 ml-auto">
        {/* Rows per page */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Rows per page</span>
          <select
            value={table.getState().pagination.pageSize}
            onChange={(e) => table.setPageSize(Number(e.target.value))}
            className="h-8 rounded border bg-background px-2 text-sm"
          >
            {[10, 20, 30, 50, 100].map((pageSize) => (
              <option key={pageSize} value={pageSize}>
                {pageSize}
              </option>
            ))}
          </select>
        </div>

        {/* Page info */}
        <span className="text-sm text-muted-foreground">
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>

        {/* Navigation buttons */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => table.setPageIndex(0)}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 rounded border flex items-center justify-center disabled:opacity-50 hover:bg-muted"
          >
            <ChevronsLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="h-8 w-8 rounded border flex items-center justify-center disabled:opacity-50 hover:bg-muted"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 rounded border flex items-center justify-center disabled:opacity-50 hover:bg-muted"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <button
            onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            disabled={!table.getCanNextPage()}
            className="h-8 w-8 rounded border flex items-center justify-center disabled:opacity-50 hover:bg-muted"
          >
            <ChevronsRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
```

## Row Selection Column

```typescript
import { Checkbox } from '@/components/ui/checkbox';

function getSelectionColumn<TData>(): ColumnDef<TData> {
  return {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
    size: 40,
  };
}
```

## Actions Column

```typescript
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { MoreHorizontal, Pencil, Trash, Copy } from 'lucide-react';

function getActionsColumn<TData>(
  actions: {
    label: string;
    icon?: React.ReactNode;
    onClick: (row: TData) => void;
    variant?: 'default' | 'destructive';
  }[]
): ColumnDef<TData> {
  return {
    id: 'actions',
    cell: ({ row }) => (
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button className="h-8 w-8 rounded flex items-center justify-center hover:bg-muted">
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="end"
            className="z-50 min-w-[160px] rounded-lg border bg-popover p-1 shadow-md"
          >
            {actions.map((action, index) => (
              <DropdownMenu.Item
                key={index}
                onClick={() => action.onClick(row.original)}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm outline-none',
                  action.variant === 'destructive'
                    ? 'text-destructive hover:bg-destructive/10'
                    : 'hover:bg-muted'
                )}
              >
                {action.icon}
                {action.label}
              </DropdownMenu.Item>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    ),
    enableSorting: false,
    enableHiding: false,
    size: 50,
  };
}
```

## Column Definitions Helper

```typescript
import { ColumnDef } from '@tanstack/react-table';

// Helper to create sortable text column
function createTextColumn<TData>(
  accessorKey: keyof TData & string,
  header: string,
  options?: { enableSorting?: boolean; size?: number }
): ColumnDef<TData> {
  return {
    accessorKey,
    header,
    enableSorting: options?.enableSorting ?? true,
    size: options?.size,
  };
}

// Helper to create badge column
function createBadgeColumn<TData>(
  accessorKey: keyof TData & string,
  header: string,
  variants: Record<string, { label: string; className: string }>
): ColumnDef<TData> {
  return {
    accessorKey,
    header,
    cell: ({ getValue }) => {
      const value = getValue() as string;
      const variant = variants[value] || { label: value, className: '' };
      return (
        <span className={cn('inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium', variant.className)}>
          {variant.label}
        </span>
      );
    },
  };
}

// Helper to create date column
function createDateColumn<TData>(
  accessorKey: keyof TData & string,
  header: string,
  format: Intl.DateTimeFormatOptions = { dateStyle: 'medium' }
): ColumnDef<TData> {
  return {
    accessorKey,
    header,
    cell: ({ getValue }) => {
      const date = getValue() as Date | string;
      return new Intl.DateTimeFormat('en-US', format).format(new Date(date));
    },
  };
}
```

## Usage Examples

```tsx
// Define data type
interface User {
  id: string;
  name: string;
  email: string;
  status: 'active' | 'inactive' | 'pending';
  role: string;
  createdAt: Date;
}

// Define columns
const columns: ColumnDef<User>[] = [
  getSelectionColumn<User>(),
  createTextColumn<User>('name', 'Name'),
  createTextColumn<User>('email', 'Email'),
  createBadgeColumn<User>('status', 'Status', {
    active: { label: 'Active', className: 'bg-green-100 text-green-700' },
    inactive: { label: 'Inactive', className: 'bg-gray-100 text-gray-700' },
    pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-700' },
  }),
  createTextColumn<User>('role', 'Role'),
  createDateColumn<User>('createdAt', 'Created'),
  getActionsColumn<User>([
    { label: 'Edit', icon: <Pencil className="h-4 w-4" />, onClick: (user) => editUser(user) },
    { label: 'Copy ID', icon: <Copy className="h-4 w-4" />, onClick: (user) => copyId(user.id) },
    { label: 'Delete', icon: <Trash className="h-4 w-4" />, onClick: (user) => deleteUser(user), variant: 'destructive' },
  ]),
];

// Basic table
<DataTable columns={columns} data={users} searchKey="name" />

// With all features
<DataTable
  columns={columns}
  data={users}
  searchKey="name"
  searchPlaceholder="Search users..."
  showPagination={true}
  showColumnToggle={true}
  showRowSelection={true}
  pageSize={20}
  onRowClick={(user) => router.push(`/users/${user.id}`)}
/>

// Custom column definitions
const customColumns: ColumnDef<User>[] = [
  {
    accessorKey: 'name',
    header: 'Name',
    cell: ({ row }) => (
      <div className="flex items-center gap-3">
        <img src={row.original.avatar} className="h-8 w-8 rounded-full" />
        <div>
          <div className="font-medium">{row.original.name}</div>
          <div className="text-xs text-muted-foreground">{row.original.email}</div>
        </div>
      </div>
    ),
  },
  // ... more columns
];
```

## Key Takeaways

1. **TanStack Table**: Full-featured headless table library
2. **Sorting**: Click column headers to sort asc/desc
3. **Filtering**: Global search or per-column filters
4. **Pagination**: Configurable page size with navigation
5. **Selection**: Checkbox column with bulk selection
6. **Visibility**: Toggle columns on/off
7. **Actions**: Dropdown menu for row actions
8. **Helpers**: Column definition factories for common types

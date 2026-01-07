import { DropdownMenuTrigger } from '@radix-ui/react-dropdown-menu';
import { Table } from '@tanstack/react-table';
import { Plus, Settings2 } from 'lucide-react';
import { Button } from '../../ui/button';
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '../../ui/dropdown-menu';

interface DataTableViewOptionsProps<TData> {
  table: Table<TData>;
  onAdd?: () => void;
}

export function DataTableViewOptions<TData>({
  table,
  onAdd,
}: DataTableViewOptionsProps<TData>) {
  return (
    <div className="flex items-center gap-2">
      {/* ADD BUTTON — standalone */}
      {onAdd && (
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={onAdd}
        >
          <Plus className="h-3 w-3" />
          Create
        </Button>
      )}
      {/* VIEW DROPDOWN */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <Settings2 className="h-3 w-3" />
            View
          </Button>
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-[140px]">
          <DropdownMenuLabel className="text-xs">
            Toggle columns
          </DropdownMenuLabel>
          <DropdownMenuSeparator />

          {table
            .getAllColumns()
            .filter(
              (column) =>
                typeof column.accessorFn !== 'undefined' && column.getCanHide(),
            )
            .map((column) => (
              <DropdownMenuCheckboxItem
                key={column.id}
                className="capitalize text-xs"
                checked={column.getIsVisible()}
                onCheckedChange={(value) => column.toggleVisibility(!!value)}
              >
                {column.id}
              </DropdownMenuCheckboxItem>
            ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

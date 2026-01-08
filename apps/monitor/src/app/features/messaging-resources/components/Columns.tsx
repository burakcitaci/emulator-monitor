import { IconBrandAws, IconBrandAzure } from "@tabler/icons-react";
import { MessagingResource, Provider, ResourceType } from "../lib/entities";
import { Badge } from "../../../components/ui/badge";
import { Pause, Pencil, Play, Trash2 } from "lucide-react";

import { ColumnDef } from '@tanstack/react-table';

export const createColumns = (
  handleActivate: (id: string) => void,
  handleEdit: (resource: MessagingResource) => void,
  handleDelete: (id: string) => void,
): ColumnDef<MessagingResource>[] => {
  return [
    {
      header: 'Name',
      accessorKey: 'name',
      cell: ({ row }) => <div>{row.original.name}</div>,
    },
    {
      header: 'Provider',
      accessorKey: 'provider',
      enableColumnFilter: true,
      filterFn: (row, _id, value: Provider[]) =>
        value.includes(row.original.provider),
      meta: {
        variant: 'multiSelect',
        label: 'Provider',
        options: [
          { label: 'AWS', value: 'aws' },
          { label: 'Azure', value: 'azure' },
        ],
      },
      cell: ({ row }) =>
        row.original.provider === Provider.AWS ? (
          <IconBrandAws />
        ) : (
          <IconBrandAzure />
        ),
    },
    {
      header: 'Type',
      accessorKey: 'type',
      enableColumnFilter: true,
      filterFn: (row, _id, value: ResourceType[]) =>
        value.includes(row.original.type),
      meta: {
        variant: 'multiSelect',
        label: 'Type',
        options: [
          { label: 'Queue', value: 'queue' },
          { label: 'Topic', value: 'topic' },
        ],
      },
      cell: ({ row }) => <div>{row.original.type}</div>,
    },
    {
      header: 'Status',
      accessorKey: 'status',
      enableColumnFilter: true,
      filterFn: (row, _id, value: Array<'active' | 'inactive'>) =>
        value.includes(row.original.status),
      meta: {
        variant: 'multiSelect',
        label: 'Status',
        options: [
          { label: 'Active', value: 'active' },
          { label: 'Inactive', value: 'inactive' },
        ],
      },
      cell: ({ row }) => <div>{row.original.status}</div>,
    },
    {
      header: 'Actions',
      id: 'actions', // 👈 better than accessorKey for non-data columns
      cell: ({ row }) => (
        <div className="flex gap-2 justify-end">
          <Badge
            variant={row.original.status === 'active' ? 'outline' : 'default'}
            className="cursor-pointer"
            onClick={() => handleActivate(row.original.id)}
          >
            {row.original.status === 'active' ? (
              <Pause className="h-5 w-3" />
            ) : (
              <Play className="h-5 w-3" />
            )}
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer"
            onClick={() => handleEdit(row.original)}
          >
            <Pencil className="h-5 w-3" />
          </Badge>
          <Badge
            variant="outline"
            className="cursor-pointer"
            onClick={() => handleDelete(row.original.id)}
          >
            <Trash2 className="h-5 w-3" />
          </Badge>
        </div>
      ),
    },
  ];
};

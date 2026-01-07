import { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Label } from '../../components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';
import { Badge } from '../../components/ui/badge';
import { Trash2, Pencil, Play, Pause } from 'lucide-react';
import { VirtualizedDataTable } from '../../components/messages/data-table/VirtualizedDataTable';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '../../components/ui/sheet';

/* =======================
   Types
======================= */

type Provider = 'aws' | 'azure';
type ResourceType = 'queue' | 'topic';

interface MessagingResource {
  id: string;
  name: string;
  provider: Provider;
  type: ResourceType;
  region: string;
  status: 'active' | 'inactive';
}

/* =======================
   Mock Data
======================= */

const initialResources: MessagingResource[] = [
  {
    id: '1',
    name: 'order-events',
    provider: 'aws',
    type: 'queue',
    region: 'eu-central-1',
    status: 'active',
  },
  {
    id: '2',
    name: 'billing-topic',
    provider: 'azure',
    type: 'topic',
    region: 'westeurope',
    status: 'inactive',
  },
];

/* =======================
   Page
======================= */

export default function MessagingResources() {
  const [resources, setResources] =
    useState<MessagingResource[]>(initialResources);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<MessagingResource | null>(null);

  const [form, setForm] = useState<Omit<MessagingResource, 'id'>>({
    name: '',
    provider: 'aws',
    type: 'queue',
    region: '',
    status: 'active',
  });

  /* =======================
     Handlers
  ======================= */

  const resetForm = () => {
    setForm({
      name: '',
      provider: 'aws',
      type: 'queue',
      region: '',
      status: 'active',
    });
    setEditing(null);
  };

  const handleSave = () => {
    if (editing) {
      setResources((prev) =>
        prev.map((r) => (r.id === editing.id ? { ...r, ...form } : r)),
      );
    } else {
      setResources((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          ...form,
        },
      ]);
    }

    resetForm();
    setOpen(false);
  };

  const handleEdit = (resource: MessagingResource) => {
    setEditing(resource);
    setForm({
      name: resource.name,
      provider: resource.provider,
      type: resource.type,
      region: resource.region,
      status: resource.status,
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    setResources((prev) => prev.filter((r) => r.id !== id));
  };

  const handleActivate = (id: string) => {
    setResources((prev) =>
      prev.map((r) => (r.id === id ? { ...r, status: 'active' } : r)),
    );
  };
  /* =======================
     Render
  ======================= */

  return (
    <div className="p-6 min-w-0">
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent className="rounded-2xl">
          <SheetHeader>
            <SheetTitle>
              {editing ? 'Edit Resource' : 'Create Resource'}
            </SheetTitle>
          </SheetHeader>

          <div className="grid gap-4 mt-6">
            <div>
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Provider</Label>
                <Select
                  value={form.provider}
                  onValueChange={(v: Provider) =>
                    setForm({ ...form, provider: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aws">AWS</SelectItem>
                    <SelectItem value="azure">Azure</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Type</Label>
                <Select
                  value={form.type}
                  onValueChange={(v: ResourceType) =>
                    setForm({ ...form, type: v })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="queue">Queue</SelectItem>
                    <SelectItem value="topic">Topic</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Region</Label>
              <Input
                value={form.region}
                onChange={(e) => setForm({ ...form, region: e.target.value })}
              />
            </div>

            <Button onClick={handleSave} className="w-full mt-4">
              {editing ? 'Save Changes' : 'Create'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
      <VirtualizedDataTable
        columns={[
          {
            header: 'Name',
            accessorKey: 'name',
            cell: ({ row }) => {
              return <div>{row.original.name}</div>;
            },
          },
          {
            header: 'Provider',
            accessorKey: 'provider',
            enableColumnFilter: true,
            filterFn: (row, id, value) => {
              return value.includes(row.original.provider);
            },
            meta: {
              variant: 'multiSelect',
              label: 'Provider',
              options: [
                { label: 'AWS', value: 'aws' },
                { label: 'Azure', value: 'azure' },
              ],
            },
            cell: ({ row }) => {
              return <div>{row.original.provider}</div>;
            },
          },
          {
            header: 'Type',
            accessorKey: 'type',
            enableColumnFilter: true,
            filterFn: (row, id, value) => {
              return value.includes(row.original.type);
            },
            meta: {
              variant: 'multiSelect',
              label: 'Type',
              options: [
                { label: 'Queue', value: 'queue' },
                { label: 'Topic', value: 'topic' },
              ],
            },
            cell: ({ row }) => {
              return <div>{row.original.type}</div>;
            },
          },
          {
            header: 'Status',
            accessorKey: 'status',
            enableColumnFilter: true,
            filterFn: (row, id, value) => {
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
            cell: ({ row }) => {
              return <div>{row.original.status}</div>;
            },
          },
          {
            header: 'Actions',
            accessorKey: 'actions',
            cell: ({ row }) => {
              return (
                <div className="flex gap-2 justify-end">
                  <Badge
                    variant={
                      row.original.status === 'active' ? 'success' : 'inactive'
                    }
                    className="cursor-pointer"
                    onClick={() => handleActivate(row.original.id)}
                  >
                    {' '}
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
                    variant="destructive"
                    className="cursor-pointer"
                    onClick={() => handleDelete(row.original.id)}
                  >
                    <Trash2 className="h-5 w-3" />
                  </Badge>
                </div>
              );
            },
          },
        ]}
        data={resources}
        onAdd={() => setOpen(true)}
      />
    </div>
  );
}

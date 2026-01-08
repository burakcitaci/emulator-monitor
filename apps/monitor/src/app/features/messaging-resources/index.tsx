    import { useState } from 'react';
    import { VirtualizedDataTable } from '../../components/messages/data-table/VirtualizedDataTable';
    import { DetailSheet } from './components/DetailSheet';
    import { MessagingResource, Provider, ResourceType } from './lib/entities';
    import { createColumns } from './components/Columns';

    const initialResources: MessagingResource[] = [
      {
        id: '1',
        name: 'order-events',
        provider: Provider.AWS,
        type: ResourceType.QUEUE,
        region: 'eu-central-1',
        status: 'active',
      },
      {
        id: '2',
        name: 'billing-topic',
        provider: Provider.AZURE,
        type: ResourceType.TOPIC,
        region: 'westeurope',
        status: 'inactive',
      },
    ];

    export default function MessagingResources() {
      const [resources, setResources] =
        useState<MessagingResource[]>(initialResources);
      const [open, setOpen] = useState(false);
      const [editing, setEditing] = useState<MessagingResource | null>(null);

      const [form, setForm] = useState<Omit<MessagingResource, 'id'>>({
        name: '',
        provider: Provider.AWS,
        type: ResourceType.QUEUE,
        region: '',
        status: 'active',
      });

      const resetForm = () => {
        setForm({
          name: '',
          provider: Provider.AWS,
          type: ResourceType.QUEUE,
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
          <div className="flex flex-col gap-1 mb-4">
            <h1 className="text-2xl font-bold">Queues and Topics</h1>
            <h2 className="text-sm text-muted-foreground">
              Manage your queues and topics here.
            </h2>
          </div>

          <VirtualizedDataTable
          columns={createColumns(handleActivate, handleEdit, handleDelete)}
            data={resources}
            onAdd={() => setOpen(true)}
          />
          <DetailSheet
            open={open}
            setOpen={setOpen}
            editing={editing !== null}
            form={{ ...form, id: crypto.randomUUID() }}
            setForm={setForm}
            handleSave={handleSave}
          />
        </div>
      );
    }

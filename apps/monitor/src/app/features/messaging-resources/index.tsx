import { useState } from 'react';
import { VirtualizedDataTable } from '../../components/data-table/VirtualizedDataTable';
import { DetailSheet } from './components/DetailSheet';
import { MessagingResource, Provider, ResourceType } from './lib/entities';
import { createColumns } from './components/Columns';
import {
  useCreateMessageResource,
  useGetMessageResources,
  useUpdateMessageResource,
} from './api/messaging-resource';

export default function MessagingResources() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [currentResource, setCurrentResource] =
    useState<MessagingResource | null>(null);
  const { data: messageResources } = useGetMessageResources();
  const { mutate: createMessageResource } = useCreateMessageResource();
  const { mutate: updateMessageResource } = useUpdateMessageResource();
  const [form, setForm] = useState<Omit<MessagingResource, 'id'>>({
    name: '',
    provider: Provider.AWS,
    type: ResourceType.QUEUE,
    status: 'active',
  });

  const resetForm = () => {
    setForm({
      name: '',
      provider: Provider.AWS,
      type: ResourceType.QUEUE,
      status: 'active',
    });
    setEditing(false);
    setCurrentResource(null);
  };

  const handleSave = () => {
    if (editing) {
      if (!currentResource) return;
      updateMessageResource({
        id: currentResource.id,
        ...form,
      });
    } else {
      console.log(form);
      createMessageResource({
        id: crypto.randomUUID(),
        ...form,
      });
    }
    resetForm();
    setOpen(false);
  };

  const handleEdit = (resource: MessagingResource) => {
    setEditing(true);
    setCurrentResource(resource);
    setForm({
      name: resource.name,
      provider: resource.provider,
      type: resource.type,
      status: resource.status,
    });
    setOpen(true);
  };

  const handleDelete = (id: string) => {
    console.log(id);
  };

  const handleActivate = (id: string) => {
    console.log(id);
  };

  return (
    <div className="p-6 min-w-0">
      <div className="flex flex-col gap-1 mb-4">
        <h1 className="text-2xl font-bold">Queues and Topics</h1>
        <h2 className="text-sm text-muted-foreground">
          Manage your queues and topics here.
        </h2>
      </div>

      <VirtualizedDataTable
        searchKey="name"
        searchPlaceholder="Search resources..."
        columns={createColumns(handleActivate, handleEdit, handleDelete)}
        data={messageResources ?? ([] as MessagingResource[])}
        onAdd={() => {
          setCurrentResource(null);
          setEditing(false);
          resetForm();
          setOpen(true);
        }}
        estimateSize={48}
        overscan={5}
      />
      <DetailSheet
        open={open}
        setOpen={setOpen}
        editing={editing !== null}
        form={{ ...form, id: currentResource?.id ?? crypto.randomUUID() }}
        setForm={setForm}
        handleSave={handleSave}
      />
    </div>
  );
}

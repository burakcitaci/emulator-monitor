import { useParams } from 'react-router';
import { SqsMessagesDataTable } from './aws-sqs';
import { AzureSbDetail } from '../../features/azure-sb';

export const Detail: React.FC = () => {
  const { emulator } = useParams();
  
   if (!emulator) {
    return (
      <div className="p-6">
        <div className="text-center text-sm text-muted-foreground">No emulator selected</div>
      </div>
    );
  }

  return (
    <div className="p-6 min-w-0">
      <div className="flex flex-col gap-4 w-full flex-1 min-h-0 min-w-0">
        {emulator === 'sqs' ? (
          <SqsMessagesDataTable />
        ) : (
          <AzureSbDetail  />
        )}
      </div>
    </div>
  );
};
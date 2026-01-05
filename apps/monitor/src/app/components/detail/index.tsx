import { useParams } from 'react-router';
import { useGetSqsMessages } from '../../hooks/api/aws-sqs';
import { SqsMessagesDataTable } from './aws-sqs';
import { LoadingSpinner } from '../ui/loading-spinner';
import { AlertCircle } from 'lucide-react';
import { AzureSbDetail } from './azure-sb';

function ErrorMessage({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-sm p-4">
      <div className="flex items-start gap-3">
        {icon}
        <div>
          <p className="text-sm font-semibold text-destructive mb-1">{title}</p>
          <p className="text-xs text-destructive/80">{message}</p>
        </div>
      </div>
    </div>
  );
}


export const Detail: React.FC = () => {
  const { emulator } = useParams();
  const { data: sqsMessages, isLoading: sqsMessagesLoading, error: sqsMessagesError } = useGetSqsMessages();
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
          sqsMessagesLoading ? (
            <div className="flex items-center justify-center min-h-[200px]">
              <LoadingSpinner />
            </div>
          ) : sqsMessagesError ? (
            <ErrorMessage
              icon={<AlertCircle className="w-5 h-5 text-destructive flex-shrink-0 mt-0.5" />}
              title="Failed to Load SQS Messages"
              message={sqsMessagesError.message || 'Failed to load SQS messages'}
            />
          ) : sqsMessages ? (
            <SqsMessagesDataTable data={sqsMessages} />
          ) : (
            <div className="text-center text-sm text-muted-foreground py-8">No SQS messages found</div>
          )
        ) : (
          <AzureSbDetail  />
        )}
      </div>
    </div>
  );
};
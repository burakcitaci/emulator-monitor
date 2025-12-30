import { useNavigate, useParams } from 'react-router';
import { Button } from '../ui/button';
import { ArrowLeft } from 'lucide-react';
import { useTrackingMessagesByEmulator } from '../../hooks/api/tracking-messages';
import { TrackingMessagesDataTable } from '../service-bus/TrackingMessagesDataTable';
import { useGetSqsMessages } from '../../hooks/api/aws-sqs';

export const Detail: React.FC = () => {
  const { emulator } = useParams();
  const navigate = useNavigate();
  const { data: messages, isLoading, error } = useTrackingMessagesByEmulator(emulator || '');
  const { data: sqsMessages, isLoading: sqsMessagesLoading, error: sqsMessagesError } = useGetSqsMessages();

  if (!emulator || isLoading || error) {
    return <div>{error ? error.message : 'No emulator selected' + emulator || ''}</div>;
  }

  return (
    <div>
        <Button variant="outline" onClick={() => navigate(-1)}><ArrowLeft className="h-4 w-4" /> Back</Button>
      <h1>Detail {emulator}</h1>
      {sqsMessages && sqsMessages.queueName ? <div className="p-6">
        {sqsMessages.queueName} messages found</div>
    : <div className="p-6">
        <div className="text-center text-sm text-muted-foreground">No messages found</div>
      </div>}
    </div>
  );
};
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '../../../ui/button';
import { useNavigate } from 'react-router';

export const MessageDetailHeader = ({
  setSendModalOpen,
}: {
  setSendModalOpen: (open: boolean) => void;
}) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center justify-between gap-4">
      <div
        className="flex items-center gap-2 font-bold cursor-pointer"
        onClick={() => navigate(-1)}
      >
        <ArrowLeft className="h-6 w-6 mr-2" />
        <h1 className="text-xl font-bold">Detail - Azure Service Bus</h1>
      </div>

      <Button onClick={() => setSendModalOpen(true)}>
        <Send className="mr-2 h-4 w-4" />
        Simulate Message
      </Button>
    </div>
  );
};

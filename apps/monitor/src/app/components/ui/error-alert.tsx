import { AlertCircle } from 'lucide-react';

export function ErrorAlert({ error }: { error: string }) {
  return (
    <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 mb-6">
      <div className="flex items-center gap-2">
        <AlertCircle className="w-5 h-5 text-destructive" />
        <span className="text-destructive">{error}</span>
      </div>
    </div>
  );
}

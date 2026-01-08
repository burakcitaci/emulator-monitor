export const ErrorMessage = ({
  icon,
  title,
  message,
}: {
  icon: React.ReactNode;
  title: string;
  message: string;
}) => {
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
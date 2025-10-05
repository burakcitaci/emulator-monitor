import { cn } from '../../lib/utils';

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-muted', className)}
      {...props}
    />
  );
}

interface SkeletonProps {
  className?: string;
}

// Enhanced skeleton components for better UX
const MessageSkeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={cn('space-y-3 p-4 border rounded-lg', className)}>
    <div className="flex items-center space-x-3">
      <Skeleton className="h-4 w-4 rounded-full" />
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-16" />
    </div>
    <Skeleton className="h-16 w-full" />
    <div className="flex space-x-2">
      <Skeleton className="h-6 w-16" />
      <Skeleton className="h-6 w-20" />
    </div>
  </div>
);

const ContainerSkeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={cn('space-y-3 p-4 border rounded-lg', className)}>
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <Skeleton className="h-4 w-4 rounded-full" />
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-5 w-16" />
      </div>
      <Skeleton className="h-2 w-2 rounded-full" />
    </div>
    <Skeleton className="h-3 w-48" />
    <div className="space-y-2">
      <div className="flex items-center space-x-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-3 w-24" />
      </div>
      <div className="flex items-center space-x-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  </div>
);

const FormSkeleton: React.FC<SkeletonProps> = ({ className }) => (
  <div className={cn('space-y-4', className)}>
    <div className="space-y-2">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-10 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-32 w-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-4 w-28" />
      <Skeleton className="h-20 w-full" />
    </div>
    <Skeleton className="h-10 w-full" />
  </div>
);

const TableSkeleton: React.FC<SkeletonProps & { rows?: number }> = ({
  className,
  rows = 5,
}) => (
  <div className={cn('space-y-3', className)}>
    {/* Header */}
    <div className="flex space-x-4 pb-2 border-b">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-16" />
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="flex space-x-4 py-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-16" />
      </div>
    ))}
  </div>
);

export {
  Skeleton,
  MessageSkeleton,
  ContainerSkeleton,
  FormSkeleton,
  TableSkeleton,
};

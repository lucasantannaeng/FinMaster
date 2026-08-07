import { Skeleton } from '@/components/ui/skeleton';

const PageSkeleton = () => (
  <div className="p-4 space-y-4">
    <Skeleton className="h-8 w-48" />
    <Skeleton className="h-4 w-32" />
    <div className="grid gap-4 md:grid-cols-2">
      <Skeleton className="h-32 rounded-xl" />
      <Skeleton className="h-32 rounded-xl" />
    </div>
    <Skeleton className="h-64 rounded-xl" />
  </div>
);

export default PageSkeleton;

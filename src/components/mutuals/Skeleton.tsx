import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("shimmer rounded-md bg-muted/40", className)} />;
}

export function PostCardSkeleton() {
  return (
    <article className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-2.5 w-16" />
        </div>
      </div>
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
      </div>
      <Skeleton className="mt-3 aspect-[4/3] w-full rounded-xl" />
    </article>
  );
}

export function UserCardSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3">
      <Skeleton className="h-12 w-12 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-20" />
      </div>
      <Skeleton className="h-8 w-16 rounded-full" />
    </div>
  );
}

export function NotifRowSkeleton() {
  return (
    <div className="flex items-center gap-3 rounded-xl px-3 py-3">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

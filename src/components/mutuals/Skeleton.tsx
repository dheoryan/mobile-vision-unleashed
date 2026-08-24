import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";
import logoMark from "@/assets/logo-mark.svg";

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("shimmer rounded-md bg-muted/40", className)} {...props} />;
}

function LoadingRegion({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div role="status" aria-live="polite" className={className}>
      <span className="sr-only">{label}</span>
      <div aria-hidden="true">{children}</div>
    </div>
  );
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

export function FeedSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading posts" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <PostCardSkeleton key={index} />
      ))}
    </LoadingRegion>
  );
}

export function PeopleSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading people" className="flex flex-col gap-3">
      {Array.from({ length: count }, (_, index) => (
        <UserCardSkeleton key={index} />
      ))}
    </LoadingRegion>
  );
}

export function VentureListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading Ventures" className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <article key={index} className="overflow-hidden rounded-3xl border border-border bg-card">
          <Skeleton className="aspect-[16/8] w-full rounded-none" />
          <div className="space-y-3 p-4">
            <div className="flex items-center justify-between gap-4">
              <Skeleton className="h-4 w-2/3" />
              <Skeleton className="h-5 w-12 rounded-full" />
            </div>
            <Skeleton className="h-3 w-1/2" />
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          </div>
        </article>
      ))}
    </LoadingRegion>
  );
}

export function ConversationListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <LoadingRegion label="Loading conversations" className="space-y-1 py-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-2xl px-3 py-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-2xl" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-3.5 w-32" />
            <Skeleton className="h-3 w-full max-w-56" />
          </div>
          <Skeleton className="h-2.5 w-10" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function CompactListSkeleton({
  count = 3,
  label = "Loading content",
}: {
  count?: number;
  label?: string;
}) {
  return (
    <LoadingRegion label={label} className="space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="rounded-2xl border border-border bg-card p-4">
          <Skeleton className="h-3.5 w-2/3" />
          <Skeleton className="mt-2 h-3 w-full" />
          <Skeleton className="mt-2 h-3 w-1/2" />
        </div>
      ))}
    </LoadingRegion>
  );
}

export function MessageThreadSkeleton() {
  return (
    <LoadingRegion label="Loading messages" className="space-y-3 py-2">
      <Skeleton className="h-14 w-3/4 rounded-2xl rounded-bl-md" />
      <Skeleton className="ml-auto h-11 w-2/3 rounded-2xl rounded-br-md" />
      <Skeleton className="h-20 w-4/5 rounded-2xl rounded-bl-md" />
      <Skeleton className="ml-auto h-14 w-1/2 rounded-2xl rounded-br-md" />
    </LoadingRegion>
  );
}

export function AppBootstrapSkeleton() {
  return (
    <LoadingRegion
      label="Loading MEUTUALS"
      className="flex min-h-screen items-center justify-center bg-habitat px-6"
    >
      <div className="flex -translate-y-6 flex-col items-center">
        <img src={logoMark} alt="" className="h-24 w-24 object-contain" />
        <div className="mt-5 text-center">
          <p className="label-mono text-primary">OPEN PARTY BOARD</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight">MEUTUALS</p>
        </div>
        <Skeleton className="mt-6 h-1 w-20 rounded-full" />
      </div>
    </LoadingRegion>
  );
}

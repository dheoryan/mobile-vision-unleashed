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
    <div role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      <div aria-hidden="true" className={className}>
        {children}
      </div>
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
  // Matches Discover's PersonRow exactly (its only real use - see
  // PeopleSkeleton below): p-4 card, h-10 avatar, min-h-11 min-w-20 action
  // pill, and the row's real 3-line text stack (name, meta, bio) rather
  // than a shortened 2-line guess.
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-20" />
        <Skeleton className="h-2.5 w-40" />
      </div>
      <Skeleton className="h-11 w-20 shrink-0 rounded-full" />
    </div>
  );
}

/** For a flat divided list (no per-row card/border) - SettingsScreen's
 *  blocked-accounts list is the one real use, a fundamentally different
 *  shape from PersonRow's bordered card, so it needs its own skeleton
 *  rather than reusing UserCardSkeleton and matching neither. */
export function FlatUserRowSkeleton() {
  return (
    <div className="flex min-h-16 items-center gap-3 py-3">
      <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
      <div className="min-w-0 flex-1 space-y-1.5">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-2.5 w-16" />
      </div>
      <Skeleton className="h-10 w-24 shrink-0 rounded-full" />
    </div>
  );
}

export function NotifRowSkeleton() {
  // Matches NotificationRowItem's real geometry (notifications.tsx) exactly
  // - same min-height, padding, radius, and avatar size - so there's no
  // visible pop/reflow the moment real rows swap in.
  return (
    <div className="flex min-h-[88px] items-start gap-3 rounded-2xl px-3 py-4">
      <Skeleton className="h-12 w-12 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 pt-0.5">
        <Skeleton className="h-3 w-48" />
        <Skeleton className="h-2.5 w-16" />
      </div>
    </div>
  );
}

export function FlatUserListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <LoadingRegion
      label="Loading accounts"
      className="divide-y divide-border border-y border-border"
    >
      {Array.from({ length: count }, (_, index) => (
        <FlatUserRowSkeleton key={index} />
      ))}
    </LoadingRegion>
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
  // Matches VentureBoard's real row exactly (rounded-2xl card, min-h-32,
  // grid-cols-[5.5rem_1fr] p-3) - the board is a compact horizontal ticket
  // row with a small square thumbnail, not the vertical banner-card layout
  // this skeleton used to mock up before that redesign.
  return (
    <LoadingRegion label="Loading Ventures" className="space-y-3">
      {Array.from({ length: count }, (_, index) => (
        <article
          key={index}
          className="grid min-h-32 grid-cols-[5.5rem_1fr] gap-3 rounded-2xl border border-border bg-card p-3"
        >
          <Skeleton className="h-[6.5rem] w-[5.5rem] rounded-xl" />
          <div className="flex min-w-0 flex-col justify-center gap-2 py-0.5">
            <Skeleton className="h-3.5 w-16 rounded" />
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-1/2" />
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
          <p className="label-mono text-primary">REINVENTING HOW WE SOCIALIZE</p>
          <p className="mt-1 font-display text-2xl font-bold tracking-tight">MEUTUALS</p>
        </div>
        <div className="splash-loading-track mt-6 h-1 w-20 rounded-full">
          <span className="splash-loading-thumb" />
        </div>
      </div>
    </LoadingRegion>
  );
}

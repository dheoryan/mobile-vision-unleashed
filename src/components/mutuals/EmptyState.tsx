import type { ReactNode } from "react";

export function EmptyState({
  icon,
  headline,
  sub,
  action,
}: {
  icon: ReactNode;
  headline: string;
  sub?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 py-14 text-center animate-rise">
      <div className="text-5xl" aria-hidden>{icon}</div>
      <h3 className="mt-4 font-display text-xl font-bold">{headline}</h3>
      {sub && <p className="mt-1.5 text-sm text-muted-foreground">{sub}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

import { Link } from "@tanstack/react-router";

export function LegalFooter({ className = "" }: { className?: string }) {
  return (
    <p className={`text-center text-[11px] text-muted-foreground ${className}`}>
      <Link to="/terms" className="hover:text-foreground">Terms</Link>
      <span className="mx-1.5 opacity-50">·</span>
      <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
      <span className="mx-1.5 opacity-50">·</span>
      <Link to="/community-guidelines" className="hover:text-foreground">Guidelines</Link>
    </p>
  );
}

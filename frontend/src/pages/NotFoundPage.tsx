import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";

export function NotFoundPage() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-bg text-text">
      <Compass size={32} className="text-accent" aria-hidden />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-[13px] text-muted">
        The route <code className="text-accent">{location.pathname}</code> does not exist in
        this application.
      </p>
      <Link
        to="/"
        className="rounded-quiet border border-border px-4 py-2 text-sm text-text hover:border-border-strong"
      >
        Back to welcome
      </Link>
    </div>
  );
}

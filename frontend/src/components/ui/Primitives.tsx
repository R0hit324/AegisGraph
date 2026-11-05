/** Basic presentational building blocks shared across pages. */

import type { ReactNode } from "react";

export function Panel({
  title,
  description,
  children,
  action,
  className = "",
}: {
  title?: string;
  description?: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className} p-5 md:p-6`} aria-label={title}>
      {(title !== undefined || action !== undefined) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title !== undefined && (
              <h2 className="text-[15px] font-semibold tracking-tight text-text">{title}</h2>
            )}
            {description !== undefined && (
              <p className="mt-1 text-[13px] leading-relaxed text-muted">{description}</p>
            )}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export type BadgeTone = "neutral" | "accent" | "ok" | "warn" | "danger";

const BADGE_TONES: Record<BadgeTone, string> = {
  neutral: "border-border text-muted bg-surface-3/60",
  accent: "border-accent-dim text-accent bg-accent/10",
  ok: "border-ok/40 text-ok bg-ok/10",
  warn: "border-warn/40 text-warn bg-warn/10",
  danger: "border-danger/40 text-danger bg-danger/10",
};

export function Badge({
  tone = "neutral",
  children,
}: {
  tone?: BadgeTone;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-quiet border px-2 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone]}`}
    >
      {children}
    </span>
  );
}

export function Button({
  variant = "primary",
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  title,
}: {
  variant?: "primary" | "ghost";
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-quiet px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const styles =
    variant === "primary"
      ? "bg-accent text-bg hover:bg-accent/85 font-semibold"
      : "border border-border text-text hover:border-border-strong hover:bg-surface-3/50";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <span
      role="status"
      aria-label={label ?? "Loading"}
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-accent border-t-transparent align-middle"
    />
  );
}

export function StatusDot({ tone }: { tone: "ok" | "warn" | "danger" | "idle" }) {
  const colors: Record<string, string> = {
    ok: "bg-ok",
    warn: "bg-warn",
    danger: "bg-danger",
    idle: "bg-faint",
  };
  return (
    <span aria-hidden className="relative inline-flex h-2 w-2">
      <span
        className={`absolute inline-flex h-full w-full rounded-full opacity-40 ${colors[tone]} ${tone === "idle" ? "" : "animate-ping"}`}
      />
      <span className={`relative inline-flex h-2 w-2 rounded-full ${colors[tone]}`} />
    </span>
  );
}

export function EmptyState({
  icon,
  title,
  children,
  action,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="rounded-full border border-border bg-surface-3/60 p-3 text-accent">
        {icon}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-text">{title}</h3>
      <div className="max-w-md text-[13px] leading-relaxed text-muted">{children}</div>
      {action}
    </div>
  );
}

export function ErrorNotice({
  title,
  detail,
  onRetry,
}: {
  title: string;
  detail?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-2 rounded-quiet border border-danger/30 bg-danger/10 p-4 text-[13px]"
    >
      <div className="flex items-center gap-2 font-medium text-danger">{title}</div>
      {detail !== null && detail !== undefined && <p className="text-danger/80">{detail}</p>}
      {onRetry !== undefined && (
        <div>
          <Button
            variant="ghost"
            onClick={onRetry}
            className="mt-1 border-danger/40 text-danger"
          >
            Try again
          </Button>
        </div>
      )}
    </div>
  );
}

export function KeyValueRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-border/60 py-2 last:border-none">
      <span className="text-[12px] text-muted">{label}</span>
      <span className="text-[13px] font-medium text-text">{value}</span>
    </div>
  );
}

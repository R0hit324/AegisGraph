/** Basic presentational building blocks shared across pages. */

import {
  Children,
  createContext,
  isValidElement,
  useCallback,
  useState,
} from "react";
import type {
  InputHTMLAttributes,
  ReactElement,
  ReactNode,
  SelectHTMLAttributes,
} from "react";

/** Shared control styling — border, surface and focus affordance only. */
export const CONTROL_CLASSES =
  "w-full rounded-quiet border border-border bg-surface-3/40 px-3 py-2 text-sm text-text placeholder:text-faint hover:border-border-strong";

/** Labeled form field wrapper; hint text stays honest and short. */
export function Field({
  label,
  htmlFor,
  hint,
  children,
}: {
  label: string;
  htmlFor?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-[12px] font-medium text-muted">
        {label}
      </label>
      {children}
      {hint !== undefined && <p className="text-[11px] leading-relaxed text-faint">{hint}</p>}
    </div>
  );
}

/** Text/password input on the token system (focus ring comes from :focus-visible). */
export function TextInput({
  className = "",
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={`${CONTROL_CLASSES} ${className}`} />;
}

/** Small select for role pickers and similar bounded choices. */
export function SelectInput({
  className = "",
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select {...rest} className={`${CONTROL_CLASSES} ${className}`}>
      {children}
    </select>
  );
}

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
  className = "",
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-quiet border px-2 py-0.5 text-[11px] font-medium ${BADGE_TONES[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Button({
  variant = "primary",
  size = "medium",
  children,
  onClick,
  type = "button",
  disabled = false,
  className = "",
  title,
}: {
  variant?: "primary" | "ghost" | "outline";
  size?: "small" | "medium";
  children: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit";
  disabled?: boolean;
  className?: string;
  title?: string;
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-quiet px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
  const sizeClasses = size === "small" ? "px-2.5 py-1 text-[12px]" : "";
  const styles =
    variant === "primary"
      ? "bg-accent text-bg hover:bg-accent/85 font-semibold"
      : variant === "outline"
        ? "border border-border-strong bg-surface-2 text-text hover:bg-surface-3/50"
        : "border border-border text-text hover:border-border-strong hover:bg-surface-3/50";
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`${base} ${sizeClasses} ${styles} ${className}`}
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
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <div className="rounded-full border border-border bg-surface-3/60 p-3 text-accent">
        {icon}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-text">{title}</h3>
      {children !== undefined ? (
        <div className="max-w-md text-[13px] leading-relaxed text-muted">{children}</div>
      ) : description !== undefined ? (
        <div className="max-w-md text-[13px] leading-relaxed text-muted">{description}</div>
      ) : null}
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

/* ── Tabs ────────────────────────────────────────────────────────────────── */
/**
 * Lightweight accessible tab control built on the token system.
 *
 * `<Tabs>` collects its `<Tab value label>{children}</Tab>` children and
 * renders the tab strip plus the active tab's panel. Controlled usage: pass
 * `value` + `onValueChange`; uncontrolled: pass `defaultValue` only.
 */
interface TabsContextValue {
  active: string;
  select: (value: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabDescriptor {
  value: string;
  label: string;
  children?: ReactNode;
}

export function Tabs({
  defaultValue,
  value,
  onValueChange,
  className = "",
  children,
}: {
  defaultValue?: string;
  value?: string;
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
}) {
  const [internal, setInternal] = useState(defaultValue ?? "");
  const active = value !== undefined ? value : internal;
  const select = useCallback(
    (next: string) => {
      if (value === undefined) setInternal(next);
      onValueChange?.(next);
    },
    [value, onValueChange],
  );

  const items: Array<ReactElement<TabDescriptor>> = [];
  Children.forEach(children, (child) => {
    if (isValidElement(child)) {
      const props = child.props as Partial<TabDescriptor>;
      if (typeof props.value === "string") {
        items.push(child as ReactElement<TabDescriptor>);
      }
    }
  });
  const activeItem = items.find((item) => item.props.value === active);

  return (
    <TabsContext.Provider value={{ active, select }}>
      <div
        role="tablist"
        aria-label="Section tabs"
        className={`flex flex-wrap items-center gap-1.5 border-b border-border pb-2 ${className}`}
      >
        {items.map((item) => {
          const selected = item.props.value === active;
          return (
            <button
              key={item.props.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => select(item.props.value)}
              className={`rounded-quiet border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                selected
                  ? "border-accent-dim bg-accent/10 text-accent"
                  : "border-border bg-surface-2 text-muted hover:border-border-strong hover:text-text"
              }`}
            >
              {item.props.label}
            </button>
          );
        })}
      </div>
      <div role="tabpanel" className="mt-4">
        {activeItem?.props.children}
      </div>
    </TabsContext.Provider>
  );
}

/**
 * Declares one tab of a `<Tabs>` group. It renders nothing itself — `<Tabs>`
 * reads its `value`, `label` and `children` props to build the strip and the
 * active panel.
 */
export function Tab(_props: TabDescriptor): null {
  return null;
}

/* ── Tables ──────────────────────────────────────────────────────────────── */
/** Thin semantic wrappers around native table elements. */

export function Table({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <div className={`overflow-x-auto ${className}`}>
      <table className="w-full text-[13px]">{children}</table>
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return <thead>{children}</thead>;
}

export function TableBody({ children }: { children: ReactNode }) {
  return <tbody>{children}</tbody>;
}

export function TableRow({ className = "", children }: { className?: string; children: ReactNode }) {
  return <tr className={`border-b border-border/60 ${className}`}>{children}</tr>;
}

export function TableCell({ className = "", children }: { className?: string; children: ReactNode }) {
  return <td className={`px-3 py-2 align-top ${className}`}>{children}</td>;
}

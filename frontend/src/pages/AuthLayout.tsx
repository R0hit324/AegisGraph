/**
 * Shared chrome for the standalone auth screens (login / register).
 * Same token system as the app shell: quiet navy surfaces, one accent glow.
 * One idea per screen: exactly one form, nothing else competing with it.
 */

import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Logo } from "@/components/Logo";

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-text">
      {/* Restrained radial glow — the single accent highlight of the screen */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(560px 280px at 50% -4%, rgba(34,211,238,0.10), transparent 70%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-md items-center justify-between px-6 py-6">
        <Link to="/" className="flex items-center gap-2.5" data-testid="auth-brand">
          <Logo size={24} className="text-accent" />
          <span className="text-sm font-semibold tracking-tight">AegisGraph</span>
        </Link>
        <span className="text-[11px] uppercase tracking-widest text-faint">Phase 2</span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-24">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="text-[13px] leading-relaxed text-muted">{subtitle}</p>
        </div>

        <div className="panel mt-6 p-6 md:p-7">{children}</div>

        <div className="mt-5 text-center text-[12px] text-muted">{footer}</div>
      </main>

      <footer className="relative z-10 px-6 pb-6 text-center text-[11px] text-faint">
        Sessions are handled by the backend via an HttpOnly cookie — never stored in the browser.
      </footer>
    </div>
  );
}

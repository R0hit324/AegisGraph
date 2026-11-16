import { Link } from "react-router-dom";
import { ArrowRight, Lock, Eye, Network } from "lucide-react";
import { Logo } from "@/components/Logo";
import { getApiBaseUrl } from "@/services/apiClient";

export function WelcomePage() {
  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-bg text-text">
      {/* Restrained radial glow — single accent highlight, no neon */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(640px 320px at 50% -5%, rgba(34,211,238,0.10), transparent 70%)",
        }}
      />

      <header className="relative z-10 mx-auto flex w-full max-w-4xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <Logo size={28} className="text-accent" />
          <span className="text-sm font-semibold tracking-tight">AegisGraph</span>
        </div>
        <span className="text-[11px] uppercase tracking-widest text-faint">
          Phase 2 — Scope foundation
        </span>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-1 flex-col items-center justify-center gap-7 px-6 pb-24 text-center">
        <Logo size={84} className="text-accent" />

        <div className="space-y-3">
          <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">AegisGraph</h1>
          <p className="mx-auto max-w-xl text-[15px] font-medium leading-relaxed text-muted md:text-base">
            Unified Attack Surface Discovery &amp; Website Security Assessment Platform.
          </p>
        </div>

        <p className="mx-auto max-w-2xl text-[13px] leading-relaxed text-muted md:text-sm">
          AegisGraph helps authorized operators discover public-facing assets in their own
          scope, assess website security configuration, correlate external vulnerability
          intelligence, and understand relationships through an explainable asset graph.
          Findings are always backed by collected evidence — never invented.
        </p>

        <ul className="grid w-full max-w-2xl grid-cols-1 gap-3 text-left sm:grid-cols-3">
          <Feature icon={<Eye size={15} />} title="Discover">
            See the public-facing surface of your authorized domains.
          </Feature>
          <Feature icon={<Lock size={15} />} title="Assess">
            Evaluate website security configuration with reproducible checks.
          </Feature>
          <Feature icon={<Network size={15} />} title="Correlate">
            Map relationships and turn data into explainable risk.
          </Feature>
        </ul>

        <Link
          to="/app/overview"
          data-testid="enter-application"
          className="inline-flex items-center gap-2 rounded-quiet bg-accent px-6 py-3 text-sm font-semibold text-bg transition-colors hover:bg-accent/85"
        >
          Enter Application
          <ArrowRight size={16} aria-hidden />
        </Link>
      </main>

      <footer className="relative z-10 mx-auto w-full max-w-4xl px-6 pb-8 text-center text-[11px] text-faint">
        Self-hosted &amp; localhost-first · your data stays in your local database · API base:{" "}
        <span className="text-muted">{getApiBaseUrl()}</span>
      </footer>
    </div>
  );
}

function Feature({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="panel p-4">
      <div className="flex items-center gap-2 text-accent">
        {icon}
        <span className="text-[13px] font-semibold text-text">{title}</span>
      </div>
      <p className="mt-1.5 text-[12px] leading-relaxed text-muted">{children}</p>
    </li>
  );
}

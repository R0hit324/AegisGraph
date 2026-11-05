import { MoonStar } from "lucide-react";
import type { NavItem } from "@/app/navigation";
import { Panel, Badge } from "@/components/ui/Primitives";

/**
 * Honest placeholder page for future modules.
 * It never simulates data or pretends features are operational — it states
 * exactly which development phase will deliver the capability.
 */
export function ModulePlaceholderPage({ definition }: { definition: NavItem }) {
  const Icon = definition.icon;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-text">{definition.title}</h1>
        <p className="mt-1 text-[13px] text-muted">{definition.description}</p>
      </div>

      <Panel>
        <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
          <div className="rounded-full border border-border bg-surface-3/60 p-3 text-accent">
            <Icon size={24} aria-hidden />
          </div>
          <div className="flex items-center gap-2">
            <Badge tone="accent">{definition.phase}</Badge>
            <Badge tone="neutral">not yet operational</Badge>
          </div>
          <h2 className="text-base font-semibold tracking-tight text-text">
            This module is planned for a future development phase
          </h2>
          <p className="max-w-md text-[13px] leading-relaxed text-muted">
            The navigation is ready, but no functionality exists behind it yet. AegisGraph does
            not simulate results, so this page stays empty until
            <span className="text-text"> {definition.phase}</span> implements the feature end to
            end.
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-faint">
            <MoonStar size={12} aria-hidden />
            Phase 1 delivered the application shell only.
          </p>
        </div>
      </Panel>
    </div>
  );
}

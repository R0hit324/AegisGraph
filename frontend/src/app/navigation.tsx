/** Top-level navigation definitions used by the sidebar, topbar and routes. */

import {
  Boxes,
  FileText,
  LayoutDashboard,
  Network,
  Radar,
  Settings,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface NavItem {
  path: string;
  label: string;
  /** Label used as page title in the topbar. */
  title: string;
  icon: LucideIcon;
  /** Which phase will make this module operational — surfaced honestly in UI. */
  phase: string;
  /** One-sentence description shown on the module placeholder page. */
  description: string;
}

export const NAV_ITEMS: NavItem[] = [
  {
    path: "overview",
    label: "Overview",
    title: "Overview",
    icon: LayoutDashboard,
    phase: "Phase 1",
    description: "Platform status and the entry point for every future assessment.",
  },
  {
    path: "assets",
    label: "Assets",
    title: "Assets",
    icon: Boxes,
    phase: "Phase 2",
    description:
      "Assets are internet-facing systems within your authorized scope — domains, subdomains, IPs and services.",
  },
  {
    path: "discovery",
    label: "Discovery",
    title: "Discovery",
    icon: Radar,
    phase: "Phase 3",
    description:
      "Discovery collects public observations for assets in your authorized scope: DNS, certificates, and HTTP surface.",
  },
  {
    path: "assessments",
    label: "Assessments",
    title: "Assessments",
    icon: ShieldCheck,
    phase: "Phase 4",
    description:
      "Assessments evaluate website security configuration for authorized assets, producing evidence-backed checks.",
  },
  {
    path: "findings",
    label: "Findings",
    title: "Findings",
    icon: TriangleAlert,
    phase: "Phase 5",
    description:
      "Findings consolidate assessment results and external intelligence into a single, explainable queue.",
  },
  {
    path: "intelligence",
    label: "Intelligence",
    title: "Intelligence",
    icon: Sparkles,
    phase: "Phase 6",
    description:
      "Intelligence correlates public vulnerability sources (e.g. CISA KEV, OSV) with your discovered assets.",
  },
  {
    path: "graph",
    label: "Attack Surface Graph",
    title: "Attack Surface Graph",
    icon: Network,
    phase: "Phase 7",
    description:
      "The graph visualizes relationships between your assets — domains, hosts, services and their dependencies.",
  },
  {
    path: "reports",
    label: "Reports",
    title: "Reports",
    icon: FileText,
    phase: "Phase 9",
    description:
      "Reports export reproducible security summaries of your assessments for technical and management audiences.",
  },
  {
    path: "settings",
    label: "Settings",
    title: "Settings",
    icon: Settings,
    phase: "Phase 1 (partial)",
    description:
      "Application information and connection details. Operational settings arrive with later phases.",
  },
];

export const NAV_BY_PATH: Record<string, NavItem> = Object.fromEntries(
  NAV_ITEMS.map((item) => [item.path, item]),
);

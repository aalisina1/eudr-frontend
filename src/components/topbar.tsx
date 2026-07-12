"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronRight, Leaf } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

/**
 * Route → breadcrumb label, in the same order/labelling as the sidebar nav
 * (app-sidebar.tsx) so the two stay in lockstep. Sub-routes (e.g. a DDS
 * detail page) fall back to their section's label — see `crumbFor`.
 */
const CRUMBS: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "Dashboard" },
  { prefix: "/suppliers", label: "Suppliers" },
  { prefix: "/plots", label: "Land Plots" },
  { prefix: "/supply-chains", label: "Supply Chains" },
  { prefix: "/due-diligence", label: "Submissions" },
  { prefix: "/documents", label: "Documents" },
  { prefix: "/integrations", label: "Integrations" },
  { prefix: "/settings", label: "Settings" },
];

function crumbFor(pathname: string | null): string {
  if (!pathname) return "Canopy";
  const match = CRUMBS.find((c) => pathname === c.prefix || pathname.startsWith(`${c.prefix}/`));
  return match?.label ?? "Canopy";
}

/**
 * Shared dashboard topbar — breadcrumb (Canopy › current section) + a
 * notifications affordance. Ported from the Claude Design prototype's
 * `Topbar` (redesign/shell.jsx); the sidebar-collapse trigger is real,
 * existing app behavior kept alongside it.
 */
export function Topbar() {
  const pathname = usePathname();
  const crumb = crumbFor(pathname);

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-border/60 bg-card px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground transition-colors" />
        <Separator orientation="vertical" className="h-4 bg-border/60" />
        <div className="flex items-center gap-2.5 text-[13px]">
          <Leaf className="size-3.5 text-primary" />
          <span className="text-muted-foreground">Canopy</span>
          <ChevronRight className="size-3.5 text-border" />
          <span className="font-semibold text-foreground">{crumb}</span>
        </div>
      </div>
      <button
        type="button"
        title="Notifications"
        aria-label="Notifications"
        className="flex size-9 items-center justify-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="size-[17px]" />
      </button>
    </header>
  );
}

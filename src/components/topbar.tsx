"use client";

import { usePathname } from "next/navigation";
import { Bell, ChevronRight } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { PRODUCT_NAME } from "@/lib/brand";
import { GrovetraceMark } from "@/components/brand/grovetrace-mark";

/**
 * Route → breadcrumb label, in the same order/labelling as the sidebar nav
 * (app-sidebar.tsx) so the two stay in lockstep. Sub-routes (e.g. a DDS
 * detail page) fall back to their section's label — see `crumbFor`.
 */
const CRUMBS: { prefix: string; label: string }[] = [
  { prefix: "/dashboard", label: "Dashboard" },
  { prefix: "/suppliers", label: "Suppliers" },
  { prefix: "/plots", label: "Land plots" },
  { prefix: "/sourcing", label: "Sourcing" },
  { prefix: "/shipments", label: "Shipments" },
  { prefix: "/submissions", label: "Submissions" },
  { prefix: "/documents", label: "Documents" },
  { prefix: "/integrations", label: "Integrations" },
  { prefix: "/administration", label: "Administration" },
  { prefix: "/settings", label: "Settings" },
];

function crumbFor(pathname: string | null): string {
  if (!pathname) return PRODUCT_NAME;
  const match = CRUMBS.find((c) => pathname === c.prefix || pathname.startsWith(`${c.prefix}/`));
  return match?.label ?? PRODUCT_NAME;
}

/**
 * Shared dashboard topbar — breadcrumb (Grovetrace › current section) + a
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
        <div className="flex items-center gap-2.5 text-sm">
          <GrovetraceMark variant="small" className="size-3.5 text-primary" />
          <span className="text-muted-foreground">{PRODUCT_NAME}</span>
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

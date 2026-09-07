"use client";

import { PriorityAlertBanner } from "@/components/dashboard/priority-alert-banner";
import { ActionQueueCard } from "@/components/dashboard/action-queue-card";
import { AwaitingDataCard } from "@/components/dashboard/awaiting-data-card";
import { RiskConcentrationCard } from "@/components/dashboard/risk-concentration-card";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { SupplierContactPlaceholder } from "@/components/dashboard/supplier-contact-placeholder";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";
import { formatDateLine, greeting, shouldShowDashboardCtas } from "@/lib/dashboard-worklist";

/**
 * The "Decision Ladder" compliance cockpit (dashboard-redesign.md) —
 * replaces the flat four-card worklist (#30) with four severity-ranked
 * tiers: Priority Alert -> Action Queue -> Awaiting Data -> Risk
 * Concentration, then the demoted `StatStrip` context footer.
 *
 * COMPLIANCE_OFFICER/ADMIN/VIEWER see the identical cockpit (every control
 * here is a navigation link, never a dashboard-native mutation — Journeys,
 * VIEWER section). SUPPLIER_CONTACT sees a minimal placeholder instead,
 * gated by role on this SAME route (not a redirect — `/shipments`'s own
 * SUPPLIER_CONTACT block already redirects here, so this has to be a
 * landing spot, not another bounce).
 *
 * `showCta` is computed ONCE, here, via `shouldShowDashboardCtas()` (Task 3)
 * — the single flip point for VIEWER's CTA visibility (Global Constraints)
 * — and threaded down to every tier that has action-button CTAs. This is
 * the ONLY place `currentUser.role` is compared against `"VIEWER"`
 * anywhere in the dashboard tree; no tier component repeats that check.
 */
export default function DashboardPage() {
  const { data: currentUser } = useCurrentUser();

  // Fail closed while the role loads — mirrors `/shipments`'s content gate.
  if (!currentUser) {
    return <Skeleton className="h-40 w-full" />;
  }

  if (currentUser.role === "SUPPLIER_CONTACT") {
    return <SupplierContactPlaceholder />;
  }

  const showCta = shouldShowDashboardCtas(currentUser.role);

  return (
    <div>
      <header className="mb-[22px]">
        <h1 className="text-display text-4xl leading-[1.04] font-light italic">{greeting()}</h1>
        <p className="mt-2.5 text-base text-muted-foreground">{formatDateLine()}</p>
      </header>

      <div className="flex flex-col gap-[18px]">
        <PriorityAlertBanner showCta={showCta} />
        <ActionQueueCard showCta={showCta} />
        <AwaitingDataCard />
        <RiskConcentrationCard />
      </div>

      <StatStrip />
    </div>
  );
}

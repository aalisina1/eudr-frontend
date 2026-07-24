"use client";

import { AwaitingDataCard } from "@/components/dashboard/awaiting-data-card";
import { NeedsFilingCard } from "@/components/dashboard/needs-filing-card";
import { NeedsRemediationCard } from "@/components/dashboard/needs-remediation-card";
import { ShipmentsLeadTimeCard } from "@/components/dashboard/shipments-lead-time-card";
import { StatStrip } from "@/components/dashboard/stat-strip";
import { formatDateLine, greeting } from "@/lib/dashboard-worklist";

/**
 * Dashboard-as-worklist (#30, Prompt D) — the compliance officer's action
 * home. Replaces the old chart dashboard (DDS-by-status donut, plot
 * validation bar): a de-emphasised stat strip (context, not the headline)
 * plus three priority-ordered cards — Needs filing, Needs remediation,
 * Awaiting data — each backed by the readiness/submissions endpoints. No
 * charts anywhere; a clean state (every card's quiet check-mark line) reads
 * as good news, not a broken/empty page.
 *
 * `compliance-flow-reframe.md` Phase 3 / `10-Specs/UI-Workflows/dashboard.md`.
 */
export default function DashboardPage() {
  return (
    <div>
      <header className="mb-[22px]">
        <h1 className="text-display text-4xl leading-[1.04] font-light italic">{greeting()}</h1>
        <p className="mt-2.5 text-[15px] text-muted-foreground">{formatDateLine()}</p>
      </header>

      <StatStrip />

      <div className="flex flex-col gap-[18px]">
        <NeedsFilingCard />
        <ShipmentsLeadTimeCard />
        <NeedsRemediationCard />
        <AwaitingDataCard />
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useDdsStatements,
  useHighRiskSuppliers,
  usePlotsFailingValidationCount,
  useReadinessRows,
} from "@/hooks/use-dashboard-data";
import { computeHighRiskConcentration, countDdsExpiringWithin90Days, formatWholeNumber } from "@/lib/dashboard-worklist";

interface RiskRowData {
  key: string;
  label: string;
  subLabel: string;
  value: string;
  tone: "neutral" | "warn" | "bad";
  href: string;
}

function RiskRow({ row }: { row: RiskRowData }) {
  const toneClass = row.tone === "bad" ? "text-destructive" : row.tone === "warn" ? "text-accent" : "text-foreground";
  return (
    <Link
      href={row.href}
      className="flex items-center gap-3 border-b border-border px-4 py-3 no-underline last:border-b-0 hover:bg-muted/40"
    >
      <div className="flex-1">
        <p className="text-[13.5px] text-foreground">{row.label}</p>
        <p className="text-[12px] text-muted-foreground">{row.subLabel}</p>
      </div>
      <span className={cn("text-[15px] font-semibold tabular-nums", toneClass)}>{row.value}</span>
    </Link>
  );
}

/**
 * Tier 4 "Risk Concentration" (dashboard-redesign.md) — standing exposure
 * that predicts tomorrow's Tier 1 alerts. Phase 1 ships 3 of the 4 designed
 * metrics; 4c (certifications expiring < 30 days) is deferred to backend
 * #137 (`SupplierListSerializer` excludes `certifications`; computing it
 * client-side would need an N+1 fetch per supplier) and is OMITTED
 * entirely — not shown as a "—" row, just absent.
 *
 * Every click-through opens the destination list PRE-FILTERED:
 * `/suppliers?risk_rating=HIGH`, `/plots?validation_status=FAILED`,
 * `/due-diligence?status=SUBMITTED` (dashboard-redesign-phase1 filtering
 * addendum, Tasks 7.1–7.3) — each destination page reads its query param
 * into page-level state seeded on first render, the same way `/shipments`
 * already deep-links `?rag=RED`, so the filter is applied before the user
 * does anything. Not routed through `DataTable`'s own `FilterDef` (no
 * external initializer there — see Tasks 7.1–7.3's docstrings).
 *
 * Deliberately takes NO `showCta` prop, unlike Tiers 1–2: these row-level
 * links are metric drill-down navigation (equivalent to a table-row
 * click-through elsewhere in the app), not the named action-button CTAs
 * ("Cover now"/"Remediate"/"Review"/"File DDS") the VIEWER CTA-visibility
 * flip governs (Global Constraints) — always visible, to every role.
 */
export function RiskConcentrationCard() {
  const { data: readinessRows, isLoading: readinessLoading, isError: readinessError } = useReadinessRows();
  const { data: highRiskSuppliers, isLoading: highRiskLoading, isError: highRiskError } = useHighRiskSuppliers();
  const { data: plotsFailing, isLoading: plotsLoading, isError: plotsError } = usePlotsFailingValidationCount();
  const { data: statements, isLoading: statementsLoading, isError: statementsError } = useDdsStatements();

  const isLoading = readinessLoading || highRiskLoading || plotsLoading || statementsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk Concentration</CardTitle>
          <CardDescription>Standing exposure that predicts tomorrow&apos;s Tier 1 alerts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 px-0" aria-hidden>
          <Skeleton className="mx-4 h-9" />
          <Skeleton className="mx-4 h-9" />
          <Skeleton className="mx-4 h-9" />
        </CardContent>
      </Card>
    );
  }

  const highRiskFailed = highRiskError || readinessError;
  const concentration = !highRiskFailed
    ? computeHighRiskConcentration(readinessRows ?? [], highRiskSuppliers ?? [])
    : null;
  const ddsExpiringCount = statementsError ? null : countDdsExpiringWithin90Days(statements ?? []);

  const rows: RiskRowData[] = [
    {
      key: "high-risk-sourcing",
      label: "Suppliers flagged high-risk",
      subLabel:
        concentration && concentration.countryNames.length > 0
          ? concentration.countryNames.join(", ")
          : "None sourced from currently",
      value: !concentration
        ? "—"
        : concentration.supplierCount === 0
          ? "0"
          : `${concentration.supplierCount} supplier${concentration.supplierCount === 1 ? "" : "s"} · ${concentration.volumePct ?? 0}% vol`,
      tone: !concentration || concentration.supplierCount === 0 ? "neutral" : "warn",
      href: "/suppliers?risk_rating=HIGH",
    },
    {
      key: "plots-failing",
      label: "Plots failing validation",
      subLabel: "Deforestation / overlap",
      value: plotsError ? "—" : formatWholeNumber(plotsFailing ?? 0),
      tone: plotsError || !plotsFailing ? "neutral" : "bad",
      href: "/plots?validation_status=FAILED",
    },
    {
      key: "dds-expiring",
      label: "Filed DDS expiring < 90 days",
      subLabel: "Audit-trail freshness",
      value: ddsExpiringCount == null ? "—" : formatWholeNumber(ddsExpiringCount),
      tone: !ddsExpiringCount ? "neutral" : "bad",
      href: "/due-diligence?status=SUBMITTED",
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Risk Concentration</CardTitle>
        <CardDescription>Standing exposure that predicts tomorrow&apos;s Tier 1 alerts</CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        {rows.map((row) => (
          <RiskRow key={row.key} row={row} />
        ))}
      </CardContent>
    </Card>
  );
}

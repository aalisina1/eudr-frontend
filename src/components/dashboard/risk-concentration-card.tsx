"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CERTS_EXPIRING_WINDOW_DAYS,
  useCertificationsExpiringSoon,
  useDdsStatements,
  useHighRiskSuppliers,
  usePlotsFailingValidationCount,
  useReadinessRows,
} from "@/hooks/use-dashboard-data";
import type { CertificationExpiring } from "@/lib/api/types";
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

/** "2 suppliers · Rainforest Alliance, Fairtrade" — the mockup's sub-label
 * for 4c. Suppliers are counted DISTINCT (one supplier with three lapsing
 * certs is one supplier at risk, and the certificate count is already the
 * row's value). Types are capped so a long tail can't overrun the row.
 *
 * Derived from the fetched rows, which are capped at `page_size=100`, so past
 * 100 lapsing certs org-wide this undercounts suppliers/types while the row's
 * VALUE (the paginator `count`) stays exact. That asymmetry is deliberate and
 * the safe direction — the headline number a compliance officer acts on is
 * never understated; only the descriptive gloss is. Same pilot-scale
 * convention as 4a's supplier join (dashboard-redesign.md). */
function summariseExpiringCerts(rows: CertificationExpiring[]): string {
  if (rows.length === 0) return "None expiring";
  const supplierCount = new Set(rows.map((r) => r.supplier_id)).size;
  const types = Array.from(new Set(rows.map((r) => r.certification_type)));
  const shown = types.slice(0, MAX_CERT_TYPES_SHOWN).join(", ");
  const overflow = types.length - MAX_CERT_TYPES_SHOWN;
  const typeLabel = overflow > 0 ? `${shown} +${overflow} more` : shown;
  return `${supplierCount} supplier${supplierCount === 1 ? "" : "s"} · ${typeLabel}`;
}

const MAX_CERT_TYPES_SHOWN = 2;

/**
 * Tier 4 "Risk concentration" (dashboard-redesign.md) — standing exposure
 * that predicts tomorrow's Tier 1 alerts. All four designed metrics now
 * ship: 4c (certifications expiring) was omitted in Phase 1 pending backend
 * surface, and landed once eudr-app#139 supplied the row-level feed and
 * #148 gave it a filtered destination.
 *
 * ⚠️ 4c is a FORWARD-LOOKING warning, by the backend's contract (#139):
 * the window is `today <= valid_until <= today + 30`, so an **already-
 * lapsed** certification appears nowhere in this card. That is the more
 * severe state, and it is currently visible only on a supplier's detail
 * page. Do not "fix" this by widening the window — that would merge two
 * distinct states into one count (the same mistake eudr-frontend#82 records
 * for DDS). It wants its own metric.
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
  const { data: expiringCerts, isLoading: certsLoading, isError: certsError } = useCertificationsExpiringSoon();

  const isLoading = readinessLoading || highRiskLoading || plotsLoading || statementsLoading || certsLoading;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Risk concentration</CardTitle>
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
      key: "certs-expiring",
      label: `Certifications expiring < ${CERTS_EXPIRING_WINDOW_DAYS} days`,
      subLabel: certsError ? "Unavailable" : summariseExpiringCerts(expiringCerts?.rows ?? []),
      // The paginator's total, never `rows.length` — the rows are capped at
      // page_size=100 for the sub-label, and a truncated page must not
      // understate exposure on a compliance surface.
      value: certsError ? "—" : formatWholeNumber(expiringCerts?.count ?? 0),
      tone: certsError || !expiringCerts?.count ? "neutral" : "warn",
      href: `/suppliers?certifications_expiring=${CERTS_EXPIRING_WINDOW_DAYS}`,
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
        <CardTitle className="text-base">Risk concentration</CardTitle>
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

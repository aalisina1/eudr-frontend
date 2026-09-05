"use client";

import { useQuery } from "@tanstack/react-query";
import { Download, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyChip } from "@/components/copy-chip";
import { ledgerToCsv } from "@/lib/consignment-ledger";
import { formatEta } from "@/lib/readiness-format";
import { authFetch } from "@/lib/api/client";
import type { ConsignmentLedger } from "@/lib/api/types";

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-border/40 py-2 last:border-0">
      <span className="w-40 shrink-0 text-xs text-muted-foreground">{label}</span>
      <div className="flex flex-wrap items-center gap-2 text-[13px]">{children}</div>
    </div>
  );
}

function downloadCsv(ledger: ConsignmentLedger) {
  const blob = new Blob([ledgerToCsv(ledger)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `ledger-${ledger.reference}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Customs Reference Ledger — the per-consignment audit record: B/L → PO(s) →
 * covering DDS(s) with their TRACES reference+verification pair → the customs
 * declaration. TRACES issues the two halves at different lifecycle stages —
 * the reference at SUBMITTED, the verification number only at AVAILABLE — so
 * a reference-without-verification row is the normal pending state, not an
 * error. A verification without a reference should never happen; treat it
 * defensively as not submitted. */
export function ReferenceLedgerCard({
  consignmentId,
  canWrite,
  onEdit,
}: {
  consignmentId: string;
  canWrite: boolean;
  onEdit: () => void;
}) {
  const { data, isLoading, error } = useQuery<ConsignmentLedger>({
    queryKey: ["consignment-ledger", consignmentId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/supply-chain/consignments/${encodeURIComponent(consignmentId)}/ledger/`,
      );
      if (!res.ok) throw new Error("Failed to fetch the reference ledger");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Reference ledger</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </CardContent>
      </Card>
    );
  }
  if (error || !data) {
    return (
      <Card>
        <CardHeader><CardTitle>Reference ledger</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-destructive">Failed to load the reference ledger.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Reference ledger</CardTitle>
        <Button variant="outline" size="sm" onClick={() => downloadCsv(data)} className="gap-1.5">
          <Download className="size-3.5" /> Export CSV
        </Button>
      </CardHeader>
      <CardContent>
        <Row label="B/L reference">
          <span className="font-mono font-medium">{data.reference}</span>
        </Row>

        <Row label="Purchase orders">
          {/* Defaulted, not asserted. A 200 whose body predates #77 (frontend
              deployed ahead of the backend, as the two services deploy
              independently) has no `po_references`, and reading `.length` off
              it threw a client-side exception that took the WHOLE shipment
              detail page down — a blank screen, not a degraded card. The
              quality bar is that a page always renders something. */}
          {(data.po_references ?? []).length > 0 ? (
            (data.po_references ?? []).map((po) => (
              <span key={po} className="font-mono">{po}</span>
            ))
          ) : (
            <span className="text-muted-foreground">None linked</span>
          )}
        </Row>

        <Row label="Due diligence">
          {(data.dds_rows ?? []).length === 0 ? (
            <span className="text-muted-foreground">No DDS covers this consignment yet</span>
          ) : (
            <div className="space-y-3">
              {data.dds_rows.map((d) => (
                <div key={d.dds_id} className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-medium">{d.reference_number}</span>
                    <span className="text-xs text-muted-foreground">
                      covers {d.covered_lot_count} {d.covered_lot_count === 1 ? "lot" : "lots"}
                    </span>
                    {d.traces_status && <Badge variant="outline">{d.traces_status}</Badge>}
                  </div>
                  {/* Reference arrives at SUBMITTED, verification only at AVAILABLE —
                      a reference without a verification number is the normal pending
                      state. A verification without a reference should never happen;
                      treat it as not submitted rather than rendering a lone chip. */}
                  {d.traces_reference_number && d.verification_number ? (
                    <div className="flex flex-wrap gap-4">
                      <CopyChip label="TRACES reference" value={d.traces_reference_number} />
                      <CopyChip label="Verification number" value={d.verification_number} />
                    </div>
                  ) : d.traces_reference_number ? (
                    <div className="flex flex-wrap items-center gap-4">
                      <CopyChip label="TRACES reference" value={d.traces_reference_number} />
                      <p className="text-xs text-muted-foreground">Verification number pending</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground">Not submitted to TRACES</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Row>

        <Row label="Customs declaration">
          {data.customs_declaration_reference ? (
            <span className="font-mono">{data.customs_declaration_reference}</span>
          ) : (
            <>
              <span className="text-muted-foreground">Not recorded</span>
              {canWrite && (
                <Button variant="ghost" size="sm" onClick={onEdit} className="h-6 gap-1 text-xs">
                  <Plus className="size-3" /> Add
                </Button>
              )}
            </>
          )}
        </Row>

        <Row label="Clearance date">
          <span>{data.expected_clearance_date ? formatEta(data.expected_clearance_date) : "—"}</span>
        </Row>

        {data.uncovered_lot_count > 0 && (
          <p className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-xs text-accent">
            {data.uncovered_lot_count}{" "}
            {data.uncovered_lot_count === 1 ? "lot" : "lots"} not covered by any DDS —
            ledger incomplete.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

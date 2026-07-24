"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Send } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { DDSForm } from "@/components/forms/dds-form";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type {
  ConsignmentDetail,
  DueDiligenceStatement,
  PayloadEstimateResponse,
  POReadinessDetail,
  Product,
  Supplier,
} from "@/lib/api/types";
import {
  buildSplitSuggestion,
  formatHarvestRange,
  formatKgFinePrint,
  formatMb,
  formatTonnes,
  harvestPeriodRange,
  summarizeNetMass,
} from "@/lib/file-dds-composer";
import { UNIT_LABELS } from "@/lib/readiness-format";

async function fetchPoReadiness(poId: string): Promise<POReadinessDetail> {
  const res = await authFetch(`/api/v1/supply-chain/batches/${encodeURIComponent(poId)}/readiness/`);
  if (!res.ok) throw new Error("Failed to load purchase order.");
  return res.json();
}

/** Adapt a consignment into the composer's existing PO-shaped `source`
 * (Decision 4 — a consignment is a second anchor, not a mode). Lots carry only
 * id/ref/qty/unit/coverage; harvest/plot/seller are absent, so they resolve to
 * the composer's existing "Missing"/"—"/empty-lookup behaviors. The payload
 * meter reads from the payload-estimate endpoint (by lot id), so it is
 * unaffected. */
function consignmentToSource(d: ConsignmentDetail): POReadinessDetail {
  return {
    id: d.id,
    reference_number: d.reference,
    seller_id: "",
    buyer_id: "",
    product_id: "",
    transaction_date: "",
    stage: "OPEN",
    blocked: false,
    blockers: [],
    funnel: {
      unit: "KG", ordered_quantity: "0", allocated_quantity: "0",
      geolocated_quantity: "0", filed_quantity: "0", uncovered_quantity: "0",
    },
    lot_count: d.lots.length,
    next_deadline: d.countdown_to,
    lots: d.lots.map((l) => ({
      id: l.id,
      reference_number: l.reference_number,
      quantity: l.quantity,
      unit: l.unit,
      harvest_period_start: null,
      harvest_period_end: null,
      plot_count: 0,
      plots_resolved: false,
      plots_failed_count: 0,
      plots_pending_count: 0,
      filed: l.covered,
      filing_dds_id: l.covering_dds_id,
      filing_dds_reference: l.covering_dds_reference,
      shipment_reference: d.reference,
      expected_clearance_date: d.expected_clearance_date,
    })),
  };
}

async function fetchConsignmentSource(consignmentId: string): Promise<POReadinessDetail> {
  const res = await authFetch(`/api/v1/supply-chain/consignments/${encodeURIComponent(consignmentId)}/`);
  if (!res.ok) throw new Error("Failed to load consignment.");
  return consignmentToSource(await res.json());
}

async function fetchSupplier(id: string): Promise<Supplier> {
  const res = await authFetch(`/api/v1/suppliers/${encodeURIComponent(id)}/`);
  if (!res.ok) throw new Error("Failed to load supplier.");
  return res.json();
}

async function fetchProduct(id: string): Promise<Product> {
  const res = await authFetch(`/api/v1/commodities/products/${encodeURIComponent(id)}/`);
  if (!res.ok) throw new Error("Failed to load product.");
  return res.json();
}

/** Candidate `batch_ids` are already real UUIDs resolved server-side from the
 * PO's own readiness detail — never raw user text — so no client-side
 * `.uuid()`-style validation is applied here (seeded demo ids aren't all
 * RFC-4122-valid — eudr-app#99 — validating that shape client-side would
 * reject perfectly real, backend-issued ids). */
async function fetchPayloadEstimate(batchIds: string[]): Promise<PayloadEstimateResponse> {
  const res = await authFetch(`/api/v1/supply-chain/batches/payload-estimate/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ batch_ids: batchIds }),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(body));
  }
  return res.json();
}

interface FileDdsComposerProps {
  /** Exactly one anchor is set: a PO (existing `?po=` path) or a consignment
   * (`?consignment=`, spec Decision 4). */
  poId?: string;
  consignmentId?: string;
}

/**
 * File DDS composition page (#26, sourcing-readiness.design-prompt.md
 * Prompt C + Round-2 item 1) — full page (not a Sheet), the `?po=` deep-link
 * target from the PO Detail "File DDS" CTA (`src/app/(dashboard)/
 * supply-chains/[id]/page.tsx`).
 *
 * Left: the PO's lot batches, checked by default (spec Decision 5 — explicit
 * per-lot lines, splittable/auditable), with a freeform escape hatch to the
 * pre-existing "New Statement" Sheet (`DDSForm`) for cross-PO/periodic
 * composition. Right: an auto-computed declaration summary, the geolocation
 * payload meter (fed by eudr-app #94/BE-C's payload-estimate endpoint — the
 * dependency this issue was blocked on until PR #98 merged), and a read-only
 * risk-assessment placeholder (#25 owns the real scoring UI).
 *
 * "Submit to TRACES" creates the DDS (DRAFT, prefilled `batch_ids`) and
 * immediately submits it for review (both `IsComplianceOfficer`-gated, the
 * role that composes here), then hands off to the existing v0.2.0 lifecycle
 * — an ADMIN approves it, and only then does `TracesPanel` (on the DDS
 * detail page) actually submit to TRACES. This composer never calls the
 * TRACES-submission endpoint itself; "hands off" is literal. "Save draft"
 * performs only the first step, leaving it DRAFT for further editing.
 */
export function FileDdsComposer({ poId, consignmentId }: FileDdsComposerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  // `null` means "no manual selection yet" — `checkedIds` below falls back
  // to every lot checked (Prompt C's default) whenever it's null, so there's
  // no seeding effect/render-lag between the PO arriving and its lots
  // showing checked (that gap previously left the loading guard's
  // `checkedIds === null` condition permanently true on a failed fetch,
  // masking the not-found state — see PR review discussion on #26).
  const [checkedOverride, setCheckedOverride] = useState<Set<string> | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [freeformOpen, setFreeformOpen] = useState(false);

  const anchorKind: "po" | "consignment" = consignmentId ? "consignment" : "po";
  const anchorId = consignmentId ?? poId ?? "";
  const backHref =
    anchorKind === "consignment"
      ? `/shipments/${encodeURIComponent(anchorId)}`
      : `/supply-chains/${encodeURIComponent(anchorId)}`;

  const {
    data: po,
    isLoading,
    error,
  } = useQuery<POReadinessDetail>({
    queryKey: ["dds-composer-source", anchorKind, anchorId],
    queryFn: () =>
      anchorKind === "consignment" ? fetchConsignmentSource(anchorId) : fetchPoReadiness(anchorId),
    enabled: !!anchorId,
  });

  const allLotIds = useMemo(() => new Set(po?.lots.map((l) => l.id) ?? []), [po]);
  const checkedIds = checkedOverride ?? allLotIds;

  const { data: supplier } = useQuery<Supplier>({
    queryKey: ["supplier", po?.seller_id],
    queryFn: () => fetchSupplier(po!.seller_id),
    enabled: !!po?.seller_id,
    staleTime: 60_000,
  });

  const { data: product } = useQuery<Product>({
    queryKey: ["product", po?.product_id],
    queryFn: () => fetchProduct(po!.product_id),
    enabled: !!po?.product_id,
    staleTime: 60_000,
  });

  const checkedList = useMemo(
    () => (checkedIds ? Array.from(checkedIds).sort() : []),
    [checkedIds],
  );

  const {
    data: estimate,
    isFetching: estimateLoading,
    error: estimateError,
  } = useQuery<PayloadEstimateResponse>({
    queryKey: ["payload-estimate", anchorId, checkedList.join(",")],
    queryFn: () => fetchPayloadEstimate(checkedList),
    enabled: checkedList.length > 0,
  });

  const lotLabelById = useMemo(() => {
    const map = new Map<string, string>();
    po?.lots.forEach((l) => map.set(l.id, l.reference_number));
    return map;
  }, [po]);

  // `LotReadiness.shipment_reference` isn't populated by the readiness
  // detail endpoint yet (documented gap — see the FOLLOW-UP note on
  // `LotReadiness` in `lib/api/types.ts`), but the payload-estimate response
  // carries it per batch as a required field. Reusing that (already-fetched
  // for the meter) fills the "Covered lots" table's Shipment column with
  // real backend data instead of always reading "—", without adding a new
  // request or inventing anything client-side.
  const shipmentRefByBatchId = useMemo(() => {
    const map = new Map<string, string | null>();
    estimate?.batches.forEach((b) => map.set(b.batch_id, b.shipment_reference));
    return map;
  }, [estimate]);

  const createMutation = useMutation({
    mutationFn: async (advanceToReview: boolean) => {
      const res = await authFetch(`/api/v1/due-diligence/statements/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statement_type: "OPERATOR", batch_ids: checkedList }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body));
      }
      const dds: DueDiligenceStatement = await res.json();

      if (!advanceToReview) return { dds, advanced: false };

      const reviewRes = await authFetch(
        `/api/v1/due-diligence/statements/${encodeURIComponent(dds.id)}/submit-for-review/`,
        { method: "POST" },
      );
      // The DDS itself was created either way — a failed review-advance
      // isn't lost work, just a partial outcome the caller surfaces below.
      return { dds, advanced: reviewRes.ok };
    },
    onSuccess: ({ dds, advanced }) => {
      queryClient.invalidateQueries({ queryKey: ["due-diligence"] });
      setConfirmOpen(false);
      toast.success(
        advanced
          ? "Statement created and submitted for review"
          : "Draft statement saved",
      );
      router.push(`/due-diligence/${encodeURIComponent(dds.id)}`);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  if (isLoading) {
    return (
      <div className="max-w-6xl space-y-6">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="h-10 w-96" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Skeleton className="h-80 rounded-xl lg:col-span-2" />
          <Skeleton className="h-80 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !po) {
    return (
      <div className="max-w-6xl space-y-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/due-diligence")}
          className="-ml-2 gap-1.5 text-muted-foreground"
        >
          <ArrowLeft className="size-4" /> Submissions
        </Button>
        <div className="flex items-center gap-2 rounded-xl border border-destructive/15 bg-destructive/8 px-4 py-3 text-sm text-destructive">
          {anchorKind === "consignment" ? "Consignment" : "Purchase order"} not found or failed to load.
        </div>
      </div>
    );
  }

  const netMass = summarizeNetMass(po.lots, checkedIds);
  const range = harvestPeriodRange(po.lots, checkedIds);
  const harvestLabel = formatHarvestRange(range.start, range.end);
  const countryOfProduction = supplier?.country_of_origin ?? "—";
  const commodityLabel = product?.commodity_name || product?.description || "—";

  function toggleLot(id: string) {
    setCheckedOverride((prev) => {
      const next = new Set(prev ?? allLotIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setCheckedOverride((prev) => {
      const current = prev ?? allLotIds;
      return current.size === allLotIds.size ? new Set() : new Set(allLotIds);
    });
  }

  function applySplit(batchIds: string[], label: string) {
    setCheckedOverride(new Set(batchIds));
    toast.info(`Kept ${label} checked. Repeat File DDS for the remaining lots once this one is filed.`);
  }

  const exceedsLimit = !!estimate?.exceeds_limit;
  const splitSuggestion =
    estimate && exceedsLimit
      ? buildSplitSuggestion(estimate.batches, (id) => lotLabelById.get(id) ?? id)
      : null;

  return (
    <div className="max-w-6xl space-y-6 pb-24">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(backHref)}
        className="-ml-2 gap-1.5 text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> {po.reference_number}
      </Button>

      <div>
        <h1 className="text-display text-3xl font-light italic">New Due Diligence Statement</h1>
        <p className="mt-2 text-sm text-muted-foreground">Pre-filled from {po.reference_number}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left — Covered lots */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between gap-4">
            <div>
              <CardTitle>Covered lots</CardTitle>
              <CardDescription>{checkedIds.size} of {po.lots.length} lots selected</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => setFreeformOpen(true)}>
              <Plus className="size-3.5" /> Add lots from other POs
            </Button>
          </CardHeader>
          <CardContent className="px-1.5 pb-3.5">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">
                    <Checkbox
                      aria-label="Select all lots"
                      checked={po.lots.length > 0 && checkedIds.size === po.lots.length}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead>Lot ref</TableHead>
                  <TableHead>Shipment</TableHead>
                  <TableHead className="text-right">Quantity</TableHead>
                  <TableHead>Plots</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.lots.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="py-6 text-center text-sm text-muted-foreground">
                      No lots linked to this order yet.
                    </TableCell>
                  </TableRow>
                ) : (
                  po.lots.map((lot) => {
                    const unitLabel = UNIT_LABELS[lot.unit] ?? lot.unit.toLowerCase();
                    return (
                      <TableRow key={lot.id}>
                        <TableCell>
                          <Checkbox
                            aria-label={`Select ${lot.reference_number}`}
                            checked={checkedIds.has(lot.id)}
                            onCheckedChange={() => toggleLot(lot.id)}
                          />
                        </TableCell>
                        <TableCell>
                          <span className="font-mono text-[13px] font-medium">{lot.reference_number}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-[12.5px] text-muted-foreground">
                            {lot.shipment_reference || shipmentRefByBatchId.get(lot.id) || "—"}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {Math.round(Number(lot.quantity)).toLocaleString()} {unitLabel}
                        </TableCell>
                        <TableCell>
                          <span className="text-[12.5px] text-muted-foreground">
                            {lot.plot_count} plot{lot.plot_count === 1 ? "" : "s"}
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
              {po.lots.length === 0 && <TableCaption>No lots yet</TableCaption>}
            </Table>
          </CardContent>
        </Card>

        {/* Right — Declaration summary, payload meter, risk assessment */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Declaration summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Commodity</span>
                <span className="font-medium">{commodityLabel}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">CN code</span>
                <span className="font-mono">{product?.cn_code || "—"}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Total net mass</span>
                <span className="text-right">
                  <span className="font-medium">{formatTonnes(netMass.totalKg)}</span>
                  <span className="ml-1.5 text-xs text-muted-foreground">
                    ({formatKgFinePrint(netMass.totalKg)})
                  </span>
                </span>
              </div>
              {netMass.excludedUnitCount > 0 && (
                <p className="text-xs text-muted-foreground">
                  {netMass.excludedUnitCount} checked lot{netMass.excludedUnitCount === 1 ? "" : "s"} in a
                  non-mass unit excluded from this total.
                </p>
              )}
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Country of production</span>
                <span className="font-medium">{countryOfProduction}</span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-muted-foreground">Harvest period</span>
                {harvestLabel ? (
                  <span className="font-medium">{harvestLabel}</span>
                ) : (
                  <Badge variant="destructive">Missing</Badge>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Geolocation payload</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {checkedIds.size === 0 ? (
                <p className="text-sm text-muted-foreground">Select at least one lot to estimate the payload.</p>
              ) : estimateLoading && !estimate ? (
                <Skeleton className="h-10 w-full rounded-lg" />
              ) : estimateError ? (
                <p className="text-sm text-destructive">{getErrorMessage(estimateError)}</p>
              ) : estimate ? (
                <>
                  <div className="space-y-1.5">
                    <p className={`text-sm ${exceedsLimit ? "font-medium text-destructive" : "text-foreground"}`}>
                      {exceedsLimit
                        ? `${formatMb(estimate.estimated_bytes)} — exceeds the TRACES ${formatMb(estimate.limit_bytes)} limit`
                        : `Estimated payload ${formatMb(estimate.estimated_bytes)} of ${formatMb(estimate.limit_bytes)} limit`}
                    </p>
                    <Progress
                      value={Math.min(100, (estimate.estimated_bytes / estimate.limit_bytes) * 100)}
                      indicatorClassName={exceedsLimit ? "bg-destructive" : undefined}
                    />
                  </div>

                  {estimate.errors.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {estimate.errors.length} checked lot{estimate.errors.length === 1 ? "" : "s"} excluded
                      from this estimate — missing resolvable plot geometry.
                    </p>
                  )}

                  {exceedsLimit && splitSuggestion && (
                    <div className="space-y-2 rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                      <p className="text-xs text-destructive">
                        Split into {splitSuggestion.groups.length} statements
                        {splitSuggestion.mode === "shipment" ? " by shipment" : " by lot"}:{" "}
                        {splitSuggestion.groups.map((g) => `${g.label} (${formatMb(g.totalBytes)})`).join(" · ")}
                      </p>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => applySplit(splitSuggestion.groups[0].batchIds, splitSuggestion.groups[0].label)}
                      >
                        Split by {splitSuggestion.mode === "shipment" ? "shipment" : "lot"}
                      </Button>
                    </div>
                  )}
                </>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Risk assessment</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-3">
              <Badge variant="secondary">Not yet assessed</Badge>
              {/* Full scoring/mitigation/sign-off UI is #25 — this card is a
                  read-only placeholder until a DDS (with an id to assess)
                  exists. */}
              <Button variant="ghost" size="sm" disabled>
                View assessment
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border/50 bg-background/95 py-3 backdrop-blur supports-backdrop-filter:bg-background/80">
        <div className="mx-auto flex max-w-6xl items-center justify-end gap-2 px-6">
          <Button
            variant="ghost"
            disabled={checkedIds.size === 0 || createMutation.isPending}
            onClick={() => createMutation.mutate(false)}
          >
            Save draft
          </Button>
          <Button
            disabled={checkedIds.size === 0 || createMutation.isPending}
            onClick={() => setConfirmOpen(true)}
            className="gap-1.5"
          >
            <Send className="size-3.5" /> Submit to TRACES
          </Button>
        </div>
      </div>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Submit to TRACES?</AlertDialogTitle>
            <AlertDialogDescription>
              After submission this statement locks — you have 72 hours to amend it. Some covered lots may
              not have shipped yet; if allocations change after filing, the declaration will no longer match
              the physical shipment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={createMutation.isPending}
              onClick={() => createMutation.mutate(true)}
            >
              Submit statement
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <DDSForm open={freeformOpen} onOpenChange={setFreeformOpen} />
    </div>
  );
}

"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Cable, ClipboardList, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type ColumnDef } from "@/components/data-table";
import { PurchaseOrderForm } from "@/components/forms/purchase-order-form";
import { StageBadge, STAGE_FILTER_OPTIONS, STAGE_LABELS } from "@/components/sourcing/stage-badge";
import { DeadlineChip } from "@/components/sourcing/deadline-chip";
import { TonnageBar, CoverageLegend } from "@/components/sourcing/tonnage-bar";
import { authFetch } from "@/lib/api/client";
import { UNIT_LABELS } from "@/lib/readiness-format";
import type { BatchReadiness, PaginatedResponse, Product, Supplier } from "@/lib/api/types";

/** Whole-number, thousands-separated quantity — funnel values are decimal
 * strings (e.g. "250000.0000"); display the PO's native unit rather than
 * inventing a tonnes conversion (eudr-app PR #83: "per-PO list/detail views
 * show native units", only the aggregate/summary endpoint normalises to KG). */
function formatQty(value: string): string {
  return Math.round(Number(value)).toLocaleString();
}

function SupplierCell({ sellerId, suppliersById }: { sellerId: string; suppliersById?: Record<string, Supplier> }) {
  const supplier = suppliersById?.[sellerId];
  if (!supplier) {
    return <span className="font-mono text-xs text-muted-foreground">{sellerId.slice(-8)}</span>;
  }
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[13px] font-medium">{supplier.name}</span>
      <span className="text-[11.5px] text-muted-foreground">{supplier.country_of_origin}</span>
    </div>
  );
}

function CommodityCell({ productId, productsById }: { productId: string; productsById?: Record<string, Product> }) {
  const product = productsById?.[productId];
  if (!product) {
    return <span className="font-mono text-xs text-muted-foreground">{productId.slice(-8)}</span>;
  }
  return <span className="text-[13px] text-muted-foreground">{product.commodity_name || product.description}</span>;
}

function PoRefCell({ po }: { po: BatchReadiness }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="font-mono text-[13px] font-medium">{po.reference_number}</span>
      <span className="text-[11.5px] text-muted-foreground">
        {po.lot_count === 0 ? "No lots yet" : `${po.lot_count} lot${po.lot_count === 1 ? "" : "s"}`}
      </span>
    </div>
  );
}

function CoverageCell({ funnel }: { funnel: BatchReadiness["funnel"] }) {
  const unitLabel = UNIT_LABELS[funnel.unit] ?? funnel.unit.toLowerCase();
  return (
    <div className="flex flex-col gap-1.5">
      <TonnageBar
        ordered={Number(funnel.ordered_quantity)}
        allocated={Number(funnel.allocated_quantity)}
        geolocated={Number(funnel.geolocated_quantity)}
        filed={Number(funnel.filed_quantity)}
        unit={` ${unitLabel}`}
      />
      <span className="font-mono text-[11.5px] text-muted-foreground">
        {formatQty(funnel.filed_quantity)} / {formatQty(funnel.ordered_quantity)} {unitLabel} filed
      </span>
    </div>
  );
}

function StageCell({ po }: { po: BatchReadiness }) {
  const failedBlocker = po.blockers.find((b) => b.code === "PLOTS_FAILED_VALIDATION");
  return (
    <div className="flex flex-col items-start gap-1">
      <StageBadge stage={po.stage} blocked={po.blocked} />
      {po.blocked && failedBlocker && <span className="text-[11.5px] text-destructive">{failedBlocker.message}</span>}
    </div>
  );
}

function EmptyStateActions({ onNew }: { onNew: () => void }) {
  const router = useRouter();
  return (
    <div className="flex items-center gap-2.5">
      <Button size="sm" onClick={onNew} className="gap-1.5">
        <Plus className="size-3.5" /> New purchase order
      </Button>
      <Button size="sm" variant="ghost" onClick={() => router.push("/integrations")} className="gap-1.5">
        <Cable className="size-3.5" /> Connect a data source
      </Button>
    </div>
  );
}

export default function SourcingPage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [stageFilter, setStageFilter] = useState("");

  // Supplier/product are resolved client-side for display — the readiness
  // list/detail contract (eudr-app PR #83) only carries `seller_id` /
  // `product_id` UUIDs, not joined names. Pilot-scale lookups (page_size
  // capped at the backend's max of 100), same assumption as the New-PO form.
  const { data: suppliersById } = useQuery({
    queryKey: ["suppliers", "lookup"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/suppliers/?page_size=100");
      if (!res.ok) throw new Error("Failed to load suppliers");
      const body: PaginatedResponse<Supplier> = await res.json();
      return Object.fromEntries(body.results.map((s) => [s.id, s])) as Record<string, Supplier>;
    },
    staleTime: 60_000,
  });

  const { data: productsById } = useQuery({
    queryKey: ["products", "lookup"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/commodities/products/?page_size=100");
      if (!res.ok) throw new Error("Failed to load products");
      const body: PaginatedResponse<Product> = await res.json();
      return Object.fromEntries(body.results.map((p) => [p.id, p])) as Record<string, Product>;
    },
    staleTime: 60_000,
  });

  // The Stage filter is a single unified 7-option select (design + issue
  // #28 acceptance criteria), but "Blocked" is really a different backend
  // query param than the other six (`blocked=true`, not `stage=BLOCKED` —
  // blocked is an independent overlay, not a stage value). DataTable's
  // generic `filters` can't express two options mapping to two different
  // param names, hence the custom `extraParams`-driven select below.
  const extraParams = useMemo((): Record<string, string> => {
    if (!stageFilter) return {};
    if (stageFilter === "BLOCKED") return { blocked: "true" };
    return { stage: stageFilter };
  }, [stageFilter]);

  const columns: ColumnDef<BatchReadiness>[] = useMemo(
    () => [
      {
        key: "reference_number",
        header: "PO reference",
        render: (po) => <PoRefCell po={po} />,
      },
      {
        key: "seller_id",
        header: "Supplier",
        render: (po) => <SupplierCell sellerId={po.seller_id} suppliersById={suppliersById} />,
        exportValue: (po) => suppliersById?.[po.seller_id]?.name ?? po.seller_id,
      },
      {
        key: "product_id",
        header: "Commodity",
        render: (po) => <CommodityCell productId={po.product_id} productsById={productsById} />,
        exportValue: (po) => {
          const product = productsById?.[po.product_id];
          return product?.commodity_name || product?.description || po.product_id;
        },
      },
      {
        key: "funnel",
        header: "Coverage",
        render: (po) => <CoverageCell funnel={po.funnel} />,
        exportValue: (po) =>
          `${formatQty(po.funnel.filed_quantity)} / ${formatQty(po.funnel.ordered_quantity)} ${po.funnel.unit} filed`,
      },
      {
        key: "deadline",
        header: "Next deadline",
        // [FOLLOW-UP eudr-app#61] Always the muted placeholder for now — the
        // shipment/expected_clearance_date fields this needs aren't in the
        // readiness contract yet (BE-B, not built). Do not invent
        // client-side deadline data; wire real props once #61 ships.
        render: () => <DeadlineChip />,
        exportValue: () => "—",
      },
      {
        key: "stage",
        header: "Stage",
        render: (po) => <StageCell po={po} />,
        exportValue: (po) => `${STAGE_LABELS[po.stage]}${po.blocked ? " (Blocked)" : ""}`,
      },
      {
        key: "actions",
        header: "Actions",
        render: (po) => (
          <Button
            size="sm"
            variant="ghost"
            className="text-primary"
            onClick={(e) => {
              e.stopPropagation();
              router.push(`/supply-chains/${po.id}`);
            }}
          >
            View
          </Button>
        ),
      },
    ],
    [suppliersById, productsById, router]
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Sourcing</h1>
          <p className="text-sm text-muted-foreground">Purchase orders and the lots fulfilling them</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          New purchase order
        </Button>
      </div>

      <CoverageLegend />

      <DataTable<BatchReadiness>
        queryKey="batches-readiness"
        endpoint="/api/v1/supply-chain/batches/readiness/"
        columns={columns}
        extraParams={extraParams}
        toolbarExtra={
          <select
            aria-label="Filter by stage"
            value={stageFilter}
            onChange={(e) => setStageFilter(e.target.value)}
            className="h-9 cursor-pointer appearance-none rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
          >
            {STAGE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        }
        searchPlaceholder="Search by PO reference…"
        exportable
        exportFilename="sourcing"
        rowKey={(po) => po.id}
        onRowClick={(po) => router.push(`/supply-chains/${po.id}`)}
        emptyIcon={<ClipboardList className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No purchase orders yet"
        emptyDescription="Purchase orders arrive automatically from your connected ERP (see Integrations), or create one manually"
        emptyAction={<EmptyStateActions onNew={() => setFormOpen(true)} />}
      />

      <PurchaseOrderForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

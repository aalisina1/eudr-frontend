"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/api/client";
import { formatNumber } from "@/lib/format";
import { UNIT_LABELS } from "@/lib/readiness-format";
import type { PlotLineage, PlotLineageLot } from "@/lib/api/types";

/**
 * "Used by" — the chain from a plot outward (eudr-frontend#134).
 *
 * plot → lot → purchase order, and lot → shipment, with the statement that
 * covers the lot cutting across. Every hop the backend resolved is a link;
 * every absent hop is a plain marker, never a link to nowhere. A lot has no
 * page of its own — it lives on its order's page — so the lot reference
 * links there.
 *
 * Vocabulary on this card is the product's, not the model's: a *lot* fulfils
 * a *purchase order* and travels on a *shipment*. Both lot and order are
 * `Batch` rows underneath (ADR-0013); that word stays off the screen.
 */

async function fetchLineage(plotId: string): Promise<PlotLineage> {
  const res = await authFetch(`/api/v1/geolocation/plots/${encodeURIComponent(plotId)}/lineage/`);
  if (!res.ok) throw new Error("Could not load what uses this plot.");
  return res.json();
}

function Hop({ href, label, absent }: { href: string | null; label: string; absent: string }) {
  if (!href) return <span className="text-muted-foreground">{absent}</span>;
  return (
    <Link href={href} className="font-mono text-primary hover:underline">
      {label}
    </Link>
  );
}

function LotRow({ lot }: { lot: PlotLineageLot }) {
  const poHref = lot.po_id ? `/sourcing/${lot.po_id}` : null;
  const unit = UNIT_LABELS[lot.unit] ?? lot.unit.toLowerCase();
  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_1fr] items-center gap-3 rounded-lg border border-border/60 px-3 py-2.5 text-sm">
      <div className="min-w-0">
        {poHref ? (
          <Link href={`${poHref}#lots`} className="font-mono font-medium text-primary hover:underline">
            {lot.reference_number}
          </Link>
        ) : (
          <span className="font-mono font-medium">{lot.reference_number}</span>
        )}
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {formatNumber(Math.round(Number(lot.quantity)))} {unit}
        </span>
      </div>
      <Hop href={poHref} label={lot.po_reference} absent="No order" />
      <Hop
        href={lot.consignment_id ? `/shipments/${lot.consignment_id}` : null}
        label={lot.consignment_reference}
        absent="Not shipped"
      />
      <Hop
        href={lot.covering_dds_id ? `/submissions/${lot.covering_dds_id}` : null}
        label={lot.covering_dds_reference}
        absent="Not filed"
      />
    </div>
  );
}

export function PlotLineageCard({ plotId }: { plotId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["plot-lineage", plotId],
    queryFn: () => fetchLineage(plotId),
    enabled: !!plotId,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="size-4 text-muted-foreground" /> Used by
        </CardTitle>
        <CardDescription>
          The lots that carry this plot, the orders they fulfil, the shipments they travel on, and the
          statements that cover them.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading && (
          <>
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </>
        )}
        {error && (
          <p className="text-sm text-destructive">
            Could not load what uses this plot. Reload the page; if it keeps failing the server is unreachable.
          </p>
        )}
        {data && data.lots.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No lot uses this plot yet. It joins the chain when a lot that carries it is ingested or assigned.
          </p>
        )}
        {data && data.lots.length > 0 && (
          <>
            <div className="grid grid-cols-[1fr_1fr_1fr_1fr] gap-3 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <span>Lot</span>
              <span>Purchase order</span>
              <span>Shipment</span>
              <span>Statement</span>
            </div>
            {data.lots.map((lot) => (
              <LotRow key={lot.id} lot={lot} />
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

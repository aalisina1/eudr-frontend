"use client";

import { use, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Pencil, Trash2, Link2 } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { BatchForm } from "@/components/forms/batch-form";
import type { Batch, BatchStatus } from "@/lib/api/types";

const STATUS_STYLE: Record<BatchStatus, { bg: string; text: string; dot: string; label: string }> = {
  DRAFT: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Draft" },
  CONFIRMED: { bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", dot: "bg-[#34D399]", label: "Confirmed" },
  IN_DDS: { bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", label: "In DDS" },
};

const UNIT_LABELS: Record<string, string> = {
  KG: "kg",
  TONNES: "t",
  M3: "m\u00B3",
  PIECES: "pcs",
};

export default function BatchDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: batch, isLoading, error } = useQuery<Batch>({
    queryKey: ["batch", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/batches/${id}/`);
      if (!res.ok) throw new Error("Failed to fetch batch");
      return res.json();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/batches/${id}/`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      router.push("/supply-chains");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-4xl">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="space-y-4 max-w-4xl">
        <Button variant="ghost" size="sm" onClick={() => router.push("/supply-chains")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          Batch not found or failed to load.
        </div>
      </div>
    );
  }

  const ss = STATUS_STYLE[batch.status] ?? STATUS_STYLE.DRAFT;

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/supply-chains")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Batches
        </Button>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
            <Pencil className="size-3.5" /> Edit
          </Button>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5"
            disabled={deleteMutation.isPending}
            onClick={() => { if (confirm("Delete this batch?")) deleteMutation.mutate(); }}
          >
            <Trash2 className="size-3.5" /> Delete
          </Button>
        </div>
      </div>

      {/* Header Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#C7956D]/10 flex items-center justify-center">
              <Link2 className="size-5 text-[#C7956D]" />
            </div>
            <div>
              <h1 className="text-xl font-medium font-mono">{batch.reference_number}</h1>
              <p className="text-sm text-muted-foreground">
                {batch.quantity} {UNIT_LABELS[batch.unit] ?? batch.unit} from {batch.country_of_harvest || "Unknown"}
              </p>
            </div>
          </div>
          <Badge variant="secondary" className={`${ss.bg} ${ss.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
            <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
            {ss.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Transaction Date</p>
            <p className="text-xs">{batch.transaction_date ? new Date(batch.transaction_date).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Seller ID</p>
            <p className="text-xs font-mono truncate">{batch.seller_id || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Commodity ID</p>
            <p className="text-xs font-mono truncate">{batch.commodity_id || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">External ID</p>
            <p className="text-xs font-mono">{batch.external_id || "—"}</p>
          </div>
        </div>
      </div>

      {/* Land Plots */}
      {batch.land_plot_ids && batch.land_plot_ids.length > 0 && (
        <div>
          <h2 className="text-sm font-medium mb-3">Linked Land Plots ({batch.land_plot_ids.length})</h2>
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <div className="flex flex-wrap gap-2">
              {batch.land_plot_ids.map((plotId) => (
                <Button
                  key={plotId}
                  variant="secondary"
                  size="sm"
                  className="font-mono text-xs"
                  onClick={() => router.push(`/plots/${plotId}`)}
                >
                  {plotId.slice(-8)}
                </Button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chain Links */}
      {((batch.parent_links && batch.parent_links.length > 0) || (batch.child_links && batch.child_links.length > 0)) && (
        <div>
          <h2 className="text-sm font-medium mb-3">Chain Links</h2>
          <div className="rounded-2xl border border-border/50 bg-card p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3">
            {batch.parent_links?.map((link) => (
              <div key={link.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Parent:</span>
                <Button variant="ghost" size="sm" className="font-mono text-xs" onClick={() => router.push(`/supply-chains/${link.child_batch}`)}>
                  {link.child_batch.slice(-8)}
                </Button>
                <span className="text-xs text-muted-foreground">{(link.volume_ratio * 100).toFixed(1)}%</span>
              </div>
            ))}
            {batch.child_links?.map((link) => (
              <div key={link.id} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Child:</span>
                <Button variant="ghost" size="sm" className="font-mono text-xs" onClick={() => router.push(`/supply-chains/${link.child_batch}`)}>
                  {link.child_batch.slice(-8)}
                </Button>
                <span className="text-xs text-muted-foreground">{(link.volume_ratio * 100).toFixed(1)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timestamps */}
      <div className="text-xs text-muted-foreground flex gap-4">
        <span>Created: {new Date(batch.created_at).toLocaleDateString()}</span>
        <span>Updated: {new Date(batch.updated_at).toLocaleDateString()}</span>
      </div>

      <BatchForm open={editOpen} onOpenChange={setEditOpen} batch={batch} />
    </div>
  );
}

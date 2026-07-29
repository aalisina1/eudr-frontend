"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { plotIdentity } from "@/lib/plot-identity";
import type { Batch, LandPlot, PaginatedResponse } from "@/lib/api/types";

interface AssignPlotsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The lot (Batch) plots are being assigned to. */
  lotId: string;
  /** Optional hint shown while the authoritative fetch below is in flight —
   * neither dead-end site (consignment-lots-table, readiness-checklist-card)
   * has this on hand today (`land_plot_ids` is BatchSerializer-only, absent
   * from both ConsignmentLot and LotReadiness), so the Sheet always confirms
   * against a fresh `GET .../batches/{lotId}/` before Save is enabled — this
   * is never the sole source of truth. */
  currentPlotIds?: string[];
  onSaved?: () => void;
}

/** Assign land plots to a lot (issue #78 — every "Complete plots"/"Review
 * plots" CTA used to dead-end on the `/plots` list with no way back). Mirrors
 * `AssignLotsSheet`'s Sheet + search + authFetch + invalidate shape, but the
 * backend contract here is a WHOLE-ARRAY REPLACE (`BatchSerializer.
 * land_plot_ids`), not an add/remove delta — so this is a single searchable
 * multi-select with each row's checked state driving the exact array PATCHed
 * on Save (deselecting every plot clears the lot's plots entirely). */
export function AssignPlotsSheet({ open, onOpenChange, lotId, currentPlotIds, onSaved }: AssignPlotsSheetProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  // Tracks whether `selectedIds` has been seeded from the authoritative fetch
  // for the CURRENT open — reset to false on close so reopening (even for
  // the same lot) always re-syncs rather than replaying stale local edits.
  const syncedRef = useRef(false);

  const {
    data: batch,
    isLoading: batchLoading,
    error: batchError,
  } = useQuery<Batch>({
    queryKey: ["batch", lotId],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/batches/${encodeURIComponent(lotId)}/`);
      if (!res.ok) throw new Error("Failed to load the lot");
      return res.json();
    },
    enabled: open && !!lotId,
  });

  const { data: plotsPage } = useQuery<PaginatedResponse<LandPlot>>({
    queryKey: ["plot-picker", search],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/geolocation/plots/?page_size=100${search ? `&search=${encodeURIComponent(search)}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to load plots");
      return res.json();
    },
    enabled: open,
  });

  useEffect(() => {
    if (!open) {
      syncedRef.current = false;
      return;
    }
    if (syncedRef.current) return;
    if (batch) {
      // One-time sync of the authoritative fetch into locally-editable
      // selection state — intentional; `syncedRef` guards against a later
      // background refetch clobbering the user's in-progress edits.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIds(new Set(batch.land_plot_ids));
      syncedRef.current = true;
    } else if (currentPlotIds) {
      // Optimistic pre-check while the authoritative fetch is in flight —
      // superseded (and `syncedRef` only latched) once `batch` resolves.
      setSelectedIds(new Set(currentPlotIds));
    }
  }, [open, batch, currentPlotIds]);

  const plots = plotsPage?.results ?? [];

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/batches/${encodeURIComponent(lotId)}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ land_plot_ids: Array.from(selectedIds) }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batch", lotId] });
      queryClient.invalidateQueries({ queryKey: ["consignment"] });
      queryClient.invalidateQueries({ queryKey: ["consignment-ledger"] });
      queryClient.invalidateQueries({ queryKey: ["po-readiness"] });
      onSaved?.();
      onOpenChange(false);
    },
  });

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Assign plots</SheetTitle>
          <SheetDescription>
            Pick the land plots that cover this lot. Saving replaces the lot&apos;s full plot list.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="plot-search">Land plots</Label>
            <Input
              id="plot-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search plots by country, region, or reference…"
            />
          </div>
          {batchError && (
            <p className="text-xs text-destructive">Failed to load this lot&apos;s current plots.</p>
          )}
          {batchLoading && !batchError && (
            <p className="text-xs text-muted-foreground">Loading current plots…</p>
          )}
          <div className="max-h-72 space-y-1.5 overflow-y-auto">
            {plots.map((p) => {
              const { primary, secondary } = plotIdentity(p);
              return (
                <label
                  key={p.id}
                  htmlFor={`plot-${p.id}`}
                  className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2 text-[13px] transition-colors has-data-checked:border-primary has-data-checked:bg-primary/5"
                >
                  <Checkbox
                    id={`plot-${p.id}`}
                    checked={selectedIds.has(p.id)}
                    onCheckedChange={() => toggle(p.id)}
                  />
                  <span className="flex-1 min-w-0">
                    <span className="block font-mono">{primary}</span>
                    {secondary && (
                      <span className="block truncate text-xs text-muted-foreground">
                        {secondary}
                      </span>
                    )}
                  </span>
                  <Badge variant={p.validation_status === "FAILED" ? "destructive" : "outline"}>
                    {p.validation_status}
                  </Badge>
                </label>
              );
            })}
            {plotsPage && plots.length === 0 && (
              <p className="px-1 text-xs text-muted-foreground">No plots match.</p>
            )}
          </div>
          {mutation.error && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
        </div>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !batch}
          >
            {mutation.isPending ? "Saving…" : "Save"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

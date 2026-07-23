"use client";

import { useState } from "react";
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
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { Batch, ConsignmentLot, PaginatedResponse } from "@/lib/api/types";

interface AssignLotsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  consignmentId: string;
  /** Lots currently on this consignment — offered as removable chips
   * (labelled by reference, never raw UUIDs). */
  currentLots: ConsignmentLot[];
  onSaved?: () => void;
}

/** Assign/unassign lots on a consignment (spec Decision 8 · POST
 * /consignments/<id>/lots/ {add,remove}). Add side = searchable picker over
 * the org's batches (shipments.md: "multi-select of the org's unassigned (or
 * other-consignment) lots") — a lot already on another consignment shows a
 * "moves from <ref>" hint and is MOVED on assign (the backend repoints the
 * FK). Org validation is server-side (foreign UUID → 400, never a silent
 * link); the Sheet surfaces that error rather than re-implementing it. */
export function AssignLotsSheet({ open, onOpenChange, consignmentId, currentLots, onSaved }: AssignLotsSheetProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [addIds, setAddIds] = useState<Set<string>>(new Set());
  const [removeIds, setRemoveIds] = useState<Set<string>>(new Set());

  const currentIds = new Set(currentLots.map((l) => l.id));

  const { data: candidates } = useQuery<PaginatedResponse<Batch>>({
    queryKey: ["lot-picker", search],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/supply-chain/batches/?limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to load lots");
      return res.json();
    },
    enabled: open,
  });

  const options = (candidates?.results ?? []).filter((b) => !currentIds.has(b.id));

  const mutation = useMutation({
    mutationFn: async () => {
      const body = { add: Array.from(addIds), remove: Array.from(removeIds) };
      const res = await authFetch(`/api/v1/supply-chain/consignments/${consignmentId}/lots/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["consignment", consignmentId] });
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      onSaved?.();
      onOpenChange(false);
      setAddIds(new Set());
      setRemoveIds(new Set());
      setSearch("");
    },
  });

  function toggle(ids: Set<string>, setIds: (s: Set<string>) => void, id: string) {
    const next = new Set(ids);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setIds(next);
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Assign or unassign lots</SheetTitle>
          <SheetDescription>Pick lots to add, or unselect assigned lots to remove them.</SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="space-y-2">
            <Label htmlFor="lot-search">Add lots</Label>
            <Input
              id="lot-search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search lots by reference…"
            />
            <div className="max-h-48 space-y-1 overflow-y-auto">
              {options.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => toggle(addIds, setAddIds, b.id)}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] transition-colors ${
                    addIds.has(b.id) ? "border-primary bg-primary/5" : "border-border/60"
                  }`}
                >
                  <span className="font-mono">{b.reference_number}</span>
                  {b.shipment_reference && (
                    <span className="text-xs text-muted-foreground">moves from {b.shipment_reference}</span>
                  )}
                </button>
              ))}
              {candidates && options.length === 0 && (
                <p className="px-1 text-xs text-muted-foreground">No lots match.</p>
              )}
            </div>
          </div>
          {currentLots.length > 0 && (
            <div className="space-y-1.5">
              <Label>Currently assigned (unselect to remove)</Label>
              <div className="flex flex-wrap gap-1.5">
                {currentLots.map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => toggle(removeIds, setRemoveIds, l.id)}
                    className={`rounded-full border px-2.5 py-0.5 font-mono text-[11.5px] transition-colors ${
                      removeIds.has(l.id)
                        ? "border-destructive/40 bg-destructive/10 text-destructive line-through"
                        : "border-border text-muted-foreground"
                    }`}
                  >
                    {l.reference_number}
                  </button>
                ))}
              </div>
            </div>
          )}
          {mutation.error && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
        </div>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || (!addIds.size && !removeIds.size)}
          >
            {mutation.isPending ? "Saving…" : "Apply"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

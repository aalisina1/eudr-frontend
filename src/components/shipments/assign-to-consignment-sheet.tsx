"use client";

import { useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
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
import { cn } from "@/lib/utils";
import type { ConsignmentRow, PaginatedResponse } from "@/lib/api/types";

const newConsignmentSchema = z.object({
  reference: z.string().min(1, "Reference is required"),
  expected_clearance_date: z.string().optional(),
});
type NewConsignmentValues = z.infer<typeof newConsignmentSchema>;

interface AssignToConsignmentSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotIds: string[];
  onSaved?: () => void;
}

async function assignLots(consignmentId: string, lotIds: string[]) {
  const res = await authFetch(`/api/v1/supply-chain/consignments/${consignmentId}/lots/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ add: lotIds }),
  });
  if (!res.ok) throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
  return res.json();
}

/** Manual-management journey (shipments.md): from the PO lots table's
 * unassigned bucket, attach lots to an existing consignment (search) or a new
 * one — the two-minute path for spreadsheet-native orgs. Both-sides org
 * validation is server-side (foreign UUID → 400). */
export function AssignToConsignmentSheet({ open, onOpenChange, lotIds, onSaved }: AssignToConsignmentSheetProps) {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState("");

  const {
    register,
    handleSubmit,
    reset: resetNewForm,
    formState: { errors },
  } = useForm<NewConsignmentValues>({
    resolver: zodResolver(newConsignmentSchema),
    defaultValues: { reference: "", expected_clearance_date: "" },
  });

  // Create-then-attach retry safety: (org, reference) is unique server-side.
  // If the create POST succeeds but the attach POST fails, a naive retry
  // would re-run the create and 400 ("already exists"). Stash the id here so
  // a retry reuses the consignment it already made instead of re-creating it.
  const createdRef = useRef<{ reference: string; id: string } | null>(null);

  const { data: options } = useQuery<PaginatedResponse<ConsignmentRow>>({
    queryKey: ["shipments-picker", search],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/supply-chain/consignments/?limit=20${search ? `&search=${encodeURIComponent(search)}` : ""}`
      );
      if (!res.ok) throw new Error("Failed to load consignments");
      return res.json();
    },
    enabled: open && mode === "existing",
  });

  const mutation = useMutation({
    mutationFn: async (newValues?: NewConsignmentValues) => {
      let consignmentId = selectedId;
      if (mode === "new") {
        const reference = newValues!.reference.trim();
        if (createdRef.current?.reference === reference) {
          // Retry after a failed attach: the consignment already exists from
          // the prior attempt — reuse it instead of re-POSTing the create
          // (which would 400 on the unique (org, reference) constraint).
          consignmentId = createdRef.current.id;
        } else {
          const res = await authFetch("/api/v1/supply-chain/consignments/", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              reference,
              expected_clearance_date: newValues!.expected_clearance_date || null,
            }),
          });
          if (!res.ok) throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
          const created = await res.json();
          consignmentId = created.id;
          createdRef.current = { reference, id: created.id };
        }
      }
      return assignLots(consignmentId, lotIds);
    },
    onSuccess: () => {
      createdRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["po-readiness"] });
      onSaved?.();
      onOpenChange(false);
      setMode("existing");
      setSelectedId("");
      setSearch("");
      resetNewForm();
    },
  });

  const canApply =
    lotIds.length > 0 && !mutation.isPending && (mode !== "existing" || !!selectedId);

  const handleApply = () => {
    if (mode === "new") {
      handleSubmit((values) => mutation.mutate(values))();
    } else {
      mutation.mutate(undefined);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Assign to consignment</SheetTitle>
          <SheetDescription>
            Attach {lotIds.length} lot{lotIds.length === 1 ? "" : "s"} to an existing consignment, or create one.
          </SheetDescription>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4">
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "existing" ? "default" : "outline"}
              aria-pressed={mode === "existing"}
              onClick={() => setMode("existing")}
            >
              Existing
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "new" ? "default" : "outline"}
              aria-pressed={mode === "new"}
              onClick={() => setMode("new")}
            >
              New
            </Button>
          </div>
          {mode === "existing" ? (
            <div className="space-y-2">
              <Label htmlFor="c-search">Search by reference</Label>
              <Input id="c-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="BL / booking #" />
              <div className="max-h-56 space-y-1 overflow-y-auto">
                {(options?.results ?? []).map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={selectedId === c.id}
                    onClick={() => setSelectedId(c.id)}
                    className={cn(
                      "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-[13px] transition-colors",
                      selectedId === c.id ? "border-primary bg-primary/5" : "border-border/60"
                    )}
                  >
                    <span className="font-mono">{c.reference}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.total_count} lot{c.total_count === 1 ? "" : "s"}
                    </span>
                  </button>
                ))}
                {options && options.results.length === 0 && (
                  <p className="px-1 text-xs text-muted-foreground">No consignments match.</p>
                )}
              </div>
            </div>
          ) : (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="new-ref">Reference *</Label>
                <Input id="new-ref" {...register("reference")} placeholder="e.g. BL-2026-4471" />
                {errors.reference && <p className="text-xs text-destructive">{errors.reference.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="new-date">Expected clearance date</Label>
                <Input id="new-date" type="date" {...register("expected_clearance_date")} />
              </div>
            </>
          )}
          {mutation.error && <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>}
        </div>
        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleApply} disabled={!canApply}>
            {mutation.isPending ? "Assigning…" : "Assign"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

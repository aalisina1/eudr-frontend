"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { Batch, BatchUnit } from "@/lib/api/types";

/**
 * Edit the fields on a lot that the readiness blockers can name
 * (eudr-frontend#132): harvest period, quantity and unit, country of harvest.
 *
 * Deliberately narrow. A lot's supplier and product come from its purchase
 * order and are not editable here; its plots are, but through the
 * `AssignPlotsSheet` that already exists — the parent owns both sheets and
 * this one raises `onAssignPlots` rather than growing a second plot picker.
 *
 * Same ownership shape as `AssignPlotsSheet`: the parent page holds `open`
 * and the target `lotId`, this fetches the lot, PATCHes it, and invalidates
 * `po-readiness` so the blocker row disappears without a reload.
 */

const UNITS: BatchUnit[] = ["KG", "TONNES", "M3", "PIECES"];

const schema = z
  .object({
    harvest_period_start: z.string(),
    harvest_period_end: z.string(),
    quantity: z.number().positive("Quantity must be a positive number."),
    unit: z.enum(["KG", "TONNES", "M3", "PIECES"]),
    country_of_harvest: z
      .string()
      .trim()
      .regex(/^[A-Za-z]{2,3}$/, "Use the two-letter ISO country code, e.g. GH."),
  })
  // Mirrors BatchSerializer.validate() so the officer learns this without a
  // round trip. The serializer still enforces it; this is the fast path.
  .refine(
    (v) => !v.harvest_period_start || !v.harvest_period_end || v.harvest_period_end >= v.harvest_period_start,
    { message: "Harvest end must be on or after the start.", path: ["harvest_period_end"] }
  );

type Values = z.infer<typeof schema>;

interface EditLotSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lotId: string;
  /** Hand-off to the plot picker the parent already owns. */
  onAssignPlots: (lotId: string) => void;
  onSaved?: () => void;
}

export function EditLotSheet({ open, onOpenChange, lotId, onAssignPlots, onSaved }: EditLotSheetProps) {
  const queryClient = useQueryClient();
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: lot, isLoading, error: loadError } = useQuery<Batch>({
    queryKey: ["batch", lotId],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/batches/${encodeURIComponent(lotId)}/`);
      if (!res.ok) throw new Error("Could not load this lot.");
      return res.json();
    },
    enabled: open && !!lotId,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: { harvest_period_start: "", harvest_period_end: "", quantity: 0, unit: "KG", country_of_harvest: "" },
  });

  // Prefill once the lot arrives (and again if the sheet is reopened on a
  // different lot). `reset` rather than `defaultValues` so react-hook-form
  // treats the loaded values as the clean state.
  useEffect(() => {
    if (!lot) return;
    reset({
      harvest_period_start: lot.harvest_period_start ?? "",
      harvest_period_end: lot.harvest_period_end ?? "",
      quantity: Number(lot.quantity),
      unit: lot.unit,
      country_of_harvest: lot.country_of_harvest ?? "",
    });
  }, [lot, reset]);

  const mutation = useMutation({
    onMutate: () => setServerError(null),
    mutationFn: async (values: Values) => {
      const res = await authFetch(`/api/v1/supply-chain/batches/${encodeURIComponent(lotId)}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          harvest_period_start: values.harvest_period_start || null,
          harvest_period_end: values.harvest_period_end || null,
          quantity: values.quantity,
          unit: values.unit,
          country_of_harvest: values.country_of_harvest.toUpperCase(),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body));
      }
      return res.json() as Promise<Batch>;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["batch", lotId] });
      queryClient.invalidateQueries({ queryKey: ["po-readiness"] });
      queryClient.invalidateQueries({ queryKey: ["consignment"] });
      queryClient.invalidateQueries({ queryKey: ["consignment-ledger"] });
      toast.success(`${saved.reference_number} updated`, {
        description: "Readiness recomputes from the saved lot.",
      });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (err) => setServerError(getErrorMessage(err)),
  });

  const plotCount = lot?.land_plot_ids?.length ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit lot{lot ? ` ${lot.reference_number}` : ""}</SheetTitle>
          <SheetDescription>
            The fields a readiness blocker can name. Saving recomputes readiness for the order.
          </SheetDescription>
        </SheetHeader>

        {isLoading && (
          <div className="space-y-3 px-4">
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-full" />
            <Skeleton className="h-9 w-2/3" />
          </div>
        )}

        {loadError && (
          <p className="px-4 text-sm text-destructive">{getErrorMessage(loadError)}</p>
        )}

        {lot && (
          <form onSubmit={handleSubmit((v) => mutation.mutate(v))} className="flex flex-col gap-5 px-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="harvest_period_start">Harvest start</Label>
                <Input id="harvest_period_start" type="date" {...register("harvest_period_start")} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="harvest_period_end">Harvest end</Label>
                <Input id="harvest_period_end" type="date" {...register("harvest_period_end")} />
                {errors.harvest_period_end && (
                  <p className="text-xs text-destructive">{errors.harvest_period_end.message}</p>
                )}
              </div>
            </div>
            <p className="-mt-3 text-xs text-muted-foreground">
              A single-day harvest is the same date twice. Leave both empty only if the period is genuinely unknown.
            </p>

            <div className="grid grid-cols-[1fr_auto] gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="quantity">Quantity</Label>
                <Input id="quantity" type="number" step="0.0001" min="0" {...register("quantity", { valueAsNumber: true })} />
                {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="unit">Unit</Label>
                <select
                  id="unit"
                  {...register("unit")}
                  className="h-9 rounded-lg border border-border/60 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {UNITS.map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="country_of_harvest">Country of harvest</Label>
              <Input id="country_of_harvest" maxLength={3} placeholder="GH" {...register("country_of_harvest")} />
              {errors.country_of_harvest && (
                <p className="text-xs text-destructive">{errors.country_of_harvest.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 px-3 py-2.5">
              <span className="flex items-center gap-2 text-sm">
                <MapPin className="size-4 text-muted-foreground" />
                {plotCount} {plotCount === 1 ? "plot" : "plots"} assigned
              </span>
              <Button type="button" size="sm" variant="ghost" className="text-primary" onClick={() => onAssignPlots(lotId)}>
                Change plots
              </Button>
            </div>

            {serverError && (
              <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </p>
            )}

            <SheetFooter className="px-0">
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting || mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

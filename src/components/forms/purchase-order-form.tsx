"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { useCurrentUser } from "@/hooks/use-current-user";
import type { PaginatedResponse, Product, Supplier } from "@/lib/api/types";

const SELECT_CLASSNAME =
  "w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition-colors";

const purchaseOrderSchema = z.object({
  reference_number: z.string().min(1, "Enter a PO reference"),
  seller_id: z.string().uuid("Choose a supplier"),
  commodity_id: z.string().uuid("Choose a commodity"),
  quantity: z.number().positive("Enter a quantity in tonnes"),
  transaction_date: z.string().min(1, "Enter an order date"),
});

type PurchaseOrderFormValues = z.infer<typeof purchaseOrderSchema>;

interface PurchaseOrderFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function defaultValues(): PurchaseOrderFormValues {
  return {
    reference_number: "",
    seller_id: "",
    commodity_id: "",
    quantity: 0,
    transaction_date: new Date().toISOString().split("T")[0],
  };
}

/**
 * "New purchase order" — Sourcing list, sourcing-readiness.design-prompt.md
 * Prompt A / Round 3. Creates a `supply_chain.Batch` with no lots yet (reads
 * back as readiness stage OPEN — eudr-app PR #83). No plot picker here by
 * design: land plots are captured per lot once the order is allocated.
 */
export function PurchaseOrderForm({ open, onOpenChange }: PurchaseOrderFormProps) {
  const queryClient = useQueryClient();
  const { data: me } = useCurrentUser();

  // Pilot-scale pickers — one page of each (page_size capped at the
  // backend's max of 100), matching the same "bounded, not paginated"
  // assumption eudr-app PR #83 makes for its own aggregate endpoint.
  const { data: suppliers } = useQuery({
    queryKey: ["suppliers", "picker"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/suppliers/?page_size=100");
      if (!res.ok) throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
      const body: PaginatedResponse<Supplier> = await res.json();
      return body.results;
    },
    staleTime: 60_000,
    enabled: open,
  });

  const { data: products } = useQuery({
    queryKey: ["products", "picker"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/commodities/products/?page_size=100");
      if (!res.ok) throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
      const body: PaginatedResponse<Product> = await res.json();
      return body.results;
    },
    staleTime: 60_000,
    enabled: open,
  });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<PurchaseOrderFormValues>({
    resolver: zodResolver(purchaseOrderSchema),
    defaultValues: defaultValues(),
  });

  useEffect(() => {
    if (open) reset(defaultValues());
  }, [open, reset]);

  const mutation = useMutation({
    mutationFn: async (values: PurchaseOrderFormValues) => {
      const supplier = suppliers?.find((s) => s.id === values.seller_id);
      const res = await authFetch("/api/v1/supply-chain/batches/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reference_number: values.reference_number,
          seller_id: values.seller_id,
          // The buyer is always the operator's own organisation — there is
          // no separate "trading party" identity in the schema yet.
          buyer_id: me?.organization_id,
          commodity_id: values.commodity_id,
          quantity: values.quantity,
          // TONNES is a real `Batch.Unit` choice (not a KG conversion) —
          // matches the design's "Ordered quantity (t)" label exactly.
          unit: "TONNES",
          transaction_date: values.transaction_date,
          // Batch.country_of_harvest is required and not exposed as a field
          // here per the design (harvest data belongs to lots, captured
          // once the order is allocated) — derived from the chosen
          // supplier's declared country as the best available default.
          country_of_harvest: supplier?.country_of_origin ?? "",
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return res.json();
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["batches-readiness"] });
      toast.success("Purchase order created", {
        description: `${created.reference_number} added as Open — assign lots to start building coverage.`,
      });
      reset(defaultValues());
      onOpenChange(false);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="font-display text-[22px] italic font-light">New purchase order</SheetTitle>
          <SheetDescription>
            Record an order with an origin supplier. It starts Open — coverage builds as lots are assigned.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2"
        >
          <div className="space-y-1.5">
            <Label htmlFor="po-reference_number">PO reference *</Label>
            <Input id="po-reference_number" className="font-mono" placeholder="e.g. PO-2026-0159" {...register("reference_number")} />
            {errors.reference_number && <p className="text-xs text-destructive">{errors.reference_number.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-seller_id">Supplier *</Label>
            <select id="po-seller_id" className={SELECT_CLASSNAME} {...register("seller_id")}>
              <option value="">Select supplier</option>
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.country_of_origin})
                </option>
              ))}
            </select>
            {errors.seller_id && <p className="text-xs text-destructive">{errors.seller_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-commodity_id">Commodity *</Label>
            <select id="po-commodity_id" className={SELECT_CLASSNAME} {...register("commodity_id")}>
              <option value="">Select commodity</option>
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.commodity_name ? `${p.commodity_name} — ` : ""}
                  {p.description || p.internal_product_code}
                </option>
              ))}
            </select>
            {errors.commodity_id && <p className="text-xs text-destructive">{errors.commodity_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-quantity">Ordered quantity (t) *</Label>
            <Input
              id="po-quantity"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 350"
              {...register("quantity", { valueAsNumber: true })}
            />
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="po-transaction_date">Order date</Label>
            <Input id="po-transaction_date" type="date" {...register("transaction_date")} />
            {errors.transaction_date && <p className="text-xs text-destructive">{errors.transaction_date.message}</p>}
          </div>

          <p className="text-[12.5px] leading-relaxed text-muted-foreground">
            No plots are picked here — land plots are captured per lot once the order is allocated.
          </p>

          {mutation.isError && <p className="text-xs text-destructive">{getErrorMessage(mutation.error)}</p>}

          <SheetFooter className="flex-row justify-end gap-2 px-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Creating…" : "Create purchase order"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { Batch } from "@/lib/api/types";

const batchSchema = z.object({
  reference_number: z.string().min(1, "Reference number is required"),
  seller_id: z.string().uuid("Select a valid supplier"),
  product_id: z.string().uuid("Select a valid commodity"),
  quantity: z.number().positive("Quantity must be positive"),
  unit: z.enum(["KG", "TONNES", "M3", "PIECES"]),
  transaction_date: z.string().min(1, "Transaction date is required"),
  country_of_harvest: z.string().min(2, "Country code is required"),
  status: z.enum(["DRAFT", "CONFIRMED", "IN_DDS"]),
  external_id: z.string().optional(),
});

type BatchFormValues = z.infer<typeof batchSchema>;

interface BatchFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  batch?: Batch | null;
}

export function BatchForm({ open, onOpenChange, batch }: BatchFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!batch;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<BatchFormValues>({
    resolver: zodResolver(batchSchema),
    defaultValues: batch
      ? {
          reference_number: batch.reference_number,
          seller_id: batch.seller_id,
          product_id: batch.product_id,
          quantity: batch.quantity,
          unit: batch.unit,
          transaction_date: batch.transaction_date,
          country_of_harvest: batch.country_of_harvest,
          status: batch.status,
          external_id: batch.external_id || "",
        }
      : {
          reference_number: "",
          seller_id: "",
          product_id: "",
          quantity: 0,
          unit: "KG",
          transaction_date: new Date().toISOString().split("T")[0],
          country_of_harvest: "",
          status: "DRAFT",
          external_id: "",
        },
  });

  const mutation = useMutation({
    mutationFn: async (values: BatchFormValues) => {
      const url = isEditing
        ? `/api/v1/supply-chain/batches/${batch.id}/`
        : "/api/v1/supply-chain/batches/";
      const res = await authFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Failed to save batch");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["batches"] });
      onOpenChange(false);
      reset();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Batch" : "New Batch"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update batch details." : "Create a new supply chain batch."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 flex-1 overflow-y-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="reference_number">Reference Number *</Label>
            <Input id="reference_number" {...register("reference_number")} placeholder="e.g. BATCH-001" />
            {errors.reference_number && <p className="text-xs text-destructive">{errors.reference_number.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="seller_id">Supplier ID *</Label>
            <Input id="seller_id" {...register("seller_id")} placeholder="Supplier UUID" />
            {errors.seller_id && <p className="text-xs text-destructive">{errors.seller_id.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="product_id">Commodity ID *</Label>
            <Input id="product_id" {...register("product_id")} placeholder="Commodity UUID" />
            {errors.product_id && <p className="text-xs text-destructive">{errors.product_id.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="quantity">Quantity *</Label>
              <Input id="quantity" type="number" step="0.01" {...register("quantity", { valueAsNumber: true })} />
              {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="unit">Unit</Label>
              <select
                id="unit"
                {...register("unit")}
                className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
              >
                <option value="KG">Kilograms (kg)</option>
                <option value="TONNES">Tonnes (t)</option>
                <option value="M3">Cubic Metres (m³)</option>
                <option value="PIECES">Pieces</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="transaction_date">Transaction Date *</Label>
            <Input id="transaction_date" type="date" {...register("transaction_date")} />
            {errors.transaction_date && <p className="text-xs text-destructive">{errors.transaction_date.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country_of_harvest">Country of Harvest (ISO code) *</Label>
            <Input id="country_of_harvest" {...register("country_of_harvest")} placeholder="e.g. GH" maxLength={3} />
            {errors.country_of_harvest && <p className="text-xs text-destructive">{errors.country_of_harvest.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="status">Status</Label>
            <select
              id="status"
              {...register("status")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="DRAFT">Draft</option>
              <option value="CONFIRMED">Confirmed</option>
              <option value="IN_DDS">In DDS</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="external_id">External ID</Label>
            <Input id="external_id" {...register("external_id")} placeholder="Optional reference" />
          </div>

          {mutation.error && (
            <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}

          <SheetFooter className="px-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEditing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

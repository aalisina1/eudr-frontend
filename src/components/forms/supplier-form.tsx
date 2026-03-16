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
import type { Supplier } from "@/lib/api/types";

const supplierSchema = z.object({
  name: z.string().min(1, "Name is required"),
  country_of_origin: z.string().min(2, "Country code is required (e.g. GH, BR)"),
  kyc_status: z.enum(["PENDING", "VERIFIED", "REJECTED", "EXPIRED"]),
  risk_rating: z.enum(["LOW", "STANDARD", "HIGH"]),
  external_id: z.string().optional(),
});

type SupplierFormValues = z.infer<typeof supplierSchema>;

interface SupplierFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  supplier?: Supplier | null;
}

export function SupplierForm({ open, onOpenChange, supplier }: SupplierFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!supplier;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<SupplierFormValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: supplier
      ? {
          name: supplier.name,
          country_of_origin: supplier.country_of_origin,
          kyc_status: supplier.kyc_status,
          risk_rating: supplier.risk_rating,
          external_id: supplier.external_id || "",
        }
      : {
          name: "",
          country_of_origin: "",
          kyc_status: "PENDING",
          risk_rating: "STANDARD",
          external_id: "",
        },
  });

  const mutation = useMutation({
    mutationFn: async (values: SupplierFormValues) => {
      const url = isEditing
        ? `/api/v1/suppliers/${supplier.id}/`
        : "/api/v1/suppliers/";
      const res = await authFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save supplier");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      onOpenChange(false);
      reset();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Supplier" : "Add Supplier"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update supplier details." : "Register a new supply chain partner."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 flex-1 overflow-y-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="name">Name *</Label>
            <Input id="name" {...register("name")} placeholder="e.g. Mensah Cocoa Farm" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="country_of_origin">Country (ISO code) *</Label>
            <Input id="country_of_origin" {...register("country_of_origin")} placeholder="e.g. GH" maxLength={3} />
            {errors.country_of_origin && (
              <p className="text-xs text-destructive">{errors.country_of_origin.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="kyc_status">KYC Status</Label>
            <select
              id="kyc_status"
              {...register("kyc_status")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="PENDING">Pending</option>
              <option value="VERIFIED">Verified</option>
              <option value="REJECTED">Rejected</option>
              <option value="EXPIRED">Expired</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="risk_rating">Risk Rating</Label>
            <select
              id="risk_rating"
              {...register("risk_rating")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="LOW">Low</option>
              <option value="STANDARD">Standard</option>
              <option value="HIGH">High</option>
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

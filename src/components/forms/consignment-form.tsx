"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { ConsignmentDetail, ConsignmentRow } from "@/lib/api/types";

const schema = z.object({
  reference: z.string().min(1, "Reference is required"),
  expected_clearance_date: z.string().optional(),
  tracking_number: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

/** POST/PATCH return the base Consignment shape — the readiness headline
 * (rag/counts/countdown) is list/detail-only, so don't promise it. */
export type SavedConsignment = Partial<ConsignmentRow> & { id: string; reference: string };

interface ConsignmentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Present → PATCH edit; absent → POST create. */
  consignment?: ConsignmentRow | ConsignmentDetail | null;
  onSaved?: (c: SavedConsignment) => void;
}

export function ConsignmentForm({ open, onOpenChange, consignment, onSaved }: ConsignmentFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!consignment;

  const { register, handleSubmit, reset, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      reference: consignment?.reference ?? "",
      expected_clearance_date: consignment?.expected_clearance_date ?? "",
      tracking_number: consignment?.tracking_number ?? "",
    },
  });

  // Re-seed when the target changes (Sheet is mounted once, reused per row).
  useEffect(() => {
    reset({
      reference: consignment?.reference ?? "",
      expected_clearance_date: consignment?.expected_clearance_date ?? "",
      tracking_number: consignment?.tracking_number ?? "",
    });
  }, [consignment, reset]);

  const mutation = useMutation({
    mutationFn: async (values: FormValues) => {
      // Only the three editable fields; empty strings for the optional dates/
      // tracking# become null (clear), matching the PATCH contract.
      const body = {
        reference: values.reference,
        expected_clearance_date: values.expected_clearance_date || null,
        tracking_number: values.tracking_number || null,
      };
      const url = isEditing
        ? `/api/v1/supply-chain/consignments/${consignment!.id}/`
        : "/api/v1/supply-chain/consignments/";
      const res = await authFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return res.json() as Promise<SavedConsignment>;
    },
    onSuccess: (saved) => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      if (isEditing) queryClient.invalidateQueries({ queryKey: ["consignment", consignment!.id] });
      onSaved?.(saved);
      onOpenChange(false);
      reset();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit consignment" : "New consignment"}</SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update the reference, clearance date, or tracking number."
              : "Create a consignment to track its DDS coverage and clearance date."}
          </SheetDescription>
        </SheetHeader>
        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-1 flex-col gap-4 overflow-y-auto px-4"
        >
          <div className="space-y-1.5">
            <Label htmlFor="reference">Reference *</Label>
            <Input id="reference" {...register("reference")} placeholder="e.g. BL-2026-4471" />
            {errors.reference && <p className="text-xs text-destructive">{errors.reference.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="expected_clearance_date">Expected clearance date</Label>
            <Input id="expected_clearance_date" type="date" {...register("expected_clearance_date")} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tracking_number">Tracking number</Label>
            <Input id="tracking_number" {...register("tracking_number")} placeholder="Container # or B/L" />
          </div>
          {mutation.error && (
            <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}
          <SheetFooter className="px-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEditing ? "Save" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

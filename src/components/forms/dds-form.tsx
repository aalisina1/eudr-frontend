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
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/client";
import type { DueDiligenceStatement } from "@/lib/api/types";

const ddsSchema = z.object({
  statement_type: z.enum(["OPERATOR", "REFERENCE"]),
  // "" is meaningful: no activity chosen. TRACES requires one, and
  // `_validate_activity_type` refuses a blank at submit — but refusing it
  // *here* would block saving a draft the officer has not finished.
  activity_type: z.enum(["", "DOMESTIC", "IMPORT", "EXPORT"]),
  reference_number: z.string().optional(),
  risk_conclusion: z.enum(["NEGLIGIBLE", "NOT_NEGLIGIBLE"]).nullable().optional(),
  conclusion_justification: z.string().optional(),
  valid_until: z.string().optional(),
});

type DDSFormValues = z.infer<typeof ddsSchema>;

interface DDSFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Required. This sheet edits an existing statement; it does not create
   * one. Creation runs through the composer, from a purchase order and its
   * lots — the only path that produces something TRACES will accept, since
   * `commodities` is mandatory in the XSD. Making this non-optional is what
   * stops the lotless create path being reintroduced by accident (#104). */
  statement: DueDiligenceStatement;
}

export function DDSForm({ open, onOpenChange, statement }: DDSFormProps) {
  const queryClient = useQueryClient();

  const canEdit = !statement || statement.status === "DRAFT" || statement.status === "REJECTED";

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DDSFormValues>({
    resolver: zodResolver(ddsSchema),
    defaultValues: {
          statement_type: statement.statement_type,
          activity_type: statement.activity_type,
          reference_number: statement.reference_number || "",
          risk_conclusion: statement.risk_conclusion,
          conclusion_justification: statement.conclusion_justification || "",
          valid_until: statement.valid_until?.split("T")[0] || "",
        },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["due-diligence"] });

  const saveMutation = useMutation({
    mutationFn: async (values: DDSFormValues) => {
      const res = await authFetch(`/api/v1/due-diligence/statements/${statement.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Failed to save statement");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
      reset();
    },
  });

  const actionMutation = useMutation({
    mutationFn: async (action: string) => {
      const res = await authFetch(
        `/api/v1/due-diligence/statements/${statement!.id}/${action}/`,
        { method: "POST" },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `Failed to ${action}`);
      }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/due-diligence/statements/${statement!.id}/`,
        { method: "DELETE" },
      );
      if (!res.ok && res.status !== 204) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to delete statement");
      }
    },
    onSuccess: () => {
      invalidate();
      onOpenChange(false);
    },
  });

  const isPending = saveMutation.isPending || actionMutation.isPending || deleteMutation.isPending;
  const error = saveMutation.error || actionMutation.error || deleteMutation.error;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {`Statement ${statement.reference_number}`}
          </SheetTitle>
          <SheetDescription>
            {`Status: ${statement.status.replace("_", " ")}`}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => saveMutation.mutate(v))}
          className="flex flex-col gap-4 px-4 flex-1 overflow-y-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="statement_type">Statement Type *</Label>
            <select
              id="statement_type"
              {...register("statement_type")}
              disabled={!canEdit}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
            >
              <option value="OPERATOR">Operator</option>
              <option value="REFERENCE">Reference</option>
            </select>
          </div>

          {/* The composer (#101) gated this; this sheet did not, and it is
              reachable from the Submissions header *and* the composer's own
              escape hatch. Without it the backend seeds `activity_type` from
              the organisation default in `save()` — supplying a regulated
              value on behalf of the person signing for it, server-side where
              nobody can see it. Prefilled the same way the composer prefills,
              and overridable for the same reason: activityType describes the
              transaction, not the operator. */}
          <div className="space-y-1.5">
            <Label htmlFor="activity_type">Commercial activity</Label>
            <select
              id="activity_type"
              {...register("activity_type")}
              disabled={!canEdit}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
            >
              <option value="">Choose an activity…</option>
              <option value="DOMESTIC">Domestic — placing on the EU market</option>
              <option value="IMPORT">Import — release for free circulation</option>
              <option value="EXPORT">Export — leaving the EU</option>
            </select>
            <p className="text-[11px] text-muted-foreground">
              What this statement declares. TRACES requires one before it can be
              filed.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>Reference Number</Label>
            <Input value={statement.reference_number} disabled className="opacity-50" />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="risk_conclusion">Risk Conclusion</Label>
            <select
              id="risk_conclusion"
              {...register("risk_conclusion")}
              disabled={!canEdit}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 disabled:opacity-50"
            >
              <option value="">Not yet assessed</option>
              <option value="NEGLIGIBLE">Negligible</option>
              <option value="NOT_NEGLIGIBLE">Not Negligible</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="conclusion_justification">Justification</Label>
            <Textarea
              id="conclusion_justification"
              {...register("conclusion_justification")}
              disabled={!canEdit}
              placeholder="Describe the basis for your risk conclusion…"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="valid_until">Valid Until</Label>
            <Input id="valid_until" type="date" {...register("valid_until")} disabled={!canEdit} />
          </div>

          {error && (
            <p className="text-xs text-destructive">{(error as Error).message}</p>
          )}

          {/* Action buttons based on status */}
          <SheetFooter className="px-0 flex-col gap-2">
            {canEdit && (
              <div className="flex gap-2 w-full">
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending} className="flex-1">
                  {saveMutation.isPending ? "Saving…" : "Update"}
                </Button>
              </div>
            )}

            <div className="flex flex-wrap gap-2 w-full border-t pt-3 border-border/50">
                {(statement.status === "DRAFT" || statement.status === "REJECTED") && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => actionMutation.mutate("submit-for-review")}
                  >
                    Submit for Review
                  </Button>
                )}
                {statement.status === "UNDER_REVIEW" && (
                  <>
                    <Button
                      type="button"
                      size="sm"
                      disabled={isPending}
                      onClick={() => actionMutation.mutate("approve")}
                      className="bg-[#34D399] hover:bg-[#2CB889] text-white"
                    >
                      Approve
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={() => actionMutation.mutate("reject")}
                    >
                      Reject
                    </Button>
                  </>
                )}
                {statement.status === "SUBMITTED" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => actionMutation.mutate("withdraw")}
                  >
                    Withdraw
                  </Button>
                )}
                {statement.status === "DRAFT" && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => {
                      if (confirm("Delete this draft statement?")) {
                        deleteMutation.mutate();
                      }
                    }}
                  >
                    Delete
                  </Button>
                )}
            </div>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

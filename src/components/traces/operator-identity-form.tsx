"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import type { Organization } from "@/lib/api/types";
import { ACTIVITY_TYPE_OPTIONS, ACTIVITY_TYPE_UNSET_LABEL } from "@/lib/activity-type";

const operatorIdentitySchema = z.object({
  eori_number: z
    .string()
    .max(17, "EORI number must be at most 17 characters")
    .optional(),
  // "" is meaningful: no default, so the composer asks per statement.
  default_activity_type: z.enum(["", "DOMESTIC", "IMPORT", "EXPORT"]),
});

type OperatorIdentityFormValues = z.infer<typeof operatorIdentitySchema>;

interface OperatorIdentityFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  organization: Organization;
}

export function OperatorIdentityForm({
  open,
  onOpenChange,
  organization,
}: OperatorIdentityFormProps) {
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<OperatorIdentityFormValues>({
    resolver: zodResolver(operatorIdentitySchema),
    defaultValues: {
      eori_number: organization.eori_number ?? "",
      default_activity_type: organization.default_activity_type ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: OperatorIdentityFormValues) => {
      const res = await authFetch("/api/v1/accounts/organization/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eori_number: values.eori_number ?? "",
          default_activity_type: values.default_activity_type,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return res.json() as Promise<Organization>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["organization"] });
      toast.success("Operator identity updated");
      onOpenChange(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Edit operator identity</SheetTitle>
          <SheetDescription>
            The EORI number used to identify your organisation as an operator
            in Due Diligence Statements submitted to TRACES.
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 flex-1 overflow-y-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="eori_number">Operator EORI</Label>
            <Input
              id="eori_number"
              {...register("eori_number")}
              placeholder="e.g. NL857702430"
              className="font-mono"
              autoComplete="off"
            />
            {errors.eori_number && (
              <p className="text-xs text-destructive">{errors.eori_number.message}</p>
            )}
            <p className="text-xs text-muted-foreground">
              EU Economic Operators Registration and Identification number.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="default_activity_type">Usual activity</Label>
            <select
              id="default_activity_type"
              {...register("default_activity_type")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="">{ACTIVITY_TYPE_UNSET_LABEL}</option>
              {ACTIVITY_TYPE_OPTIONS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              Prefills the commercial activity on each new statement. TRACES
              requires one, and it can still be changed per statement.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>TRACES Actor ID</Label>
            <p className="text-xs text-muted-foreground">
              {organization.traces_actor_id || "Not yet assigned"}, assigned by
              TRACES after your first successful submission; not editable here.
            </p>
          </div>

          {mutation.error && (
            <p className="text-xs text-destructive">
              {(mutation.error as Error).message}
            </p>
          )}

          <SheetFooter className="px-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

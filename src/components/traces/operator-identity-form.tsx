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

const operatorIdentitySchema = z.object({
  eori_number: z
    .string()
    .max(17, "EORI number must be at most 17 characters")
    .optional(),
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
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: OperatorIdentityFormValues) => {
      const res = await authFetch("/api/v1/accounts/organization/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eori_number: values.eori_number ?? "" }),
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
          <SheetTitle>Edit Operator Identity</SheetTitle>
          <SheetDescription>
            The EORI number used to identify your organization as an operator
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
            <p className="text-[11px] text-muted-foreground">
              EU Economic Operators Registration and Identification number.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label>TRACES Actor ID</Label>
            <p className="text-xs text-muted-foreground">
              {organization.traces_actor_id || "Not yet assigned"} — assigned by
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

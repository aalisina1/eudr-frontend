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
import type { TracesCredential } from "@/lib/api/types";

const credentialSchema = z.object({
  environment: z.enum(["ACCEPTANCE", "PRODUCTION"]),
  username: z.string().min(1, "Username is required"),
  // Password is write-only: required on create, optional on edit (empty = keep existing)
  password: z.string().optional(),
  web_service_client_id: z.string().min(1, "Web service client ID is required"),
});

type CredentialFormValues = z.infer<typeof credentialSchema>;

interface CredentialsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Provide to switch to edit mode. Password is NEVER pre-filled. */
  credential?: TracesCredential | null;
}

export function CredentialsForm({
  open,
  onOpenChange,
  credential,
}: CredentialsFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!credential;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CredentialFormValues>({
    resolver: zodResolver(credentialSchema),
    defaultValues: {
      environment: (credential?.environment ?? "ACCEPTANCE") as "ACCEPTANCE" | "PRODUCTION",
      username: credential?.username ?? "",
      // Password is intentionally blank — write-only, never rendered back
      password: "",
      web_service_client_id: credential?.web_service_client_id ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: CredentialFormValues) => {
      const url = isEditing
        ? `/api/v1/traces/credentials/${credential.id}/`
        : "/api/v1/traces/credentials/";

      // In edit mode, omit password entirely when the field is left blank
      const body: Record<string, string> = {
        environment: values.environment,
        username: values.username,
        web_service_client_id: values.web_service_client_id,
      };
      if (!isEditing || (values.password && values.password.length > 0)) {
        body.password = values.password ?? "";
      }

      const res = await authFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          (err as { detail?: string }).detail || "Failed to save TRACES credentials",
        );
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traces-credentials"] });
      onOpenChange(false);
      reset();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>
            {isEditing ? "Edit TRACES Credentials" : "Add TRACES Credentials"}
          </SheetTitle>
          <SheetDescription>
            {isEditing
              ? "Update credentials for this TRACES environment. Leave password blank to keep the existing secret."
              : "Configure credentials to authenticate against the TRACES web service."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 flex-1 overflow-y-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="environment">Environment *</Label>
            <select
              id="environment"
              {...register("environment")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="ACCEPTANCE">Acceptance (testing)</option>
              <option value="PRODUCTION">Production</option>
            </select>
            {errors.environment && (
              <p className="text-xs text-destructive">{errors.environment.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="username">Username *</Label>
            <Input
              id="username"
              {...register("username")}
              placeholder="e.g. eu_operator_login"
              autoComplete="off"
            />
            {errors.username && (
              <p className="text-xs text-destructive">{errors.username.message}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password">
              Password {isEditing ? "(leave blank to keep existing)" : "*"}
            </Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder={isEditing ? "Leave blank to keep existing" : "Enter password"}
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Write-only — this value is never displayed after saving.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="web_service_client_id">Web Service Client ID *</Label>
            <Input
              id="web_service_client_id"
              {...register("web_service_client_id")}
              placeholder="e.g. ws_client_12345"
              autoComplete="off"
            />
            {errors.web_service_client_id && (
              <p className="text-xs text-destructive">
                {errors.web_service_client_id.message}
              </p>
            )}
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
              {mutation.isPending
                ? "Saving…"
                : isEditing
                  ? "Update"
                  : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

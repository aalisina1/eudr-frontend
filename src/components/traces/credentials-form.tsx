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
import type { TracesCredential } from "@/lib/api/types";

const credentialSchema = z.object({
  environment: z.enum(["ACCEPTANCE", "PRODUCTION"]),
  username: z.string().min(1, "Username is required"),
  // Password is write-only: required on create, optional on edit (empty = keep existing)
  password: z.string().optional(),
  web_service_client_id: z.string().min(1, "Web service client ID is required"),
  // "" is a real, meaningful value: fall back to the deployment-wide default.
  operator_role: z.enum(["", "OPERATOR", "REPRESENTATIVE_OPERATOR"]),
  // `OperatorAccessIdentifierType` is maxLength 16, validated rather than
  // clamped with the input's own `maxLength`. A pasted 20-character value
  // silently cut to 16 is still a well-formed identifier — for a different
  // operator — and nothing downstream would say so. Better to refuse and
  // explain than to quietly change what the person entered.
  operator_ws_identifier: z
    .string()
    // Trimmed BEFORE the length check, and the submit trims too. An
    // identifier pasted from the TRACES UI routinely arrives with a trailing
    // space or newline, and validating the raw string rejected a perfectly
    // valid 16-character value for characters that were never going to be
    // sent — the same class of invisible-whitespace failure the auth key's
    // own handling documents.
    .trim()
    .max(16, "TRACES web service identifiers are at most 16 characters"),
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
      operator_role: credential?.operator_role ?? "",
      operator_ws_identifier: credential?.operator_ws_identifier ?? "",
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
        operator_role: values.operator_role,
        operator_ws_identifier: values.operator_ws_identifier.trim(),
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
        throw new Error(getErrorMessage(err));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traces-credentials"] });
      toast.success(isEditing ? "Credentials updated" : "Credentials added");
      onOpenChange(false);
      reset();
    },
    onError: (err) => toast.error(getErrorMessage(err)),
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
              Authentication Key {isEditing ? "(leave blank to keep existing)" : "*"}
            </Label>
            <Input
              id="password"
              type="password"
              {...register("password")}
              placeholder={
                isEditing ? "Leave blank to keep existing" : "Enter authentication key"
              }
              autoComplete="new-password"
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
            <p className="text-[11px] text-muted-foreground">
              The web-service Authentication Key from TRACES, not your TRACES
              account password. Write-only: never displayed after saving.
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

          <div className="space-y-1.5">
            <Label htmlFor="operator_role">EUDR role</Label>
            <select
              id="operator_role"
              {...register("operator_role")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="">Use deployment default</option>
              <option value="OPERATOR">Operator</option>
              <option value="REPRESENTATIVE_OPERATOR">
                Representative operator
              </option>
            </select>
            {errors.operator_role && (
              <p className="text-xs text-destructive">
                {errors.operator_role.message}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Must match how this web-service user is registered in TRACES.
              Claiming a role the account does not hold is rejected with
              &ldquo;user activity not allowed&rdquo;.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="operator_ws_identifier">Web Service Identifier</Label>
            <Input
              id="operator_ws_identifier"
              {...register("operator_ws_identifier")}
              placeholder="e.g. OPWS-0042"
              autoComplete="off"
            />
            {errors.operator_ws_identifier && (
              <p className="text-xs text-destructive">
                {errors.operator_ws_identifier.message}
              </p>
            )}
            <p className="text-[11px] text-muted-foreground">
              Your operator&rsquo;s Web Service Identifier, shown on your
              operator registration in TRACES. It tells TRACES which operator a
              submission is filed for. Without it a filing carries no
              operator identity, which TRACES rejects with &ldquo;operator EORI
              for activity missing&rdquo;. This is not the Web Service Client
              ID above: that identifies the software, this identifies you.
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

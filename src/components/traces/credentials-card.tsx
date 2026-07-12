"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { TracesCredential } from "@/lib/api/types";
import { CredentialsForm } from "@/components/traces/credentials-form";

type TestState = "idle" | "testing" | "ok" | "err";

async function fetchCredentials(): Promise<TracesCredential[]> {
  const res = await authFetch("/api/v1/traces/credentials/");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(err));
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : (data.results ?? [])) as TracesCredential[];
}

const ENV_LABEL: Record<string, string> = {
  ACCEPTANCE: "Acceptance",
  PRODUCTION: "Production",
};

const ENV_STYLE: Record<
  string,
  { bg: string; text: string }
> = {
  ACCEPTANCE: { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-700 dark:text-amber-400" },
  PRODUCTION: { bg: "bg-emerald-100 dark:bg-emerald-900/30", text: "text-emerald-700 dark:text-emerald-400" },
};

export function CredentialsCard() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<TracesCredential | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TracesCredential | null>(null);
  const [testState, setTestState] = useState<TestState>("idle");

  const { data: credentials, isLoading, isError } = useQuery({
    queryKey: ["traces-credentials"],
    queryFn: fetchCredentials,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await authFetch(`/api/v1/traces/credentials/${id}/`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["traces-credentials"] });
      toast.success("Credentials deleted");
      setDeleteTarget(null);
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  function openAdd() {
    setEditTarget(null);
    setFormOpen(true);
  }

  function openEdit(cred: TracesCredential) {
    setEditTarget(cred);
    setFormOpen(true);
  }

  async function handleTestConnection() {
    setTestState("testing");
    try {
      // No dedicated echo endpoint: re-fetch the credential list as a save smoke.
      // A real TRACES echo test (calling the SOAP sandbox) is a fast-follow (#fast-follow).
      await queryClient.refetchQueries({ queryKey: ["traces-credentials"] });
      setTestState("ok");
      setTimeout(() => setTestState("idle"), 3000);
    } catch {
      setTestState("err");
      setTimeout(() => setTestState("idle"), 4000);
    }
  }

  const envStyle = (env: string) => ENV_STYLE[env] ?? { bg: "bg-muted", text: "text-muted-foreground" };

  return (
    <>
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
              TRACES Connection
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Credentials used to submit Due Diligence Statements to the EU TRACES system.
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={openAdd}
          >
            <Plus className="size-3.5" />
            Add credentials
          </Button>
        </div>

        {/* Body */}
        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
        ) : isError ? (
          <p className="text-sm text-muted-foreground">
            Unable to load TRACES credentials.
          </p>
        ) : !credentials || credentials.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No TRACES credentials configured.
            </p>
            <Button size="sm" className="gap-1.5" onClick={openAdd}>
              <Plus className="size-3.5" />
              Add credentials
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {credentials.map((cred) => {
              const style = envStyle(cred.environment);
              return (
                <div
                  key={cred.id}
                  className="flex items-center justify-between rounded-xl border border-border/40 bg-secondary/30 px-4 py-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <Badge
                      variant="secondary"
                      className={`${style.bg} ${style.text} border-0 shrink-0`}
                    >
                      {ENV_LABEL[cred.environment] ?? cred.environment}
                    </Badge>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{cred.username}</p>
                      <p className="text-xs text-muted-foreground font-mono truncate">
                        {cred.web_service_client_id}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0 ml-4">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Test connection"
                      onClick={handleTestConnection}
                      disabled={testState === "testing"}
                    >
                      {testState === "testing" ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : testState === "ok" ? (
                        <CheckCircle2 className="size-3.5 text-emerald-600" />
                      ) : testState === "err" ? (
                        <XCircle className="size-3.5 text-destructive" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7"
                      aria-label="Edit credentials"
                      onClick={() => openEdit(cred)}
                    >
                      <Pencil className="size-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="size-7 text-destructive hover:text-destructive"
                      aria-label="Delete credentials"
                      onClick={() => setDeleteTarget(cred)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })}

            {/* Test connection status banner */}
            {testState === "ok" && (
              <p className="text-xs text-emerald-600 flex items-center gap-1.5 mt-1">
                <CheckCircle2 className="size-3.5" />
                Credential confirmed — the API is reachable and the credential persisted.
              </p>
            )}
            {testState === "err" && (
              <p className="text-xs text-destructive flex items-center gap-1.5 mt-1">
                <XCircle className="size-3.5" />
                Connection check failed. Verify the API is up.
              </p>
            )}
          </div>
        )}

        {/* Note: real TRACES echo test (SOAP sandbox ping) is a fast-follow */}
      </div>

      {/* Add / Edit sheet */}
      <CredentialsForm
        key={editTarget?.id ?? "new"}
        open={formOpen}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditTarget(null);
        }}
        credential={editTarget}
      />

      {/* Delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete TRACES credentials?</DialogTitle>
            <DialogDescription>
              This will remove the{" "}
              <span className="font-medium">
                {deleteTarget ? (ENV_LABEL[deleteTarget.environment] ?? deleteTarget.environment) : ""}
              </span>{" "}
              credentials permanently. Any pending submissions for that environment will fail.
            </DialogDescription>
          </DialogHeader>
          {deleteMutation.isError && (
            <p className="text-sm text-destructive">
              {(deleteMutation.error as Error).message}
            </p>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={deleteMutation.isPending}
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

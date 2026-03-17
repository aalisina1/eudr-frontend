"use client";

import { useEffect } from "react";
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
import type { DataSource, SourceType } from "@/lib/api/types";

const SOURCE_TYPES: { value: SourceType; label: string }[] = [
  { value: "SQL_SERVER", label: "SQL Server" },
  { value: "CSV_UPLOAD", label: "CSV / XLSX Upload" },
  { value: "FARMFORCE", label: "FarmForce" },
  { value: "AS400", label: "AS400 ERP" },
  { value: "REST_API", label: "REST API" },
  { value: "SFTP", label: "SFTP" },
  { value: "WEBHOOK", label: "Incoming Webhook" },
];

const sourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  source_type: z.string().min(1, "Source type is required"),
  // SQL Server connection fields
  host: z.string().optional(),
  port: z.number().optional(),
  database: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  schema_filter: z.string().optional(),
  // REST API fields
  base_url: z.string().optional(),
  api_key: z.string().optional(),
  // SFTP fields
  sftp_host: z.string().optional(),
  sftp_port: z.number().optional(),
  sftp_username: z.string().optional(),
  sftp_password: z.string().optional(),
  remote_path: z.string().optional(),
});

type SourceFormValues = z.infer<typeof sourceSchema>;

interface SourceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When provided, the form enters edit mode (PATCH instead of POST). */
  source?: DataSource | null;
}

function buildConnectionConfig(values: SourceFormValues): Record<string, unknown> {
  switch (values.source_type) {
    case "SQL_SERVER":
      return {
        host: values.host || "",
        port: values.port || 1433,
        database: values.database || "",
        username: values.username || "",
        password: values.password || "",
        schema_filter: values.schema_filter || "",
      };
    case "REST_API":
      return {
        base_url: values.base_url || "",
        api_key: values.api_key || "",
      };
    case "SFTP":
      return {
        host: values.sftp_host || "",
        port: values.sftp_port || 22,
        username: values.sftp_username || "",
        password: values.sftp_password || "",
        remote_path: values.remote_path || "",
      };
    default:
      return {};
  }
}

export function SourceForm({ open, onOpenChange, source }: SourceFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!source;

  function getDefaults(src?: DataSource | null): SourceFormValues {
    const cfg = (src?.connection_config ?? {}) as Record<string, unknown>;
    return {
      name: src?.name ?? "",
      source_type: src?.source_type ?? "SQL_SERVER",
      host: (cfg.host as string) ?? "",
      port: (cfg.port as number) ?? 1433,
      database: (cfg.database as string) ?? "",
      username: (cfg.username as string) ?? "",
      password: (cfg.password as string) ?? "",
      schema_filter: (cfg.schema_filter as string) ?? "dbo",
      base_url: (cfg.base_url as string) ?? "",
      api_key: (cfg.api_key as string) ?? "",
      sftp_host: (cfg.host as string) ?? "",
      sftp_port: (cfg.port as number) ?? 22,
      sftp_username: (cfg.username as string) ?? "",
      sftp_password: (cfg.password as string) ?? "",
      remote_path: (cfg.remote_path as string) ?? "",
    };
  }

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors },
  } = useForm<SourceFormValues>({
    resolver: zodResolver(sourceSchema),
    defaultValues: getDefaults(source),
  });

  const sourceType = watch("source_type");

  const mutation = useMutation({
    mutationFn: async (values: SourceFormValues) => {
      const url = isEditing
        ? `/api/v1/data-integration/sources/${source!.id}/`
        : "/api/v1/data-integration/sources/";
      const res = await authFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.name,
          source_type: values.source_type,
          connection_config: buildConnectionConfig(values),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || (isEditing ? "Failed to update source" : "Failed to create source"));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integration-sources"] });
      if (isEditing) {
        queryClient.invalidateQueries({ queryKey: ["source", source!.id] });
      }
      reset();
      onOpenChange(false);
    },
  });

  useEffect(() => {
    if (open) {
      reset(getDefaults(source));
    } else {
      reset(getDefaults(null));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, source, reset]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Integration Source" : "New Integration Source"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update the connection configuration." : "Configure a connection to an external data source."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="space-y-5 px-6 py-4 flex-1 overflow-y-auto"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Source Name</Label>
            <Input
              id="name"
              placeholder="e.g. Warehouse SQL Server"
              {...register("name")}
            />
            {errors.name && (
              <p className="text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          {/* Source Type */}
          <div className="space-y-1.5">
            <Label htmlFor="source_type">Source Type</Label>
            <select
              id="source_type"
              {...register("source_type")}
              className="w-full rounded-lg border px-3 py-2 text-sm bg-background"
            >
              {SOURCE_TYPES.map((st) => (
                <option key={st.value} value={st.value}>
                  {st.label}
                </option>
              ))}
            </select>
          </div>

          {/* SQL Server Fields */}
          {sourceType === "SQL_SERVER" && (
            <div className="space-y-4 rounded-xl border border-border/50 p-4">
              <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
                SQL Server Connection
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    placeholder="my-server.database.windows.net"
                    {...register("host")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    placeholder="1433"
                    {...register("port")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="database">Database</Label>
                  <Input
                    id="database"
                    placeholder="SupplyChainDB"
                    {...register("database")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    placeholder="reader"
                    {...register("username")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    {...register("password")}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="schema_filter">
                    Schema Filter{" "}
                    <span className="text-muted-foreground font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    id="schema_filter"
                    placeholder="dbo"
                    {...register("schema_filter")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* REST API Fields */}
          {sourceType === "REST_API" && (
            <div className="space-y-4 rounded-xl border border-border/50 p-4">
              <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
                REST API Connection
              </p>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="base_url">Base URL</Label>
                  <Input
                    id="base_url"
                    placeholder="https://api.example.com/v1"
                    {...register("base_url")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="api_key">API Key</Label>
                  <Input
                    id="api_key"
                    type="password"
                    placeholder="••••••••"
                    {...register("api_key")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* SFTP Fields */}
          {sourceType === "SFTP" && (
            <div className="space-y-4 rounded-xl border border-border/50 p-4">
              <p className="text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
                SFTP Connection
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="sftp_host">Host</Label>
                  <Input
                    id="sftp_host"
                    placeholder="sftp.example.com"
                    {...register("sftp_host")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sftp_port">Port</Label>
                  <Input
                    id="sftp_port"
                    type="number"
                    placeholder="22"
                    {...register("sftp_port")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sftp_username">Username</Label>
                  <Input
                    id="sftp_username"
                    placeholder="upload_user"
                    {...register("sftp_username")}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="sftp_password">Password</Label>
                  <Input
                    id="sftp_password"
                    type="password"
                    placeholder="••••••••"
                    {...register("sftp_password")}
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label htmlFor="remote_path">Remote Path</Label>
                  <Input
                    id="remote_path"
                    placeholder="/data/exports/"
                    {...register("remote_path")}
                  />
                </div>
              </div>
            </div>
          )}

          {/* CSV / Webhook / FarmForce / AS400 — no config needed upfront */}
          {["CSV_UPLOAD", "WEBHOOK", "FARMFORCE", "AS400"].includes(
            sourceType
          ) && (
            <div className="rounded-xl border border-dashed border-border/50 p-4">
              <p className="text-xs text-muted-foreground text-center">
                {sourceType === "CSV_UPLOAD"
                  ? "CSV files can be uploaded after creating the source."
                  : sourceType === "WEBHOOK"
                    ? "A webhook URL will be generated after creation."
                    : "Additional configuration can be set after creation."}
              </p>
            </div>
          )}

          {mutation.isError && (
            <p className="text-sm text-red-600">
              {(mutation.error as Error).message}
            </p>
          )}

          <SheetFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending
                ? (isEditing ? "Saving..." : "Creating...")
                : (isEditing ? "Save Changes" : "Create Source")}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

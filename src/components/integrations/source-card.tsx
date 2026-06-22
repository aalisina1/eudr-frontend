"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Database,
  FileSpreadsheet,
  Globe,
  Server,
  Upload,
  Webhook,
  ArrowRight,
  Play,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type {
  DataSource,
  IngestJob,
  PaginatedResponse,
  SourceType,
} from "@/lib/api/types";

const SOURCE_TYPE_META: Record<
  SourceType,
  { label: string; icon: typeof Database; color: string }
> = {
  SQL_SERVER: { label: "SQL Server", icon: Database, color: "#3b82f6" },
  CSV_UPLOAD: { label: "CSV Upload", icon: FileSpreadsheet, color: "#34D399" },
  FARMFORCE: { label: "FarmForce", icon: Globe, color: "#f59e0b" },
  AS400: { label: "AS400 ERP", icon: Server, color: "#8b5cf6" },
  REST_API: { label: "REST API", icon: Globe, color: "#06b6d4" },
  SFTP: { label: "SFTP", icon: Upload, color: "#C7956D" },
  WEBHOOK: { label: "Webhook", icon: Webhook, color: "#ec4899" },
};

const CONNECTION_STATUS_META: Record<
  string,
  { label: string; dot: string; bg: string; text: string }
> = {
  CONNECTED: {
    label: "Connected",
    dot: "bg-[#34D399]",
    bg: "bg-[#34D399]/10",
    text: "text-[#1A6B5A]",
  },
  UNTESTED: {
    label: "Untested",
    dot: "bg-muted-foreground/40",
    bg: "bg-muted",
    text: "text-muted-foreground",
  },
  FAILED: {
    label: "Failed",
    dot: "bg-[#C23D3D]",
    bg: "bg-[#C23D3D]/10",
    text: "text-[#C23D3D]",
  },
};

const RUN_STATUS_META: Record<
  IngestJob["status"],
  { label: string; icon: typeof Play; cls: string }
> = {
  RUNNING: {
    label: "Running",
    icon: RefreshCw,
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400",
  },
  COMPLETED: {
    label: "Completed",
    icon: CheckCircle2,
    cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400",
  },
  FAILED: {
    label: "Failed",
    icon: XCircle,
    cls: "bg-[#C23D3D]/10 text-[#C23D3D]",
  },
};

export function SourceCard({
  source,
  onNavigate,
}: {
  source: DataSource;
  onNavigate: (id: string) => void;
}) {
  const queryClient = useQueryClient();

  const { data: latestJob } = useQuery({
    queryKey: ["source-latest-job", source.id],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/jobs/?source=${source.id}&ordering=-started_at&limit=1`,
      );
      if (!res.ok) {
        throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
      }
      const data = (await res.json()) as PaginatedResponse<IngestJob>;
      return data.results[0] ?? null;
    },
    // Poll while a run is in flight so the badge updates without a page refresh.
    refetchInterval: (query) =>
      query.state.data?.status === "RUNNING" ? 3000 : false,
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${source.id}/ingest/`,
        { method: "POST" },
      );
      if (!res.ok) {
        throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["source-latest-job", source.id],
      });
      queryClient.invalidateQueries({ queryKey: ["source-jobs", source.id] });
      toast.success("Ingestion started");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const typeMeta = SOURCE_TYPE_META[source.source_type] ?? {
    label: source.source_type,
    icon: Database,
    color: "#94a3b8",
  };
  const statusMeta =
    CONNECTION_STATUS_META[source.connection_status] ??
    CONNECTION_STATUS_META.UNTESTED;
  const Icon = typeMeta.icon;

  const runMeta = latestJob ? RUN_STATUS_META[latestJob.status] : null;
  const RunIcon = runMeta?.icon;
  const isRunning =
    latestJob?.status === "RUNNING" || runMutation.isPending;

  return (
    <Card
      className="group relative overflow-hidden border-border/50 bg-card hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5 cursor-pointer"
      onClick={() => onNavigate(source.id)}
    >
      {/* Accent bar */}
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(to right, ${typeMeta.color}, transparent)`,
        }}
      />

      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{
              backgroundColor: `${typeMeta.color}12`,
              color: typeMeta.color,
            }}
          >
            <Icon className="size-[18px]" />
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              aria-label="Run now"
              disabled={isRunning}
              onClick={(e) => {
                e.stopPropagation();
                runMutation.mutate();
              }}
              className="h-7 gap-1.5 text-xs"
            >
              {isRunning ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              Run now
            </Button>
            <ArrowRight className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-0.5" />
          </div>
        </div>

        <p className="text-sm font-medium mb-1 truncate">{source.name}</p>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Badge
            variant="secondary"
            className="border-0 rounded-lg font-medium text-[10px] px-2 py-0.5 bg-muted text-muted-foreground"
          >
            {typeMeta.label}
          </Badge>
          <Badge
            variant="secondary"
            className={`border-0 rounded-lg font-medium text-[10px] px-2 py-0.5 gap-1.5 ${statusMeta.bg} ${statusMeta.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
            {statusMeta.label}
          </Badge>
          {runMeta && RunIcon && (
            <Badge
              variant="secondary"
              className={`border-0 rounded-lg font-medium text-[10px] px-2 py-0.5 gap-1 ${runMeta.cls}`}
            >
              <RunIcon
                className={`size-3 ${
                  latestJob?.status === "RUNNING" ? "animate-spin" : ""
                }`}
              />
              {runMeta.label}
            </Badge>
          )}
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
          <span>
            {(source.schema_count ?? 0) > 0
              ? `${source.schema_count} object${source.schema_count !== 1 ? "s" : ""}`
              : "No objects"}
          </span>
          <span>{new Date(source.created_at).toLocaleDateString()}</span>
        </div>
      </CardContent>
    </Card>
  );
}

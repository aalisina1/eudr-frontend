"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Play,
  RefreshCw,
  CheckCircle2,
  XCircle,
  ArrowUpRight,
  Eye,
  Clock,
} from "lucide-react";
import { authFetch } from "@/lib/api/client";
import type {
  SyncConfig,
  SyncJob,
  SyncRecord,
  MappingConfig,
  PaginatedResponse,
} from "@/lib/api/types";

const SYNC_JOB_STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700",
  RUNNING: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
};

const SYNC_RECORD_STATUS_STYLES: Record<string, string> = {
  PENDING_REVIEW: "bg-amber-100 text-amber-700",
  SUCCESS: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  SKIPPED: "bg-muted text-muted-foreground",
  REJECTED: "bg-red-100 text-red-700",
};

export function SyncsTab() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "jobs" | "records">("list");
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  // Fetch sync configs
  const { data: configsData, isLoading } = useQuery({
    queryKey: ["sync-configs"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/syncs/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<SyncConfig>>;
    },
  });

  const configs = configsData?.results ?? [];

  if (mode === "create") {
    return (
      <CreateSyncForm
        onBack={() => setMode("list")}
        onCreated={() => {
          queryClient.invalidateQueries({ queryKey: ["sync-configs"] });
          setMode("list");
        }}
      />
    );
  }

  if (mode === "jobs" && selectedConfigId) {
    return (
      <SyncJobsView
        configId={selectedConfigId}
        onBack={() => {
          setMode("list");
          setSelectedConfigId(null);
        }}
        onViewRecords={(jobId) => {
          setSelectedJobId(jobId);
          setMode("records");
        }}
      />
    );
  }

  if (mode === "records" && selectedJobId) {
    return (
      <SyncRecordsView
        jobId={selectedJobId}
        onBack={() => {
          setMode("jobs");
          setSelectedJobId(null);
        }}
      />
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Sync Configurations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Schedule and execute batch syncs that apply mappings to populate core models.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setMode("create")}
        >
          <Plus className="size-3.5" />
          New Sync
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(2)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="h-5 w-48 bg-muted rounded animate-pulse mb-2" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : configs.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <RefreshCw className="size-8 mx-auto text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">No sync configurations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a sync to schedule data promotion from mappings to core models.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMode("create")}
            >
              <Plus className="size-3.5" />
              Create Sync
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {configs.map((config) => (
            <SyncConfigCard
              key={config.id}
              config={config}
              onViewJobs={() => {
                setSelectedConfigId(config.id);
                setMode("jobs");
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Sync Config Card ──

function SyncConfigCard({
  config,
  onViewJobs,
}: {
  config: SyncConfig;
  onViewJobs: () => void;
}) {
  const queryClient = useQueryClient();

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/syncs/${config.id}/run/`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to trigger sync");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-configs"] });
    },
  });

  return (
    <Card className="border-border/50 hover:border-border transition-colors">
      <CardContent className="px-4 py-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">{config.name}</p>
          <div className="flex items-center gap-2 mt-0.5">
            {config.mapping_name && (
              <span className="text-[10px] text-muted-foreground">
                Mapping: {config.mapping_name}
              </span>
            )}
            <Badge
              variant="secondary"
              className={`border-0 rounded text-[9px] px-1.5 py-0 ${
                config.is_enabled
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {config.is_enabled ? "Enabled" : "Disabled"}
            </Badge>
            {config.schedule_cron && (
              <Badge
                variant="secondary"
                className="border-0 rounded text-[9px] px-1.5 py-0 bg-muted text-muted-foreground gap-1"
              >
                <Clock className="size-2.5" />
                {config.schedule_cron}
              </Badge>
            )}
            {config.requires_review && (
              <Badge
                variant="secondary"
                className="border-0 rounded text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700"
              >
                Review Required
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={onViewJobs}
          >
            <Eye className="size-3" />
            Jobs
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1"
            onClick={() => runMutation.mutate()}
            disabled={runMutation.isPending}
          >
            {runMutation.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Play className="size-3" />
            )}
            Run Now
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Create Sync Form ──

function CreateSyncForm({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [mappingId, setMappingId] = useState("");
  const [scheduleCron, setScheduleCron] = useState("");
  const [requiresReview, setRequiresReview] = useState(true);
  const [createError, setCreateError] = useState("");

  // Fetch mappings for selector
  const { data: mappingsData } = useQuery({
    queryKey: ["mappings"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/mappings/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<MappingConfig>>;
    },
  });

  const mappings = mappingsData?.results ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch("/api/v1/data-integration/syncs/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          mapping: mappingId,
          schedule_cron: scheduleCron || "",
          requires_review: requiresReview,
          is_enabled: true,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          Object.values(err).flat().join(", ") || "Failed to create sync"
        );
      }
      return res.json();
    },
    onSuccess: () => onCreated(),
    onError: (err) => setCreateError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-medium">Create Sync Configuration</h3>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Sync Name</Label>
            <Input
              placeholder="e.g. Daily land plot sync"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Mapping Configuration</Label>
            <select
              value={mappingId}
              onChange={(e) => setMappingId(e.target.value)}
              className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
            >
              <option value="">Select mapping...</option>
              {mappings.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.target_object_type.replace(/_/g, " ")})
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">
              Schedule (cron){" "}
              <span className="text-muted-foreground font-normal">optional</span>
            </Label>
            <Input
              placeholder="e.g. 0 2 * * * (daily at 2am)"
              value={scheduleCron}
              onChange={(e) => setScheduleCron(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="requires-review"
              checked={requiresReview}
              onChange={(e) => setRequiresReview(e.target.checked)}
              className="rounded"
            />
            <Label htmlFor="requires-review" className="text-xs font-normal">
              Require review before promoting records to core models
            </Label>
          </div>

          {createError && <p className="text-xs text-red-600">{createError}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || !mappingId || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              )}
              Create Sync
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Sync Jobs View ──

function SyncJobsView({
  configId,
  onBack,
  onViewRecords,
}: {
  configId: string;
  onBack: () => void;
  onViewRecords: (jobId: string) => void;
}) {
  const queryClient = useQueryClient();

  const { data: jobsData, isLoading } = useQuery({
    queryKey: ["sync-jobs", configId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sync-jobs/?sync_config=${configId}&ordering=-created_at&limit=20`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<SyncJob>>;
    },
  });

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/syncs/${configId}/run/`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Failed to trigger sync");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-jobs", configId] });
    },
  });

  const jobs = jobsData?.results ?? [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <h3 className="text-sm font-medium">Sync Jobs</h3>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => runMutation.mutate()}
          disabled={runMutation.isPending}
        >
          {runMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Play className="size-3.5" />
          )}
          Run Now
        </Button>
      </div>

      {isLoading ? (
        <Card className="border-border/50">
          <CardContent className="p-4">
            <div className="h-5 w-48 bg-muted rounded animate-pulse" />
          </CardContent>
        </Card>
      ) : jobs.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              No sync jobs yet. Click &quot;Run Now&quot; to trigger a sync.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium text-xs">Status</th>
                    <th className="px-4 py-2.5 font-medium text-xs">Triggered</th>
                    <th className="px-4 py-2.5 font-medium text-xs text-right">Processed</th>
                    <th className="px-4 py-2.5 font-medium text-xs text-right">Succeeded</th>
                    <th className="px-4 py-2.5 font-medium text-xs text-right">Failed</th>
                    <th className="px-4 py-2.5 font-medium text-xs">Started</th>
                    <th className="px-4 py-2.5 font-medium text-xs w-8" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr key={job.id} className="border-b last:border-0 hover:bg-muted/50">
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="secondary"
                          className={`border-0 rounded-lg text-[10px] px-2 py-0.5 ${
                            SYNC_JOB_STATUS_STYLES[job.status] ?? "bg-muted text-muted-foreground"
                          }`}
                        >
                          {job.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="secondary"
                          className="border-0 rounded text-[9px] px-1.5 py-0 bg-muted text-muted-foreground"
                        >
                          {job.triggered_by}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">
                        {job.records_processed}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-emerald-600">
                        {job.records_succeeded}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-red-600">
                        {job.records_failed}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        {job.started_at
                          ? new Date(job.started_at).toLocaleString()
                          : "\u2014"}
                      </td>
                      <td className="px-4 py-2.5">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="size-6 p-0"
                          onClick={() => onViewRecords(job.id)}
                        >
                          <Eye className="size-3" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Sync Records View ──

function SyncRecordsView({
  jobId,
  onBack,
}: {
  jobId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("PENDING_REVIEW");

  // Fetch sync records
  const { data: recordsData, isLoading } = useQuery({
    queryKey: ["sync-records", jobId, statusFilter],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sync-records/?sync_job=${jobId}&status=${statusFilter}&limit=50`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<SyncRecord>>;
    },
  });

  // Fetch detail for expanded record
  const { data: expandedRecord } = useQuery({
    queryKey: ["sync-record-detail", expandedId],
    enabled: !!expandedId,
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sync-records/${expandedId}/`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<SyncRecord>;
    },
  });

  // Bulk approve/reject
  const bulkMutation = useMutation({
    mutationFn: async (action: "approve" | "reject") => {
      const res = await authFetch(
        "/api/v1/data-integration/sync-records/bulk-action/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: Array.from(selectedIds), action }),
        }
      );
      if (!res.ok) throw new Error("Bulk action failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-records", jobId] });
      setSelectedIds(new Set());
    },
  });

  // Promote approved records
  const promoteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        "/api/v1/data-integration/sync-records/promote/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sync_record_ids: Array.from(selectedIds),
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Promotion failed");
      }
      return res.json() as Promise<{ promoted: number; failed: number; errors?: string[] }>;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sync-records", jobId] });
      setSelectedIds(new Set());
    },
  });

  const records = recordsData?.results ?? [];

  function toggleId(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const hasSuccessSelected = Array.from(selectedIds).some((id) => {
    const rec = records.find((r) => r.id === id);
    return rec?.status === "SUCCESS";
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={onBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <h3 className="text-sm font-medium">Sync Records</h3>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setSelectedIds(new Set());
            }}
            className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
          >
            <option value="PENDING_REVIEW">Pending Review</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="SKIPPED">Skipped</option>
            <option value="REJECTED">Rejected</option>
          </select>
        </div>
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
          <span className="text-xs text-muted-foreground">
            {selectedIds.size} selected
          </span>
          <div className="flex-1" />
          {statusFilter === "PENDING_REVIEW" && (
            <>
              <Button
                size="sm"
                onClick={() => bulkMutation.mutate("approve")}
                disabled={bulkMutation.isPending}
                className="h-7 text-xs gap-1"
              >
                <CheckCircle2 className="size-3" />
                Approve
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => bulkMutation.mutate("reject")}
                disabled={bulkMutation.isPending}
                className="h-7 text-xs gap-1 text-red-600 hover:text-red-700"
              >
                <XCircle className="size-3" />
                Reject
              </Button>
            </>
          )}
          {hasSuccessSelected && (
            <Button
              size="sm"
              onClick={() => promoteMutation.mutate()}
              disabled={promoteMutation.isPending}
              className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700"
            >
              {promoteMutation.isPending ? (
                <Loader2 className="size-3 animate-spin" />
              ) : (
                <ArrowUpRight className="size-3" />
              )}
              Promote to Core
            </Button>
          )}
        </div>
      )}

      {/* Promote result feedback */}
      {promoteMutation.isSuccess && (
        <div className="text-xs bg-emerald-50 text-emerald-700 rounded-lg px-3 py-2 flex items-center gap-1.5">
          <CheckCircle2 className="size-3.5" />
          Promoted {promoteMutation.data.promoted} records
          {promoteMutation.data.failed > 0 && (
            <span className="text-red-600 ml-2">
              ({promoteMutation.data.failed} failed)
            </span>
          )}
        </div>
      )}
      {promoteMutation.isError && (
        <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
          {(promoteMutation.error as Error).message}
        </div>
      )}

      {records.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">
              {isLoading
                ? "Loading..."
                : `No ${statusFilter.toLowerCase().replace(/_/g, " ")} records.`}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2.5 w-8">
                      <input
                        type="checkbox"
                        checked={
                          selectedIds.size === records.length && records.length > 0
                        }
                        onChange={() => {
                          if (selectedIds.size === records.length) {
                            setSelectedIds(new Set());
                          } else {
                            setSelectedIds(new Set(records.map((r) => r.id)));
                          }
                        }}
                        className="rounded"
                      />
                    </th>
                    <th className="px-4 py-2.5 font-medium text-xs">Target Type</th>
                    <th className="px-4 py-2.5 font-medium text-xs">Status</th>
                    <th className="px-4 py-2.5 font-medium text-xs">Created</th>
                    <th className="px-4 py-2.5 font-medium text-xs w-8" />
                  </tr>
                </thead>
                <tbody>
                  {records.map((rec) => (
                    <RecordRow
                      key={rec.id}
                      rec={rec}
                      isSelected={selectedIds.has(rec.id)}
                      isExpanded={expandedId === rec.id}
                      expandedRecord={expandedId === rec.id ? expandedRecord : null}
                      onToggle={() => toggleId(rec.id)}
                      onExpand={() =>
                        setExpandedId(expandedId === rec.id ? null : rec.id)
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecordRow({
  rec,
  isSelected,
  isExpanded,
  expandedRecord,
  onToggle,
  onExpand,
}: {
  rec: SyncRecord;
  isSelected: boolean;
  isExpanded: boolean;
  expandedRecord: SyncRecord | null | undefined;
  onToggle: () => void;
  onExpand: () => void;
}) {
  return (
    <>
      <tr className="border-b last:border-0 hover:bg-muted/50">
        <td className="px-4 py-2.5">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggle}
            className="rounded"
          />
        </td>
        <td className="px-4 py-2.5">
          <Badge
            variant="secondary"
            className="border-0 rounded text-[10px] px-2 py-0.5 bg-muted text-muted-foreground"
          >
            {rec.target_object_type.replace(/_/g, " ")}
          </Badge>
        </td>
        <td className="px-4 py-2.5">
          <Badge
            variant="secondary"
            className={`border-0 rounded text-[10px] px-2 py-0.5 ${
              SYNC_RECORD_STATUS_STYLES[rec.status] ??
              "bg-muted text-muted-foreground"
            }`}
          >
            {rec.status.replace(/_/g, " ")}
          </Badge>
        </td>
        <td className="px-4 py-2.5 text-xs text-muted-foreground">
          {new Date(rec.created_at).toLocaleString()}
        </td>
        <td className="px-4 py-2.5">
          <Button
            variant="ghost"
            size="sm"
            className="size-6 p-0"
            onClick={onExpand}
          >
            <Eye className="size-3" />
          </Button>
        </td>
      </tr>
      {isExpanded && expandedRecord && (
        <tr>
          <td colSpan={5} className="px-4 py-3 bg-muted/30">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Source Data
                </span>
                <pre className="text-[11px] font-mono bg-background rounded-lg p-2.5 overflow-x-auto max-h-[200px] overflow-y-auto border">
                  {JSON.stringify(expandedRecord.source_data, null, 2)}
                </pre>
              </div>
              <div>
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground block mb-1.5">
                  Transformed Data
                </span>
                <pre className="text-[11px] font-mono bg-background rounded-lg p-2.5 overflow-x-auto max-h-[200px] overflow-y-auto border">
                  {JSON.stringify(expandedRecord.transformed_data, null, 2)}
                </pre>
                {expandedRecord.error_message && (
                  <p className="text-xs text-red-600 mt-2">
                    {expandedRecord.error_message}
                  </p>
                )}
                {expandedRecord.target_object_id && (
                  <p className="text-xs text-blue-600 mt-2 flex items-center gap-1">
                    <ArrowUpRight className="size-3" />
                    Promoted: {expandedRecord.target_object_id.slice(0, 8)}...
                  </p>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

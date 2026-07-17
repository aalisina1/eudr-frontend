"use client";

import { useState, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Database,
  FileSpreadsheet,
  Globe,
  Server,
  Webhook,
  Upload,
  Loader2,
  Plug,
  Search,
  CheckSquare,
  ArrowDownToLine,
  CalendarClock,
  ChevronRight,
  Columns3,
  Rows3,
  XCircle,
  Trash2,
  Pencil,
} from "lucide-react";
import { SourceForm } from "@/components/forms/source-form";
import { ScheduleSection } from "@/components/integrations/schedule-section";
import { authFetch } from "@/lib/api/client";
import type {
  DataSource,
  DataSourceSchema,
  PaginatedResponse,
  SourceType,
  IngestJob,
  RawRecord,
} from "@/lib/api/types";

// ── Source type metadata ──

const SOURCE_ICONS: Record<SourceType, typeof Database> = {
  SQL_SERVER: Database,
  CSV_UPLOAD: FileSpreadsheet,
  FARMFORCE: Globe,
  AS400: Server,
  REST_API: Globe,
  SFTP: Upload,
  WEBHOOK: Webhook,
};

const SOURCE_COLORS: Record<SourceType, string> = {
  SQL_SERVER: "#3b82f6",
  CSV_UPLOAD: "#34D399",
  FARMFORCE: "#f59e0b",
  AS400: "#8b5cf6",
  REST_API: "#06b6d4",
  SFTP: "#C7956D",
  WEBHOOK: "#ec4899",
};

// ── Pipeline steps (ingestion only) ──

type PipelineStep = "configure" | "discover" | "select" | "ingest" | "schedule";

const PIPELINE_STEPS: {
  id: PipelineStep;
  label: string;
  icon: typeof Plug;
}[] = [
  { id: "configure", label: "Configure", icon: Plug },
  { id: "discover", label: "Discover", icon: Search },
  { id: "select", label: "Select", icon: CheckSquare },
  { id: "ingest", label: "Ingest", icon: ArrowDownToLine },
  { id: "schedule", label: "Schedule", icon: CalendarClock },
];

export default function SourceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const sourceId = params.sourceId as string;
  const [activeStep, setActiveStep] = useState<PipelineStep>("configure");
  const [editFormOpen, setEditFormOpen] = useState(false);

  // ── Fetch source ──
  const { data: source, isLoading } = useQuery({
    queryKey: ["source", sourceId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/`
      );
      if (!res.ok) throw new Error("Source not found");
      return res.json() as Promise<DataSource>;
    },
  });

  // ── Fetch schemas ──
  const { data: schemasData } = useQuery({
    queryKey: ["source-schemas", sourceId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/schemas/?limit=200`
      );
      if (!res.ok) throw new Error("Failed to fetch schemas");
      return res.json() as Promise<PaginatedResponse<DataSourceSchema>>;
    },
  });

  // ── Fetch jobs ──
  const { data: jobsData } = useQuery({
    queryKey: ["source-jobs", sourceId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/jobs/?source=${sourceId}&ordering=-started_at&limit=10`
      );
      if (!res.ok) throw new Error("Failed to fetch jobs");
      return res.json() as Promise<PaginatedResponse<IngestJob>>;
    },
  });

  // ── Fetch raw records ──
  const { data: rawData } = useQuery({
    queryKey: ["source-raw", sourceId],
    enabled: activeStep === "ingest",
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/raw-records/?limit=50`
      );
      if (!res.ok) throw new Error("Failed to fetch raw records");
      return res.json() as Promise<PaginatedResponse<RawRecord>>;
    },
  });

  const schemas = schemasData?.results ?? [];
  const jobs = jobsData?.results ?? [];
  const rawRecords = rawData?.results ?? [];
  const selectedSchemas = schemas.filter((s) => s.is_selected);

  // ── Mutations ──

  const testConnectionMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/test-connection/`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Connection failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["source", sourceId] });
    },
  });

  const discoverMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/discover/`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Discovery failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["source-schemas", sourceId],
      });
      setActiveStep("select");
    },
  });

  const [pendingSelection, setPendingSelection] = useState<Set<string>>(
    new Set()
  );

  const effectiveSelection = useMemo(() => {
    if (pendingSelection.size > 0) return pendingSelection;
    return new Set(selectedSchemas.map((s) => s.id));
  }, [pendingSelection, selectedSchemas]);

  const selectObjectsMutation = useMutation({
    mutationFn: async (schemaIds: string[]) => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/select-objects/`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ schema_ids: schemaIds }),
        }
      );
      if (!res.ok) throw new Error("Selection failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["source-schemas", sourceId],
      });
    },
  });

  const ingestMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/ingest/`,
        { method: "POST" }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Ingestion failed");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["source-jobs", sourceId],
      });
      queryClient.invalidateQueries({
        queryKey: ["source-raw", sourceId],
      });
      setActiveStep("ingest");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => {
      router.push("/integrations");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (!source) {
    return (
      <div className="space-y-6">
        <p className="text-muted-foreground">Source not found.</p>
      </div>
    );
  }

  const Icon = SOURCE_ICONS[source.source_type] ?? Database;
  const color = SOURCE_COLORS[source.source_type] ?? "#94a3b8";

  function toggleSchemaSelection(id: string) {
    setPendingSelection((prev) => {
      const next = new Set(prev.size > 0 ? prev : selectedSchemas.map((s) => s.id));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div>
        <button
          onClick={() => router.push("/integrations")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
        >
          <ArrowLeft className="size-4" />
          Back to Integrations
        </button>

        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${color}12`, color }}
            >
              <Icon className="size-5" />
            </div>
            <div>
              <h1 className="text-display text-2xl font-light italic">
                {source.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className="border-0 rounded-lg text-[10px] px-2 py-0.5 bg-muted text-muted-foreground"
                >
                  {source.source_type.replace("_", " ")}
                </Badge>
                <ConnectionStatusBadge status={source.connection_status} />
              </div>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (confirm("Delete this source and all its data?")) {
                deleteMutation.mutate();
              }
            }}
            className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
          >
            <Trash2 className="size-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Pipeline Stepper */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {PIPELINE_STEPS.map((step, i) => {
          const StepIcon = step.icon;
          const isActive = activeStep === step.id;
          const isPast = PIPELINE_STEPS.findIndex((s) => s.id === activeStep) > i;

          return (
            <div key={step.id} className="flex items-center">
              <button
                onClick={() => setActiveStep(step.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? "bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                    : isPast
                      ? "text-emerald-600/60 dark:text-emerald-400/60 hover:bg-muted/50"
                      : "text-muted-foreground hover:bg-muted/50"
                }`}
              >
                {isPast ? (
                  <CheckCircle2 className="size-4 text-emerald-500" />
                ) : isActive ? (
                  <StepIcon className="size-4" />
                ) : (
                  <Circle className="size-4" />
                )}
                <span className="hidden sm:inline">{step.label}</span>
              </button>
              {i < PIPELINE_STEPS.length - 1 && (
                <ChevronRight className="size-3.5 text-muted-foreground/30 shrink-0" />
              )}
            </div>
          );
        })}
      </div>

      {/* Step Content */}
      {activeStep === "configure" && (
        <ConfigureStep
          source={source}
          onTestConnection={() => testConnectionMutation.mutate()}
          isTesting={testConnectionMutation.isPending}
          testError={
            testConnectionMutation.isError
              ? (testConnectionMutation.error as Error).message
              : null
          }
          testSuccess={testConnectionMutation.isSuccess}
          onEdit={() => setEditFormOpen(true)}
        />
      )}

      <SourceForm
        open={editFormOpen}
        onOpenChange={setEditFormOpen}
        source={source}
      />

      {activeStep === "discover" && (
        <DiscoverStep
          schemas={schemas}
          onDiscover={() => discoverMutation.mutate()}
          isDiscovering={discoverMutation.isPending}
          discoverError={
            discoverMutation.isError
              ? (discoverMutation.error as Error).message
              : null
          }
        />
      )}

      {activeStep === "select" && (
        <SelectStep
          schemas={schemas}
          selectedIds={effectiveSelection}
          onToggle={toggleSchemaSelection}
          onSave={() => {
            selectObjectsMutation.mutate(Array.from(effectiveSelection));
          }}
          isSaving={selectObjectsMutation.isPending}
        />
      )}

      {activeStep === "ingest" && (
        <RawStep
          schemas={selectedSchemas}
          jobs={jobs}
          rawRecords={rawRecords}
          onIngest={() => ingestMutation.mutate()}
          isIngesting={ingestMutation.isPending}
          ingestError={
            ingestMutation.isError
              ? (ingestMutation.error as Error).message
              : null
          }
        />
      )}

      {activeStep === "schedule" && <ScheduleSection sourceId={sourceId} />}
    </div>
  );
}

// ── Sub-components ──

function ConnectionStatusBadge({ status }: { status: string }) {
  const meta: Record<string, { dot: string; bg: string; text: string; label: string }> = {
    CONNECTED: { dot: "bg-[#34D399]", bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", label: "Connected" },
    UNTESTED: { dot: "bg-muted-foreground/40", bg: "bg-muted", text: "text-muted-foreground", label: "Untested" },
    FAILED: { dot: "bg-[#C23D3D]", bg: "bg-[#C23D3D]/10", text: "text-[#C23D3D]", label: "Failed" },
  };
  const m = meta[status] ?? meta.UNTESTED;
  return (
    <Badge variant="secondary" className={`border-0 rounded-lg text-[10px] px-2 py-0.5 gap-1.5 ${m.bg} ${m.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />
      {m.label}
    </Badge>
  );
}

// ── Step 1: Configure ──

function ConfigureStep({
  source,
  onTestConnection,
  isTesting,
  testError,
  testSuccess,
  onEdit,
}: {
  source: DataSource;
  onTestConnection: () => void;
  isTesting: boolean;
  testError: string | null;
  testSuccess: boolean;
  onEdit: () => void;
}) {
  const config = (source.connection_config ?? {}) as Record<string, unknown>;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground">
              Connection Configuration
            </h3>
            <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
              <Pencil className="size-3.5" />
              Edit Connection
            </Button>
          </div>
          {Object.keys(config).length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No connection configuration. Edit the source to add connection
              details.
            </p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(config).map(([key, val]) => (
                <div key={key} className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground w-28 shrink-0 text-xs">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="font-mono text-xs truncate">
                    {key.toLowerCase().includes("password")
                      ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022"
                      : String(val ?? "\u2014")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button
          onClick={onTestConnection}
          disabled={isTesting}
          className="gap-1.5"
        >
          {isTesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Plug className="size-4" />
          )}
          Test Connection
        </Button>
        {testSuccess && (
          <span className="text-sm text-emerald-600 flex items-center gap-1.5">
            <CheckCircle2 className="size-4" />
            Connection successful
          </span>
        )}
        {testError && (
          <span className="text-sm text-red-600 flex items-center gap-1.5">
            <XCircle className="size-4" />
            {testError}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Step 2: Discover ──

function DiscoverStep({
  schemas,
  onDiscover,
  isDiscovering,
  discoverError,
}: {
  schemas: DataSourceSchema[];
  onDiscover: () => void;
  isDiscovering: boolean;
  discoverError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Metadata Discovery</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Introspect the source to discover tables, views, and their schemas.
          </p>
        </div>
        <Button
          onClick={onDiscover}
          disabled={isDiscovering}
          className="gap-1.5"
        >
          {isDiscovering ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
          {schemas.length > 0 ? "Re-discover" : "Discover Metadata"}
        </Button>
      </div>

      {discoverError && (
        <p className="text-sm text-red-600">{discoverError}</p>
      )}

      {schemas.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2.5 font-medium">Object</th>
                    <th className="px-4 py-2.5 font-medium">Type</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Columns
                    </th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Rows
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {schemas.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-2.5 font-mono text-xs">
                        {s.object_name}
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge
                          variant="secondary"
                          className="border-0 rounded-lg text-[10px] px-2 py-0.5 bg-muted text-muted-foreground gap-1"
                        >
                          {s.object_type === "TABLE" ? (
                            <Rows3 className="size-3" />
                          ) : (
                            <Columns3 className="size-3" />
                          )}
                          {s.object_type}
                        </Badge>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.schema?.columns?.length ?? 0}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-muted-foreground">
                        {s.row_count?.toLocaleString() ?? "\u2014"}
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

// ── Step 3: Select ──

function SelectStep({
  schemas,
  selectedIds,
  onToggle,
  onSave,
  isSaving,
}: {
  schemas: DataSourceSchema[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  if (schemas.length === 0) {
    return (
      <Card className="border-border/50 border-dashed">
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No objects discovered yet. Run discovery first.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Select Objects for Ingestion</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Choose which tables/views to bring into the raw data layer.{" "}
            <span className="font-medium text-foreground">
              {selectedIds.size} selected
            </span>
          </p>
        </div>
        <Button
          onClick={onSave}
          disabled={isSaving || selectedIds.size === 0}
          className="gap-1.5"
        >
          {isSaving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <CheckSquare className="size-4" />
          )}
          Save Selection
        </Button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {schemas.map((s) => {
          const isSelected = selectedIds.has(s.id);
          return (
            <button
              key={s.id}
              onClick={() => onToggle(s.id)}
              className={`text-left rounded-xl border p-4 transition-all ${
                isSelected
                  ? "border-emerald-500/50 bg-emerald-50/50 dark:bg-emerald-900/10"
                  : "border-border/50 hover:border-border"
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <div
                  className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500"
                      : "border-muted-foreground/30"
                  }`}
                >
                  {isSelected && (
                    <CheckCircle2 className="size-3.5 text-white" />
                  )}
                </div>
                <Badge
                  variant="secondary"
                  className="border-0 rounded text-[9px] px-1.5 py-0 bg-muted text-muted-foreground"
                >
                  {s.object_type}
                </Badge>
              </div>
              <p className="font-mono text-xs truncate">{s.object_name}</p>
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span>{s.schema?.columns?.length ?? 0} columns</span>
                {s.row_count != null && (
                  <span>{s.row_count.toLocaleString()} rows</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Step 4: Raw Data ──

function RawStep({
  schemas,
  jobs,
  rawRecords,
  onIngest,
  isIngesting,
  ingestError,
}: {
  schemas: DataSourceSchema[];
  jobs: IngestJob[];
  rawRecords: RawRecord[];
  onIngest: () => void;
  isIngesting: boolean;
  ingestError: string | null;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Raw Data</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ingest selected objects into the immutable raw data layer.
            {schemas.length > 0 && (
              <span className="ml-1 font-medium text-foreground">
                {schemas.length} object{schemas.length !== 1 ? "s" : ""}{" "}
                selected
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={onIngest}
          disabled={isIngesting || schemas.length === 0}
          className="gap-1.5"
        >
          {isIngesting ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowDownToLine className="size-4" />
          )}
          Run Ingestion
        </Button>
      </div>

      {ingestError && <p className="text-sm text-red-600">{ingestError}</p>}

      {/* Recent Jobs */}
      {jobs.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b">
              <h4 className="text-xs font-medium text-muted-foreground">
                Recent Ingestion Jobs
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium text-xs">Status</th>
                    <th className="px-4 py-2 font-medium text-xs text-right">
                      Records
                    </th>
                    <th className="px-4 py-2 font-medium text-xs text-right">
                      Failed
                    </th>
                    <th className="px-4 py-2 font-medium text-xs">Started</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job) => (
                    <tr
                      key={job.id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-2">
                        <JobStatusBadge status={job.status} />
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">
                        {job.records_ingested}
                      </td>
                      <td className="px-4 py-2 text-right tabular-nums text-xs">
                        {job.records_failed}
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(job.started_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Raw records preview */}
      {rawRecords.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="px-4 py-3 border-b flex items-center justify-between">
              <h4 className="text-xs font-medium text-muted-foreground">
                Raw Records ({rawRecords.length})
              </h4>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="px-4 py-2 font-medium text-xs">
                      External ID
                    </th>
                    <th className="px-4 py-2 font-medium text-xs">Status</th>
                    <th className="px-4 py-2 font-medium text-xs">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {rawRecords.slice(0, 20).map((r) => (
                    <tr
                      key={r.id}
                      className="border-b last:border-0 hover:bg-muted/50"
                    >
                      <td className="px-4 py-2 font-mono text-xs truncate max-w-xs">
                        {r.external_id}
                      </td>
                      <td className="px-4 py-2">
                        <Badge
                          variant="secondary"
                          className="border-0 rounded text-[10px] px-1.5 py-0 bg-muted text-muted-foreground"
                        >
                          {r.processing_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-xs text-muted-foreground">
                        {new Date(r.received_at).toLocaleString()}
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

function JobStatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    RUNNING: "bg-blue-100 text-blue-700",
    COMPLETED: "bg-emerald-100 text-emerald-700",
    FAILED: "bg-red-100 text-red-700",
  };
  return (
    <Badge
      variant="secondary"
      className={`border-0 rounded-lg text-[10px] px-2 py-0.5 ${colors[status] ?? "bg-muted text-muted-foreground"}`}
    >
      {status}
    </Badge>
  );
}

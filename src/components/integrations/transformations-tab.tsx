"use client";

import { useState, useCallback, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Plus,
  Play,
  ArrowLeft,
  CheckCircle2,
  Code2,
  ChevronRight,
  ChevronDown,
  Table2,
  Columns3,
  Save,
  Trash2,
  Pencil,
} from "lucide-react";
import Editor from "react-simple-code-editor";
import Prism from "prismjs";
import "prismjs/components/prism-sql";
import { authFetch } from "@/lib/api/client";
import type {
  Transformation,
  PaginatedResponse,
  DataSource,
  SQLViewSchema,
} from "@/lib/api/types";

export function TransformationsTab() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);

  // Fetch transformations
  const { data: transformationsData, isLoading } = useQuery({
    queryKey: ["transformations"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/transformations/");
      if (!res.ok) throw new Error("Failed to fetch transformations");
      return res.json() as Promise<PaginatedResponse<Transformation>>;
    },
  });

  const transformations = transformationsData?.results ?? [];

  if (mode === "create") {
    return (
      <TransformationEditor
        onBack={() => setMode("list")}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["transformations"] });
          setMode("list");
        }}
      />
    );
  }

  if (mode === "edit" && editingId) {
    return (
      <TransformationEditor
        transformationId={editingId}
        onBack={() => {
          setMode("list");
          setEditingId(null);
        }}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["transformations"] });
          setMode("list");
          setEditingId(null);
        }}
      />
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">SQL Transformations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Write SQL queries to join, filter, or aggregate data across sources.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setMode("create")}
        >
          <Plus className="size-3.5" />
          New Transformation
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="border-border/50">
              <CardContent className="p-4">
                <div className="h-5 w-48 bg-muted rounded animate-pulse mb-2" />
                <div className="h-4 w-32 bg-muted rounded animate-pulse" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : transformations.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <Code2 className="size-8 mx-auto text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">No transformations yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a SQL transformation to query across your ingested data.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMode("create")}
            >
              <Plus className="size-3.5" />
              Create Transformation
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {transformations.map((t) => (
            <Card key={t.id} className="border-border/50 hover:border-border transition-colors">
              <CardContent className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{t.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {t.description && (
                      <span className="text-xs text-muted-foreground truncate max-w-xs">
                        {t.description}
                      </span>
                    )}
                    <Badge
                      variant="secondary"
                      className={`border-0 rounded text-[9px] px-1.5 py-0 ${
                        t.is_validated
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-amber-100 text-amber-700"
                      }`}
                    >
                      {t.is_validated ? "Validated" : "Draft"}
                    </Badge>
                    {(t.output_columns?.length ?? 0) > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {t.output_columns.length} columns
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1"
                  onClick={() => {
                    setEditingId(t.id);
                    setMode("edit");
                  }}
                >
                  <Pencil className="size-3" />
                  Edit
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Transformation Editor ──

function TransformationEditor({
  transformationId,
  onBack,
  onSaved,
}: {
  transformationId?: string;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [queryText, setQueryText] = useState("");
  const [previewRows, setPreviewRows] = useState<Record<string, unknown>[] | null>(null);
  const [previewColumns, setPreviewColumns] = useState<{ name: string; type: string }[]>([]);
  const [expandedViews, setExpandedViews] = useState<Set<string>>(new Set());
  const [selectedSourceIds, setSelectedSourceIds] = useState<string[]>([]);

  // Fetch existing transformation
  const { data: existing } = useQuery({
    queryKey: ["transformation", transformationId],
    enabled: !!transformationId,
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/transformations/${transformationId}/`
      );
      if (!res.ok) throw new Error("Failed to fetch transformation");
      return res.json() as Promise<Transformation>;
    },
  });

  // Load existing data
  if (existing && !name && !queryText) {
    setName(existing.name);
    setDescription(existing.description);
    setQueryText(existing.query_text);
  }

  // Fetch sources for source selector
  const { data: sourcesData } = useQuery({
    queryKey: ["integration-sources"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/sources/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<DataSource>>;
    },
  });

  const sources = sourcesData?.results ?? [];

  // Auto-select all sources when they first load
  useEffect(() => {
    if (sources.length > 0 && selectedSourceIds.length === 0) {
      setSelectedSourceIds(sources.map((s) => s.id));
    }
  }, [sources, selectedSourceIds.length]);

  // Fetch SQL schema for sidebar
  const { data: schemaViews } = useQuery({
    queryKey: ["sql-schema", selectedSourceIds],
    enabled: selectedSourceIds.length > 0,
    queryFn: async () => {
      const params = selectedSourceIds.map((id) => `source_ids=${id}`).join("&");
      const res = await authFetch(
        `/api/v1/data-integration/transformations/sql-schema/?${params}`
      );
      if (!res.ok) throw new Error("Failed to fetch schema");
      const data = await res.json();
      return data.views as SQLViewSchema[];
    },
  });

  const views = schemaViews ?? [];

  // Run SQL preview
  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        "/api/v1/data-integration/transformations/preview/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query_text: queryText,
            source_ids: selectedSourceIds,
            limit: 50,
          }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || "Query execution failed");
      }
      return res.json() as Promise<{
        rows: Record<string, unknown>[];
        columns: { name: string; type: string }[];
      }>;
    },
    onSuccess: (data) => {
      setPreviewRows(data.rows);
      setPreviewColumns(data.columns);
    },
  });

  // Save transformation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const url = transformationId
        ? `/api/v1/data-integration/transformations/${transformationId}/`
        : "/api/v1/data-integration/transformations/";
      const res = await authFetch(url, {
        method: transformationId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description,
          query_text: queryText,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          Object.values(err).flat().join(", ") || "Failed to save"
        );
      }
      return res.json();
    },
    onSuccess: () => onSaved(),
  });

  // Validate transformation
  const validateMutation = useMutation({
    mutationFn: async () => {
      if (!transformationId) throw new Error("Save first");
      const res = await authFetch(
        `/api/v1/data-integration/transformations/${transformationId}/validate/`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("Validation failed");
      return res.json();
    },
  });

  const highlight = useCallback((code: string) => {
    return Prism.highlight(code, Prism.languages.sql, "sql");
  }, []);

  function toggleView(viewName: string) {
    setExpandedViews((prev) => {
      const next = new Set(prev);
      if (next.has(viewName)) next.delete(viewName);
      else next.add(viewName);
      return next;
    });
  }

  function insertText(text: string) {
    setQueryText((prev) => (prev ? prev + " " + text : text));
  }

  function toggleSource(id: string) {
    setSelectedSourceIds((prev) =>
      prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-medium">
          {transformationId ? "Edit Transformation" : "New Transformation"}
        </h3>
      </div>

      {/* Name & description */}
      <Card className="border-border/50">
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Name</Label>
              <Input
                placeholder="e.g. Enriched supplier parcels"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Input
                placeholder="Optional description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Source selector */}
          <div className="space-y-1.5">
            <Label className="text-xs">Sources</Label>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <Badge
                  key={s.id}
                  variant="secondary"
                  className={`border-0 rounded-lg text-[10px] px-2 py-1 cursor-pointer transition-colors ${
                    selectedSourceIds.includes(s.id)
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                  onClick={() => toggleSource(s.id)}
                >
                  {s.name}
                </Badge>
              ))}
              {sources.length === 0 && (
                <span className="text-xs text-muted-foreground">
                  No sources available. Create a source first.
                </span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* SQL Editor with schema sidebar */}
      <div className="grid grid-cols-[240px_1fr] gap-3">
        {/* Schema sidebar */}
        <Card className="border-border/50 overflow-hidden">
          <CardContent className="p-0">
            <div className="px-3 py-2.5 border-b bg-muted/30">
              <h4 className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                <Columns3 className="size-3" />
                Available Tables
              </h4>
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {views.length === 0 ? (
                <p className="px-3 py-4 text-xs text-muted-foreground text-center">
                  {selectedSourceIds.length === 0
                    ? "Select sources above to see tables."
                    : "No source objects available. Ingest data first."}
                </p>
              ) : (
                <div className="divide-y">
                  {views.map((view) => {
                    const isExpanded = expandedViews.has(view.view_name);
                    return (
                      <div key={view.view_name}>
                        <button
                          onClick={() => toggleView(view.view_name)}
                          className="w-full text-left px-3 py-2 hover:bg-muted/50 flex items-start gap-1.5 text-xs transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronDown className="size-3 shrink-0 text-muted-foreground mt-0.5" />
                          ) : (
                            <ChevronRight className="size-3 shrink-0 text-muted-foreground mt-0.5" />
                          )}
                          <Table2 className="size-3 shrink-0 text-blue-500 mt-0.5" />
                          <span
                            className="font-mono truncate block cursor-pointer hover:text-blue-600"
                            onClick={(e) => {
                              e.stopPropagation();
                              insertText(view.object_name);
                            }}
                            title="Click to insert table name"
                          >
                            {view.object_name}
                          </span>
                        </button>
                        {isExpanded && (
                          <div className="pl-7 pb-1.5">
                            {view.columns.map((col) => (
                              <button
                                key={col.name}
                                onClick={() => insertText(col.name)}
                                className="w-full text-left px-2 py-1 text-[10px] hover:bg-muted/50 flex items-center gap-2 font-mono rounded transition-colors"
                                title={`Type: ${col.type}${col.nullable ? " (nullable)" : ""}`}
                              >
                                <span className="truncate">{col.name}</span>
                                <span className="text-muted-foreground ml-auto shrink-0">
                                  {col.type}
                                </span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Editor + results */}
        <div className="space-y-3">
          <Card className="border-border/50 overflow-hidden">
            <CardContent className="p-0">
              <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  SQL Query
                </span>
                <div className="flex items-center gap-1.5">
                  {saveMutation.isError && (
                    <span className="text-[10px] text-red-600 max-w-[200px] truncate">
                      {(saveMutation.error as Error).message}
                    </span>
                  )}
                  {saveMutation.isSuccess && (
                    <span className="text-[10px] text-emerald-600">Saved!</span>
                  )}
                  {!name.trim() && (
                    <span className="text-[10px] text-muted-foreground">Enter a name to save</span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px] gap-1"
                    onClick={() => saveMutation.mutate()}
                    disabled={saveMutation.isPending || !name.trim() || !queryText.trim()}
                  >
                    {saveMutation.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Save className="size-3" />
                    )}
                    Save
                  </Button>
                  <Button
                    size="sm"
                    className="h-6 text-[10px] gap-1"
                    onClick={() => runMutation.mutate()}
                    disabled={runMutation.isPending || !queryText.trim()}
                  >
                    {runMutation.isPending ? (
                      <Loader2 className="size-3 animate-spin" />
                    ) : (
                      <Play className="size-3" />
                    )}
                    Run Query
                  </Button>
                </div>
              </div>
              <div className="min-h-[200px] max-h-[400px] overflow-auto">
                <Editor
                  value={queryText}
                  onValueChange={setQueryText}
                  highlight={highlight}
                  padding={12}
                  style={{
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                    fontSize: 13,
                    lineHeight: 1.5,
                    minHeight: 200,
                  }}
                  placeholder="SELECT s.name, s.country, p.area_hectares&#10;FROM suppliers s&#10;JOIN parcels p ON s.id = p.supplier_id&#10;WHERE p.area_hectares > 10"
                  textareaClassName="focus:outline-none"
                />
              </div>
            </CardContent>
          </Card>

          {/* Errors */}
          {runMutation.isError && (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {(runMutation.error as Error).message}
            </div>
          )}
          {saveMutation.isError && (
            <div className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              {(saveMutation.error as Error).message}
            </div>
          )}

          {/* Results table */}
          {previewRows && (
            <Card className="border-border/50 overflow-hidden">
              <CardContent className="p-0">
                <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    Results ({previewRows.length} rows)
                  </span>
                  <div className="flex gap-1">
                    {previewColumns.map((col) => (
                      <Badge
                        key={col.name}
                        variant="secondary"
                        className="border-0 rounded text-[9px] px-1.5 py-0 font-mono"
                      >
                        {col.name}
                        <span className="ml-1 text-muted-foreground font-normal">
                          {col.type}
                        </span>
                      </Badge>
                    ))}
                  </div>
                </div>
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-background">
                      <tr className="border-b text-left text-muted-foreground">
                        {previewColumns.map((col) => (
                          <th
                            key={col.name}
                            className="px-3 py-2 font-medium font-mono whitespace-nowrap"
                          >
                            {col.name}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row, i) => (
                        <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                          {previewColumns.map((col) => (
                            <td
                              key={col.name}
                              className="px-3 py-1.5 font-mono whitespace-nowrap max-w-[200px] truncate"
                            >
                              {row[col.name] == null ? (
                                <span className="text-muted-foreground/50 italic">null</span>
                              ) : (
                                String(row[col.name])
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

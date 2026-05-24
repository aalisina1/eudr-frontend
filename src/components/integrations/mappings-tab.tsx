"use client";

import { useState, useMemo, useEffect } from "react";
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
  Trash2,
  Pencil,
  ChevronRight,
  Columns3,
  GitMerge,
} from "lucide-react";
import { authFetch } from "@/lib/api/client";
import type {
  MappingConfig,
  DataSource,
  DataSourceSchema,
  Transformation,
  PaginatedResponse,
  FieldMapping,
  TargetObjectType,
  TargetFieldInfo,
  MappingSourceType,
} from "@/lib/api/types";

const TARGET_TYPES: { value: TargetObjectType; label: string }[] = [
  { value: "LAND_PLOT", label: "Land Plot" },
  { value: "BATCH", label: "Supply Chain Batch" },
  { value: "SUPPLIER", label: "Supplier" },
  { value: "DDS_HEADER", label: "DDS Header" },
  { value: "PRODUCT", label: "Product" },
];

const TRANSFORM_TYPES = [
  { value: "DIRECT", label: "Direct copy" },
  { value: "UPPERCASE", label: "Uppercase" },
  { value: "STRIP", label: "Strip whitespace" },
  { value: "TO_NUMBER", label: "To number" },
  { value: "DATE_FORMAT", label: "Date format" },
  { value: "CONCAT", label: "Concatenate" },
  { value: "CONSTANT", label: "Constant value" },
  { value: "LOOKUP_TABLE", label: "Lookup table" },
  { value: "GEOJSON_TO_GEOMETRY", label: "GeoJSON \u2192 Geometry" },
];

interface FieldMappingRow {
  id: string;
  source_path: string;
  target_field: string;
  transformation_type: string;
  default_value: string;
}

export function MappingsTab() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<"list" | "create" | "edit" | "fields">("list");
  const [editingMappingId, setEditingMappingId] = useState<string | null>(null);

  // Fetch mappings
  const { data: mappingsData, isLoading } = useQuery({
    queryKey: ["mappings"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/mappings/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<MappingConfig>>;
    },
  });

  const mappings = mappingsData?.results ?? [];

  if (mode === "create") {
    return (
      <CreateMappingForm
        onBack={() => setMode("list")}
        onCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["mappings"] });
          setEditingMappingId(id);
          setMode("fields");
        }}
      />
    );
  }

  if (mode === "edit" && editingMappingId) {
    return (
      <EditMappingForm
        mappingId={editingMappingId}
        onBack={() => {
          setMode("list");
          setEditingMappingId(null);
          queryClient.invalidateQueries({ queryKey: ["mappings"] });
        }}
      />
    );
  }

  if (mode === "fields" && editingMappingId) {
    return (
      <FieldMappingEditor
        mappingId={editingMappingId}
        onBack={() => {
          setMode("list");
          setEditingMappingId(null);
        }}
      />
    );
  }

  // ── List view ──
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium">Mapping Configurations</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Define how source columns or transformation output map to target object fields.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setMode("create")}
        >
          <Plus className="size-3.5" />
          New Mapping
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
      ) : mappings.length === 0 ? (
        <Card className="border-border/50 border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <GitMerge className="size-8 mx-auto text-muted-foreground/50" />
            <div>
              <p className="text-sm font-medium">No mapping configs yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Create a mapping to define how source data maps to target objects.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setMode("create")}
            >
              <Plus className="size-3.5" />
              Create Mapping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-2">
          {mappings.map((m) => (
            <Card key={m.id} className="border-border/50 hover:border-border transition-colors">
              <CardContent className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{m.name}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="secondary"
                      className="border-0 rounded text-[9px] px-1.5 py-0 bg-muted text-muted-foreground"
                    >
                      {m.target_object_type.replace(/_/g, " ")}
                    </Badge>
                    <Badge
                      variant="secondary"
                      className={`border-0 rounded text-[9px] px-1.5 py-0 ${
                        m.source_type === "TRANSFORMATION"
                          ? "bg-blue-100 text-blue-700"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {m.source_type === "TRANSFORMATION" ? "SQL" : "Source Object"}
                    </Badge>
                    {m.source_name && (
                      <span className="text-[10px] text-muted-foreground">
                        from {m.source_name}
                      </span>
                    )}
                    {m.transformation_name && (
                      <span className="text-[10px] text-muted-foreground">
                        via {m.transformation_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setEditingMappingId(m.id);
                      setMode("edit");
                    }}
                  >
                    <Pencil className="size-3" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs gap-1"
                    onClick={() => {
                      setEditingMappingId(m.id);
                      setMode("fields");
                    }}
                  >
                    <Columns3 className="size-3" />
                    Fields
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Create Mapping Form ──

function CreateMappingForm({
  onBack,
  onCreated,
}: {
  onBack: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<TargetObjectType>("LAND_PLOT");
  const [sourceType, setSourceType] = useState<MappingSourceType>("SOURCE_OBJECT");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSourceObjectId, setSelectedSourceObjectId] = useState("");
  const [selectedTransformationId, setSelectedTransformationId] = useState("");
  const [createError, setCreateError] = useState("");

  // Fetch sources
  const { data: sourcesData } = useQuery({
    queryKey: ["integration-sources"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/sources/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<DataSource>>;
    },
  });

  // Fetch source schemas when source selected
  const { data: schemasData } = useQuery({
    queryKey: ["source-schemas", selectedSourceId],
    enabled: !!selectedSourceId && sourceType === "SOURCE_OBJECT",
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${selectedSourceId}/schemas/?limit=200`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<DataSourceSchema>>;
    },
  });

  // Fetch transformations
  const { data: transformationsData } = useQuery({
    queryKey: ["transformations"],
    enabled: sourceType === "TRANSFORMATION",
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/transformations/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<Transformation>>;
    },
  });

  const sources = sourcesData?.results ?? [];
  const schemas = schemasData?.results?.filter((s) => s.is_selected) ?? [];
  const transformations = transformationsData?.results ?? [];

  const createMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name,
        target_object_type: targetType,
        source_type: sourceType,
      };
      if (sourceType === "SOURCE_OBJECT") {
        body.source = selectedSourceId;
        body.source_object = selectedSourceObjectId || null;
      } else {
        body.transformation = selectedTransformationId;
      }
      const res = await authFetch("/api/v1/data-integration/mappings/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          Object.values(err).flat().join(", ") || "Failed to create mapping"
        );
      }
      return res.json() as Promise<MappingConfig>;
    },
    onSuccess: (data) => onCreated(data.id),
    onError: (err) => setCreateError(err.message),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-medium">Create Mapping Configuration</h3>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Mapping Name</Label>
            <Input
              placeholder="e.g. Land plots from parcels table"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target Object Type</Label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as TargetObjectType)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Source Type</Label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as MappingSourceType)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="SOURCE_OBJECT">Source Object (direct)</option>
                <option value="TRANSFORMATION">SQL Transformation</option>
              </select>
            </div>
          </div>

          {sourceType === "SOURCE_OBJECT" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data Source</Label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => {
                    setSelectedSourceId(e.target.value);
                    setSelectedSourceObjectId("");
                  }}
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Select source...</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Source Object</Label>
                <select
                  value={selectedSourceObjectId}
                  onChange={(e) => setSelectedSourceObjectId(e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  disabled={!selectedSourceId}
                >
                  <option value="">Select object...</option>
                  {schemas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.object_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {sourceType === "TRANSFORMATION" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Transformation</Label>
              <select
                value={selectedTransformationId}
                onChange={(e) => setSelectedTransformationId(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select transformation...</option>
                {transformations.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_validated ? "(validated)" : "(draft)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {createError && <p className="text-xs text-red-600">{createError}</p>}

          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={onBack}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || createMutation.isPending}
              onClick={() => createMutation.mutate()}
            >
              {createMutation.isPending && (
                <Loader2 className="size-3.5 animate-spin mr-1.5" />
              )}
              Create & Add Fields
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Edit Mapping Form ──

function EditMappingForm({
  mappingId,
  onBack,
}: {
  mappingId: string;
  onBack: () => void;
}) {
  const [name, setName] = useState("");
  const [targetType, setTargetType] = useState<TargetObjectType>("LAND_PLOT");
  const [sourceType, setSourceType] = useState<MappingSourceType>("SOURCE_OBJECT");
  const [selectedSourceId, setSelectedSourceId] = useState("");
  const [selectedSourceObjectId, setSelectedSourceObjectId] = useState("");
  const [selectedTransformationId, setSelectedTransformationId] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [saveError, setSaveError] = useState("");

  // Fetch existing mapping
  const { data: mapping } = useQuery({
    queryKey: ["mapping", mappingId],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/data-integration/mappings/${mappingId}/`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<MappingConfig>;
    },
  });

  // Load existing values once
  useEffect(() => {
    if (mapping && !loaded) {
      setName(mapping.name);
      setTargetType(mapping.target_object_type);
      setSourceType(mapping.source_type);
      setSelectedSourceId(mapping.source ?? "");
      setSelectedSourceObjectId(mapping.source_object ?? "");
      setSelectedTransformationId(mapping.transformation ?? "");
      setLoaded(true);
    }
  }, [mapping, loaded]);

  // Fetch sources
  const { data: sourcesData } = useQuery({
    queryKey: ["integration-sources"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/sources/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<DataSource>>;
    },
  });

  // Fetch source schemas
  const { data: schemasData } = useQuery({
    queryKey: ["source-schemas", selectedSourceId],
    enabled: !!selectedSourceId && sourceType === "SOURCE_OBJECT",
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${selectedSourceId}/schemas/?limit=200`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<DataSourceSchema>>;
    },
  });

  // Fetch transformations
  const { data: transformationsData } = useQuery({
    queryKey: ["transformations"],
    enabled: sourceType === "TRANSFORMATION",
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/transformations/");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<Transformation>>;
    },
  });

  const sources = sourcesData?.results ?? [];
  const schemas = schemasData?.results?.filter((s) => s.is_selected) ?? [];
  const transformations = transformationsData?.results ?? [];

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body: Record<string, unknown> = {
        name,
        target_object_type: targetType,
        source_type: sourceType,
      };
      if (sourceType === "SOURCE_OBJECT") {
        body.source = selectedSourceId || null;
        body.source_object = selectedSourceObjectId || null;
      } else {
        body.transformation = selectedTransformationId || null;
      }
      const res = await authFetch(`/api/v1/data-integration/mappings/${mappingId}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          Object.values(err).flat().join(", ") || "Failed to update mapping"
        );
      }
      return res.json();
    },
    onSuccess: () => onBack(),
    onError: (err) => setSaveError(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/data-integration/mappings/${mappingId}/`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => onBack(),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-medium">Edit Mapping Configuration</h3>
      </div>

      <Card className="border-border/50">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">Mapping Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Target Object Type</Label>
              <select
                value={targetType}
                onChange={(e) => setTargetType(e.target.value as TargetObjectType)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                {TARGET_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Source Type</Label>
              <select
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as MappingSourceType)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="SOURCE_OBJECT">Source Object (direct)</option>
                <option value="TRANSFORMATION">SQL Transformation</option>
              </select>
            </div>
          </div>

          {sourceType === "SOURCE_OBJECT" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data Source</Label>
                <select
                  value={selectedSourceId}
                  onChange={(e) => {
                    setSelectedSourceId(e.target.value);
                    setSelectedSourceObjectId("");
                  }}
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                >
                  <option value="">Select source...</option>
                  {sources.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Source Object</Label>
                <select
                  value={selectedSourceObjectId}
                  onChange={(e) => setSelectedSourceObjectId(e.target.value)}
                  className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
                  disabled={!selectedSourceId}
                >
                  <option value="">Select object...</option>
                  {schemas.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.object_name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {sourceType === "TRANSFORMATION" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Transformation</Label>
              <select
                value={selectedTransformationId}
                onChange={(e) => setSelectedTransformationId(e.target.value)}
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 text-sm"
              >
                <option value="">Select transformation...</option>
                {transformations.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} {t.is_validated ? "(validated)" : "(draft)"}
                  </option>
                ))}
              </select>
            </div>
          )}

          {saveError && <p className="text-xs text-red-600">{saveError}</p>}

          <div className="flex justify-between">
            <Button
              variant="outline"
              size="sm"
              className="text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
              onClick={() => {
                if (confirm("Delete this mapping configuration?")) {
                  deleteMutation.mutate();
                }
              }}
              disabled={deleteMutation.isPending}
            >
              <Trash2 className="size-3" />
              Delete
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={onBack}>
                Cancel
              </Button>
              <Button
                size="sm"
                disabled={!name.trim() || saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                {saveMutation.isPending && (
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                )}
                Save Changes
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ── Field Mapping Editor ──

function FieldMappingEditor({
  mappingId,
  onBack,
}: {
  mappingId: string;
  onBack: () => void;
}) {
  const queryClient = useQueryClient();
  const [fieldRows, setFieldRows] = useState<FieldMappingRow[]>([]);
  const [initialized, setInitialized] = useState(false);

  // Fetch mapping detail
  const { data: mapping } = useQuery({
    queryKey: ["mapping", mappingId],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/data-integration/mappings/${mappingId}/`);
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<MappingConfig>;
    },
  });

  // Fetch existing field mappings
  const { data: existingFields } = useQuery({
    queryKey: ["mapping-fields", mappingId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/mappings/${mappingId}/fields/`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<FieldMapping>>;
    },
  });

  // Fetch target fields
  const { data: targetFieldsData } = useQuery({
    queryKey: ["target-fields", mapping?.target_object_type],
    enabled: !!mapping,
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/target-fields/${mapping!.target_object_type}/`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<{ fields: TargetFieldInfo[] }>;
    },
  });

  // Fetch the specific source object schema (for SOURCE_OBJECT mappings)
  const { data: sourceObjectSchema } = useQuery({
    queryKey: ["source-object-schema", mapping?.source, mapping?.source_object],
    enabled: !!mapping?.source && mapping?.source_type === "SOURCE_OBJECT",
    queryFn: async () => {
      // If a specific source_object is set, fetch all schemas and find it
      const res = await authFetch(
        `/api/v1/data-integration/sources/${mapping!.source}/schemas/?limit=200`
      );
      if (!res.ok) throw new Error("Failed");
      const data = await res.json() as PaginatedResponse<DataSourceSchema>;
      if (mapping!.source_object) {
        // Return only the specific source object
        return data.results.filter((s) => s.id === mapping!.source_object);
      }
      // No specific object — return all selected schemas
      return data.results.filter((s) => s.is_selected);
    },
  });

  // Fetch transformation output columns (for TRANSFORMATION mappings)
  const { data: transformation } = useQuery({
    queryKey: ["transformation", mapping?.transformation],
    enabled: !!mapping?.transformation && mapping?.source_type === "TRANSFORMATION",
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/transformations/${mapping!.transformation}/`
      );
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<Transformation>;
    },
  });

  // Build source columns from the mapping's configured source
  const sourceColumns = useMemo(() => {
    if (mapping?.source_type === "TRANSFORMATION" && transformation) {
      return transformation.output_columns.map((col) => ({
        qualifiedName: col.name,
        name: col.name,
        type: col.type,
      }));
    }
    const schemas = sourceObjectSchema ?? [];
    const cols: { qualifiedName: string; name: string; type: string }[] = [];
    for (const s of schemas) {
      for (const col of s.schema?.columns ?? []) {
        cols.push({
          qualifiedName: `${s.object_name}.${col.name}`,
          name: col.name,
          type: col.type,
        });
      }
    }
    return cols;
  }, [mapping, sourceObjectSchema, transformation]);

  const targetFields = targetFieldsData?.fields ?? [];
  const saved = existingFields?.results ?? [];
  const isTransformation = mapping?.source_type === "TRANSFORMATION";

  // Initialize rows: preload all target fields and auto-map matching source columns
  useEffect(() => {
    if (initialized || targetFields.length === 0) return;
    // Don't initialize until source columns are also resolved (or we know there are none)
    const sourceReady =
      mapping?.source_type === "TRANSFORMATION"
        ? transformation !== undefined
        : sourceObjectSchema !== undefined;
    if (!sourceReady) return;

    // Build a set of target fields already saved — don't duplicate them
    const savedTargets = new Set(saved.map((f) => f.target_field));

    // Normalize helper for matching
    const normalize = (s: string) =>
      s.toLowerCase().replace(/[-\s]/g, "_").replace(/^_+|_+$/g, "");

    // Build rows — one per target field that isn't already saved
    const rows: FieldMappingRow[] = targetFields
      .filter((tf) => !savedTargets.has(tf.name))
      .map((tf) => {
        // Try to find a matching source column by name similarity
        const tfNorm = normalize(tf.name);
        let bestMatch = "";
        let bestScore = 0;

        for (const col of sourceColumns) {
          const colNorm = normalize(col.name);
          let score = 0;
          if (colNorm === tfNorm) {
            score = 1.0;
          } else if (colNorm.includes(tfNorm) || tfNorm.includes(colNorm)) {
            score = 0.85;
          }
          if (score > bestScore) {
            bestScore = score;
            bestMatch = col.qualifiedName;
          }
        }

        // Suggest transformation type based on source/target types
        let transformType = "DIRECT";
        if (bestMatch) {
          const srcCol = sourceColumns.find((c) => c.qualifiedName === bestMatch);
          const srcType = (srcCol?.type ?? "").toUpperCase();
          if (tf.type === "DECIMAL" && ["VARCHAR", "NVARCHAR", "TEXT", "STRING"].includes(srcType)) {
            transformType = "TO_NUMBER";
          } else if (tf.type === "DATE" && ["VARCHAR", "NVARCHAR", "TEXT", "STRING"].includes(srcType)) {
            transformType = "DATE_FORMAT";
          } else if (tf.type === "GEOMETRY") {
            transformType = "GEOJSON_TO_GEOMETRY";
          }
        }

        return {
          id: crypto.randomUUID(),
          source_path: bestScore >= 0.55 ? bestMatch : "",
          target_field: tf.name,
          transformation_type: transformType,
          default_value: "",
        };
      });

    setFieldRows(rows.length > 0 ? rows : [makeEmptyRow()]);
    setInitialized(true);
  }, [targetFields, sourceColumns, saved, mapping, transformation, sourceObjectSchema, initialized]);

  // Save field mappings
  const saveFieldsMutation = useMutation({
    mutationFn: async () => {
      const valid = fieldRows.filter((r) => r.source_path && r.target_field);
      const results = [];
      for (const row of valid) {
        const res = await authFetch(
          `/api/v1/data-integration/mappings/${mappingId}/fields/`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              source_path: row.source_path,
              target_field: row.target_field,
              transformation_type: row.transformation_type,
              default_value: row.default_value || "",
              order: results.length,
            }),
          }
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(
            Object.values(err).flat().join(", ") || "Failed to save field mapping"
          );
        }
        results.push(await res.json());
      }
      return results;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapping-fields", mappingId] });
      // Reset rows — re-initialization will pick up the new saved state
      setInitialized(false);
      setFieldRows([]);
    },
  });

  // Delete field
  const deleteFieldMutation = useMutation({
    mutationFn: async (fieldId: string) => {
      const res = await authFetch(
        `/api/v1/data-integration/mappings/${mappingId}/fields/${fieldId}/`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["mapping-fields", mappingId] });
      // Allow re-initialization to add the freed target field back
      setInitialized(false);
      setFieldRows([]);
    },
  });

  function updateRow(id: string, field: keyof FieldMappingRow, value: string) {
    setFieldRows((rows) =>
      rows.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  }

  function removeRow(id: string) {
    setFieldRows((rows) => {
      const next = rows.filter((r) => r.id !== id);
      return next.length > 0 ? next : [makeEmptyRow()];
    });
  }

  const unmappedCount = fieldRows.filter((r) => !r.source_path).length;
  const mappedCount = fieldRows.filter((r) => r.source_path && r.target_field).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="size-4" />
        </Button>
        <h3 className="text-sm font-medium">
          Field Mappings {mapping ? `\u2014 ${mapping.name}` : ""}
        </h3>
        <Badge
          variant="secondary"
          className="border-0 rounded text-[9px] px-1.5 py-0 bg-muted text-muted-foreground"
        >
          {mapping?.target_object_type.replace(/_/g, " ")}
        </Badge>
      </div>

      {/* Summary bar */}
      {fieldRows.length > 0 && (
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>
            <span className="font-medium text-foreground">{mappedCount}</span> mapped
          </span>
          {unmappedCount > 0 && (
            <span>
              <span className="font-medium text-amber-600">{unmappedCount}</span> unmapped
            </span>
          )}
          <span>
            <span className="font-medium text-foreground">{saved.length}</span> saved
          </span>
          {sourceColumns.length > 0 && (
            <span className="ml-auto">
              {sourceColumns.length} source column{sourceColumns.length !== 1 ? "s" : ""} available
            </span>
          )}
        </div>
      )}

      {/* Existing saved mappings */}
      {saved.length > 0 && (
        <Card className="border-border/50">
          <CardContent className="p-0">
            <div className="px-4 py-2.5 border-b bg-muted/30">
              <h4 className="text-xs font-medium text-muted-foreground">
                Saved Mappings ({saved.length})
              </h4>
            </div>
            <div className="divide-y">
              {saved.map((f) => (
                <div key={f.id} className="px-4 py-2 flex items-center gap-3 text-xs">
                  <span className="font-mono flex-1">{f.source_path}</span>
                  <ChevronRight className="size-3 text-muted-foreground" />
                  <span className="font-mono flex-1">{f.target_field}</span>
                  <Badge
                    variant="secondary"
                    className="border-0 rounded text-[9px] px-1.5 py-0"
                  >
                    {f.transformation_type}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="size-6 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => deleteFieldMutation.mutate(f.id)}
                  >
                    <Trash2 className="size-3" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Field mapping rows — preloaded with target fields */}
      <Card className="border-border/50">
        <CardContent className="p-0">
          <div className="px-4 py-2.5 border-b bg-muted/30 flex items-center justify-between">
            <h4 className="text-xs font-medium text-muted-foreground">
              {saved.length > 0 ? "New Mappings" : "Field Mappings"}
            </h4>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => setFieldRows((r) => [...r, makeEmptyRow()])}
            >
              <Plus className="size-3" />
              Add Row
            </Button>
          </div>
          <div className="divide-y">
            <div className="grid grid-cols-[1fr_1fr_auto_1fr_auto] gap-2 px-4 py-2 text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
              <span>Source Column</span>
              <span>Target Field</span>
              <span>Transform</span>
              <span>Default</span>
              <span className="w-6" />
            </div>
            {fieldRows.length === 0 && !initialized && (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                <Loader2 className="size-4 animate-spin mx-auto mb-2" />
                Loading target fields…
              </div>
            )}
            {fieldRows.map((row) => (
              <div
                key={row.id}
                className={`grid grid-cols-[1fr_1fr_auto_1fr_auto] gap-2 px-4 py-2 items-center ${
                  row.source_path ? "" : "bg-amber-50/50"
                }`}
              >
                <select
                  value={row.source_path}
                  onChange={(e) => updateRow(row.id, "source_path", e.target.value)}
                  className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="">— unmapped —</option>
                  {sourceColumns.map((col, i) => (
                    <option key={i} value={col.qualifiedName}>
                      {col.qualifiedName}
                    </option>
                  ))}
                </select>
                <select
                  value={row.target_field}
                  onChange={(e) => updateRow(row.id, "target_field", e.target.value)}
                  className="h-7 rounded-md border border-input bg-transparent px-2 text-xs"
                >
                  <option value="">Select field...</option>
                  {targetFields.map((f) => (
                    <option key={f.name} value={f.name}>
                      {f.name} ({f.type}){f.required ? " *" : ""}
                    </option>
                  ))}
                </select>
                <select
                  value={row.transformation_type}
                  onChange={(e) => updateRow(row.id, "transformation_type", e.target.value)}
                  className="h-7 rounded-md border border-input bg-transparent px-2 text-xs w-[130px]"
                >
                  {TRANSFORM_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Input
                  className="h-7 text-xs"
                  placeholder="optional"
                  value={row.default_value}
                  onChange={(e) => updateRow(row.id, "default_value", e.target.value)}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="size-6 p-0 text-muted-foreground hover:text-red-600"
                  onClick={() => removeRow(row.id)}
                >
                  <Trash2 className="size-3" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {saveFieldsMutation.error && (
        <p className="text-xs text-red-600">
          {(saveFieldsMutation.error as Error).message}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" onClick={onBack}>
          Done
        </Button>
        <Button
          size="sm"
          disabled={mappedCount === 0 || saveFieldsMutation.isPending}
          onClick={() => saveFieldsMutation.mutate()}
        >
          {saveFieldsMutation.isPending && (
            <Loader2 className="size-3.5 animate-spin mr-1.5" />
          )}
          Save {mappedCount} Mapping{mappedCount !== 1 ? "s" : ""}
        </Button>
      </div>
    </div>
  );
}

function makeEmptyRow(): FieldMappingRow {
  return {
    id: crypto.randomUUID(),
    source_path: "",
    target_field: "",
    transformation_type: "DIRECT",
    default_value: "",
  };
}

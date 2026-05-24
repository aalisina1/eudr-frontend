"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Cable,
  Plus,
  Database,
  FileSpreadsheet,
  Globe,
  Server,
  Webhook,
  Upload,
  ArrowRight,
  Code2,
  GitMerge,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { SourceForm } from "@/components/forms/source-form";
import { TransformationsTab } from "@/components/integrations/transformations-tab";
import { MappingsTab } from "@/components/integrations/mappings-tab";
import { SyncsTab } from "@/components/integrations/syncs-tab";
import type { DataSource, PaginatedResponse, SourceType } from "@/lib/api/types";

type TabId = "sources" | "transformations" | "mappings" | "syncs";

const TABS: { id: TabId; label: string; icon: typeof Database }[] = [
  { id: "sources", label: "Sources", icon: Database },
  { id: "transformations", label: "Transformations", icon: Code2 },
  { id: "mappings", label: "Mappings", icon: GitMerge },
  { id: "syncs", label: "Syncs", icon: RefreshCw },
];

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

export default function IntegrationsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabId>("sources");
  const [formOpen, setFormOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["integration-sources"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/data-integration/sources/");
      if (!res.ok) throw new Error("Failed to fetch sources");
      return res.json() as Promise<PaginatedResponse<DataSource>>;
    },
  });

  const sources = data?.results ?? [];

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">
            Integrations
          </h1>
          <p className="text-sm text-muted-foreground">
            Connect sources, transform data, configure mappings, and run syncs.
          </p>
        </div>
        {activeTab === "sources" && (
          <Button onClick={() => setFormOpen(true)} className="gap-1.5">
            <Plus className="size-4" />
            New Source
          </Button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 border-b border-border/50">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-all border-b-2 -mb-px ${
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              }`}
            >
              <Icon className="size-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "sources" && (
        <SourcesContent
          sources={sources}
          isLoading={isLoading}
          onNewSource={() => setFormOpen(true)}
          onNavigate={(id) => router.push(`/integrations/${id}`)}
        />
      )}

      {activeTab === "transformations" && <TransformationsTab />}
      {activeTab === "mappings" && <MappingsTab />}
      {activeTab === "syncs" && <SyncsTab />}

      <SourceForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

// ── Sources Tab Content ──

function SourcesContent({
  sources,
  isLoading,
  onNewSource,
  onNavigate,
}: {
  sources: DataSource[];
  isLoading: boolean;
  onNewSource: () => void;
  onNavigate: (id: string) => void;
}) {
  if (isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[...Array(3)].map((_, i) => (
          <Card key={i} className="border-border/50">
            <CardContent className="p-5">
              <Skeleton className="h-10 w-10 rounded-xl mb-4" />
              <Skeleton className="h-5 w-40 mb-2" />
              <Skeleton className="h-4 w-24" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (sources.length === 0) {
    return (
      <Card className="border-border/50 border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-16">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-4">
            <Cable className="size-5 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium mb-1">No integrations yet</p>
          <p className="text-xs text-muted-foreground mb-4">
            Add your first source to start ingesting data.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={onNewSource}
            className="gap-1.5"
          >
            <Plus className="size-3.5" />
            New Source
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {sources.map((source) => {
        const typeMeta = SOURCE_TYPE_META[source.source_type] ?? {
          label: source.source_type,
          icon: Database,
          color: "#94a3b8",
        };
        const statusMeta =
          CONNECTION_STATUS_META[source.connection_status] ??
          CONNECTION_STATUS_META.UNTESTED;
        const Icon = typeMeta.icon;

        return (
          <Card
            key={source.id}
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
                <ArrowRight className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-0.5" />
              </div>

              <p className="text-sm font-medium mb-1 truncate">
                {source.name}
              </p>

              <div className="flex items-center gap-2 mb-3">
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
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`}
                  />
                  {statusMeta.label}
                </Badge>
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground pt-3 border-t border-border/50">
                <span>
                  {(source.schema_count ?? 0) > 0
                    ? `${source.schema_count} object${source.schema_count !== 1 ? "s" : ""}`
                    : "No objects"}
                </span>
                <span>
                  {new Date(source.created_at).toLocaleDateString()}
                </span>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

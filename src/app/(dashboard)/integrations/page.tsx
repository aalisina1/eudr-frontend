"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Cable,
  Plus,
  Database,
  Code2,
  GitMerge,
  RefreshCw,
} from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { SourceForm } from "@/components/forms/source-form";
import { TransformationsTab } from "@/components/integrations/transformations-tab";
import { MappingsTab } from "@/components/integrations/mappings-tab";
import { SyncsTab } from "@/components/integrations/syncs-tab";
import { SourceCard } from "@/components/integrations/source-card";
import type { DataSource, PaginatedResponse } from "@/lib/api/types";

type TabId = "sources" | "transformations" | "mappings" | "syncs";

const TABS: { id: TabId; label: string; icon: typeof Database }[] = [
  { id: "sources", label: "Sources", icon: Database },
  { id: "transformations", label: "Transformations", icon: Code2 },
  { id: "mappings", label: "Mappings", icon: GitMerge },
  { id: "syncs", label: "Syncs", icon: RefreshCw },
];


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
      {sources.map((source) => (
        <SourceCard key={source.id} source={source} onNavigate={onNavigate} />
      ))}
    </div>
  );
}

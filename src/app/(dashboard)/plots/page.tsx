"use client";

import { useState, useEffect, useMemo } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Search, Plus } from "lucide-react";
import { PlotForm } from "@/components/forms/plot-form";
import { authFetch } from "@/lib/api/client";
import type { PaginatedResponse, LandPlot, ValidationStatus } from "@/lib/api/types";

const LandPlotMap = dynamic(
  () => import("@/components/map/land-plot-map").then((m) => m.LandPlotMap),
  { ssr: false, loading: () => <Skeleton className="w-full rounded-2xl" style={{ height: "100%" }} /> },
);

async function fetchPlots(): Promise<PaginatedResponse<LandPlot>> {
  const res = await authFetch("/api/v1/geolocation/plots/?limit=100");
  if (!res.ok) throw new Error("Failed to fetch plots");
  return res.json();
}

const STATUS_DOT: Record<ValidationStatus, string> = {
  PENDING: "bg-[#C7956D]",
  PASSED: "bg-[#34D399]",
  FAILED: "bg-[#C23D3D]",
  REQUIRES_REVIEW: "bg-[#E8C468]",
};

const STATUS_TEXT: Record<ValidationStatus, string> = {
  PENDING: "text-[#A07850]",
  PASSED: "text-[#1A6B5A]",
  FAILED: "text-[#C23D3D]",
  REQUIRES_REVIEW: "text-[#A07850]",
};

const STATUS_LABEL: Record<ValidationStatus, string> = {
  PENDING: "Pending",
  PASSED: "Passed",
  FAILED: "Deforestation Detected",
  REQUIRES_REVIEW: "Requires Review",
};

const STATUS_FILTER_OPTIONS: { label: string; value: ValidationStatus | "" }[] = [
  { label: "All Statuses", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Passed", value: "PASSED" },
  { label: "Failed", value: "FAILED" },
  { label: "Requires Review", value: "REQUIRES_REVIEW" },
];

export default function PlotsPage() {
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [plotFormOpen, setPlotFormOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const { data, isLoading, error } = useQuery({
    queryKey: ["plots"],
    queryFn: fetchPlots,
  });

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(timer);
  }, [search]);

  // Client-side filter (plots are all loaded for the map anyway)
  const filteredPlots = useMemo(() => {
    if (!data?.results) return [];
    let plots = data.results;
    if (statusFilter) {
      plots = plots.filter((p) => p.validation_status === statusFilter);
    }
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase();
      plots = plots.filter(
        (p) =>
          p.country.toLowerCase().includes(q) ||
          p.region?.toLowerCase().includes(q) ||
          p.external_id?.toLowerCase().includes(q),
      );
    }
    return plots;
  }, [data?.results, statusFilter, debouncedSearch]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Land Plots</h1>
          <p className="text-sm text-muted-foreground">
            {data ? `${data.count} geo-referenced parcels` : "Geolocation & validation"}
          </p>
        </div>
        <Button onClick={() => setPlotFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Add Plot
        </Button>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
          Failed to load plots. Is the API running?
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3" style={{ minHeight: "calc(100vh - 260px)" }}>
        {/* Plot list */}
        <div className="lg:col-span-1 flex flex-col gap-3 max-h-[calc(100vh-260px)]">
          {/* Search & filter */}
          <div className="space-y-2 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/50" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by country or region..."
                className="pl-9 h-9 bg-secondary/50 border-border/60 focus:bg-card rounded-xl text-[13px]"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30 transition-colors appearance-none cursor-pointer"
            >
              {STATUS_FILTER_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Results count */}
          {data && (
            <p className="text-xs text-muted-foreground shrink-0">
              {filteredPlots.length === data.results.length
                ? `${data.results.length} plots`
                : `${filteredPlots.length} of ${data.results.length} plots`}
            </p>
          )}

          {/* Plot cards */}
          <div className="space-y-2 overflow-y-auto pr-1 flex-1">
            {isLoading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-22 w-full rounded-xl" />
                ))
              : filteredPlots.map((plot) => (
                  <div
                    key={plot.id}
                    onClick={() => setSelectedPlotId(plot.id)}
                    className={`rounded-xl border bg-card p-4 hover:shadow-[0_4px_20px_rgba(0,0,0,0.05)] transition-all duration-200 cursor-pointer group ${selectedPlotId === plot.id ? "border-primary/50 shadow-[0_4px_20px_rgba(0,0,0,0.05)]" : "border-border/50"}`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-medium text-[13px] leading-tight group-hover:text-primary transition-colors">
                        {plot.country}{plot.region ? `, ${plot.region}` : ""}
                      </p>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium whitespace-nowrap ${STATUS_TEXT[plot.validation_status]}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${STATUS_DOT[plot.validation_status]}`} />
                        {STATUS_LABEL[plot.validation_status]}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">{plot.area_hectares} ha</p>
                    {plot.external_id && (
                      <p className="text-xs text-muted-foreground font-mono mt-0.5">{plot.external_id}</p>
                    )}
                  </div>
                ))}

            {!isLoading && filteredPlots.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mb-3">
                  <MapPin className="w-5 h-5 text-muted-foreground" />
                </div>
                <p className="text-sm font-medium mb-0.5">
                  {data?.results.length ? "No matching plots" : "No land plots yet"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {data?.results.length
                    ? "Try adjusting your search or filter"
                    : "Import or create plots to visualise them on the map"}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Map */}
        <div className="lg:col-span-2 rounded-2xl overflow-hidden border border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
          <LandPlotMap plots={data?.results ?? []} selectedPlotId={selectedPlotId} />
        </div>
      </div>

      <PlotForm open={plotFormOpen} onOpenChange={setPlotFormOpen} />
    </div>
  );
}

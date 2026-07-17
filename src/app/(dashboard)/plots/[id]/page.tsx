"use client";

import { use } from "react";
import dynamic from "next/dynamic";
import { useQuery } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ArrowLeft, MapPin, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import type { LandPlot, ValidationStatus } from "@/lib/api/types";

const LandPlotMap = dynamic(
  () => import("@/components/map/land-plot-map").then((m) => m.LandPlotMap),
  { ssr: false, loading: () => <Skeleton className="w-full h-80 rounded-2xl" /> },
);

const STATUS_STYLE: Record<ValidationStatus, { bg: string; text: string; dot: string; label: string; icon: typeof CheckCircle2 }> = {
  PENDING: { bg: "bg-[#C7956D]/10", text: "text-[#A07850]", dot: "bg-[#C7956D]", label: "Pending", icon: Clock },
  PASSED: { bg: "bg-[#34D399]/10", text: "text-[#1A6B5A]", dot: "bg-[#34D399]", label: "Passed", icon: CheckCircle2 },
  FAILED: { bg: "bg-[#C23D3D]/10", text: "text-[#C23D3D]", dot: "bg-[#C23D3D]", label: "Deforestation Detected", icon: AlertTriangle },
  REQUIRES_REVIEW: { bg: "bg-[#E8C468]/10", text: "text-[#9A7D2E]", dot: "bg-[#E8C468]", label: "Requires Review", icon: AlertTriangle },
};

const TH = "text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

export default function PlotDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  const { data: plot, isLoading, error } = useQuery<LandPlot>({
    queryKey: ["plot", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/geolocation/plots/${id}/`);
      if (!res.ok) throw new Error("Failed to fetch plot");
      return res.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-80 w-full rounded-2xl" />
        <Skeleton className="h-40 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !plot) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/plots")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back to Plots
        </Button>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          Plot not found or failed to load.
        </div>
      </div>
    );
  }

  const status = STATUS_STYLE[plot.validation_status];
  const StatusIcon = status.icon;

  return (
    <div className="space-y-6">
      {/* Back */}
      <Button variant="ghost" size="sm" onClick={() => router.push("/plots")} className="gap-1.5">
        <ArrowLeft className="size-4" /> Land Plots
      </Button>

      {/* Header Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-medium">
                {plot.country}{plot.region ? `, ${plot.region}` : ""}
              </h1>
              <p className="text-sm text-muted-foreground">{plot.area_hectares} hectares</p>
            </div>
          </div>
          <Badge variant="secondary" className={`${status.bg} ${status.text} border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5`}>
            <StatusIcon className="size-3" />
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Geometry Source</p>
            <p className="text-xs">{plot.geometry_source.replace(/_/g, " ")}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Accuracy</p>
            <p className="text-xs">{plot.accuracy_meters ? `${plot.accuracy_meters}m` : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">External ID</p>
            <p className="text-xs font-mono">{plot.external_id || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Collection Date</p>
            <p className="text-xs">{plot.collection_date ? new Date(plot.collection_date).toLocaleDateString() : "—"}</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-border/50 shadow-[0_1px_3px_rgba(0,0,0,0.04)]" style={{ height: 400 }}>
        <LandPlotMap plots={[plot]} selectedPlotId={plot.id} />
      </div>

      {/* Validation Results */}
      <div>
        <h2 className="text-sm font-medium mb-3">Validation Results</h2>
        {plot.validation_results && plot.validation_results.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className={TH}>Validator</TableHead>
                  <TableHead className={TH}>Deforestation</TableHead>
                  <TableHead className={TH}>Confidence</TableHead>
                  <TableHead className={TH}>Alert Date</TableHead>
                  <TableHead className={TH}>Validated</TableHead>
                  <TableHead className={TH}>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {plot.validation_results.map((vr) => (
                  <TableRow key={vr.id} className="border-border/30">
                    <TableCell className="text-[13px] font-medium">{vr.validator.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5 ${
                          vr.deforestation_detected
                            ? "bg-[#C23D3D]/10 text-[#C23D3D]"
                            : "bg-[#34D399]/10 text-[#1A6B5A]"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${vr.deforestation_detected ? "bg-[#C23D3D]" : "bg-[#34D399]"}`} />
                        {vr.deforestation_detected ? "Detected" : "Clear"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-[13px]">
                      {vr.confidence_score !== null ? `${(vr.confidence_score * 100).toFixed(0)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {vr.alert_date ? new Date(vr.alert_date).toLocaleDateString() : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {new Date(vr.validated_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-[13px] max-w-[200px] truncate">{vr.notes || "—"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No validation results yet</p>
          </div>
        )}
      </div>
    </div>
  );
}

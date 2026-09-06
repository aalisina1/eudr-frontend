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
import { plotIdentity } from "@/lib/plot-identity";
import type { LandPlot, ValidationStatus } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const LandPlotMap = dynamic(
  () => import("@/components/map/land-plot-map").then((m) => m.LandPlotMap),
  { ssr: false, loading: () => <Skeleton className="w-full h-80 rounded-2xl" /> },
);

const STATUS_STYLE: Record<ValidationStatus, { bg: string; text: string; dot: string; label: string; icon: typeof CheckCircle2 }> = {
  PENDING: { bg: "bg-pending/10", text: "text-pending-foreground", dot: "bg-pending", label: "Pending", icon: Clock },
  PASSED: { bg: "bg-success/10", text: "text-success-foreground", dot: "bg-success", label: "Passed", icon: CheckCircle2 },
  FAILED: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "Deforestation Detected", icon: AlertTriangle },
  REQUIRES_REVIEW: { bg: "bg-warning/10", text: "text-warning-foreground", dot: "bg-warning", label: "Requires Review", icon: AlertTriangle },
};

const TH = "text-xs font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

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
        <ArrowLeft className="size-4" /> Land plots
      </Button>

      {/* Header Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <MapPin className="size-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-medium">
                {plotIdentity(plot).primary}
              </h1>
              <p className="text-sm text-muted-foreground">{plot.area_hectares} hectares</p>
            </div>
          </div>
          <Badge variant="secondary" className={`${status.bg} ${status.text} border-0 rounded-lg font-medium text-xs gap-1.5 px-2.5`}>
            <StatusIcon className="size-3" />
            {status.label}
          </Badge>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Country</p>
            <p className="text-xs">{plot.country || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Region</p>
            <p className="text-xs">{plot.region || "—"}</p>
          </div>
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
            <p className="text-xs">{plot.collection_date ? formatDate(plot.collection_date) : "—"}</p>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="rounded-2xl overflow-hidden border border-border/50 shadow-card" style={{ height: 400 }}>
        <LandPlotMap plots={[plot]} selectedPlotId={plot.id} />
      </div>

      {/* Validation results */}
      <div>
        <h2 className="text-sm font-medium mb-3">Validation results</h2>
        {plot.validation_results && plot.validation_results.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-card">
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
                    <TableCell className="text-sm font-medium">{vr.validator.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`border-0 rounded-lg font-medium text-xs gap-1.5 px-2.5 ${
                          vr.deforestation_detected
                            ? "bg-destructive/10 text-destructive"
                            : "bg-success/10 text-success-foreground"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${vr.deforestation_detected ? "bg-destructive" : "bg-success"}`} />
                        {vr.deforestation_detected ? "Detected" : "Clear"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {vr.confidence_score !== null ? `${(vr.confidence_score * 100).toFixed(0)}%` : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {vr.alert_date ? formatDate(vr.alert_date) : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(vr.validated_at)}
                    </TableCell>
                    <TableCell className="text-sm max-w-[200px] truncate">{vr.notes || "—"}</TableCell>
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

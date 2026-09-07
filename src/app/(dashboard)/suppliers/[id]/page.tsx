"use client";

import { use, useState } from "react";
import { DetailHeader } from "@/components/detail-header";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { ArrowLeft, Pencil, Trash2, ShieldCheck } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { SupplierForm } from "@/components/forms/supplier-form";
import { SupplierSourcingCard } from "@/components/sourcing/supplier-sourcing-card";
import { SupplierDataGapsCard } from "@/components/sourcing/supplier-data-gaps-card";
import type { BatchReadiness, PaginatedResponse, Supplier, KYCStatus, RiskRating } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const KYC_COLORS: Record<KYCStatus, { bg: string; text: string; dot: string; label: string }> = {
  PENDING: { bg: "bg-pending/10", text: "text-pending-foreground", dot: "bg-pending", label: "Pending" },
  VERIFIED: { bg: "bg-success/10", text: "text-success-foreground", dot: "bg-success", label: "Verified" },
  REJECTED: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "Rejected" },
  EXPIRED: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Expired" },
};

/** `suffixed` is the phrase this page shows; `label` is the bare badge text
 * the list page uses. They are separate because "Low"/"Standard"/"High" compose
 * with a trailing "Risk" and "Not assessed" does not — bolting the word on
 * produced "Not assessed Risk", describing the same supplier two different ways
 * on two screens, one of them ungrammatical, on a page an auditor reads. */
const RISK_COLORS: Record<
  RiskRating,
  { bg: string; text: string; dot: string; label: string; suffixed: string }
> = {
  NOT_ASSESSED: { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-muted-foreground", label: "Not assessed", suffixed: "Not assessed" },
  LOW: { bg: "bg-success/10", text: "text-success-foreground", dot: "bg-success", label: "Low", suffixed: "Low Risk" },
  STANDARD: { bg: "bg-warning/10", text: "text-warning-foreground", dot: "bg-warning", label: "Standard", suffixed: "Standard Risk" },
  HIGH: { bg: "bg-destructive/10", text: "text-destructive", dot: "bg-destructive", label: "High", suffixed: "High Risk" },
};

const TH = "text-xs font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

export default function SupplierDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  // Route params are attacker-controlled (e.g. a crafted link) — encode once
  // here and reuse everywhere `id` is interpolated into a fetch URL, so a
  // value like `sup-1&page_size=999999` can't smuggle extra query params
  // onto the request (PR #47 QA security finding).
  const encodedId = encodeURIComponent(id);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: supplier, isLoading, error } = useQuery<Supplier>({
    queryKey: ["supplier", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/suppliers/${encodedId}/`);
      if (!res.ok) throw new Error("Failed to fetch supplier");
      return res.json();
    },
  });

  // Sourcing-readiness rows for this supplier (sourcing-readiness.design-prompt.md
  // Prompt E, eudr-frontend #31) — the readiness list filtered by `seller_id`
  // (eudr-app PR #83's documented contract), fetched once here and passed
  // down to both the "Sourcing from this supplier" and "Data gaps" cards so
  // they share one fetch instead of duplicating it. Pilot-scale `page_size`
  // cap, same convention as the Sourcing list's own supplier/product lookups.
  const {
    data: readinessPos,
    isLoading: readinessLoading,
    error: readinessError,
  } = useQuery<BatchReadiness[]>({
    queryKey: ["batches-readiness", "supplier", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/supply-chain/batches/readiness/?seller_id=${encodedId}&page_size=100`);
      if (!res.ok) throw new Error("Failed to fetch supplier readiness");
      const body: PaginatedResponse<BatchReadiness> = await res.json();
      return body.results;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/suppliers/${encodedId}/`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["suppliers"] });
      router.push("/suppliers");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-2xl" />
        <Skeleton className="h-60 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/suppliers")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back to Suppliers
        </Button>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          Supplier not found or failed to load.
        </div>
      </div>
    );
  }

  const kyc = KYC_COLORS[supplier.kyc_status];
  const risk = RISK_COLORS[supplier.risk_rating];

  return (
    <div className="space-y-6">
      <DetailHeader
        back={{ href: "/suppliers", label: "All suppliers" }}
        eyebrow="Supplier"
        title={supplier.name}
        status={
          <>
            <Badge variant="secondary" className={`${kyc.bg} ${kyc.text} border-0 font-medium text-xs gap-1.5 px-2.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${kyc.dot}`} />
              {kyc.label}
            </Badge>
            <Badge variant="secondary" className={`${risk.bg} ${risk.text} border-0 font-medium text-xs gap-1.5 px-2.5`}>
              <span className={`w-1.5 h-1.5 rounded-full ${risk.dot}`} />
              {risk.suffixed}
            </Badge>
          </>
        }
        context={supplier.country_of_origin}
        actions={
          <>
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" /> Edit
            </Button>
            <Button
              variant="destructive"
              size="sm"
              className="gap-1.5"
              disabled={deleteMutation.isPending}
              onClick={() => { if (confirm("Delete this supplier?")) deleteMutation.mutate(); }}
            >
              <Trash2 className="size-3.5" /> Delete
            </Button>
          </>
        }
      />

      {/* Record card: the fields that do not fit a one-line context */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">External ID</p>
            <p className="font-mono text-xs">{supplier.external_id || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">KYC Verified</p>
            <p className="text-xs">{supplier.kyc_verified_at ? formatDate(supplier.kyc_verified_at) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Created</p>
            <p className="text-xs">{formatDate(supplier.created_at)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Updated</p>
            <p className="text-xs">{formatDate(supplier.updated_at)}</p>
          </div>
        </div>
      </div>

      {/* Sourcing from this supplier (Prompt E) — full-width, directly under
       * the header, ahead of certifications: for this persona, sourcing
       * coverage outranks certificates. */}
      <SupplierSourcingCard pos={readinessPos ?? []} isLoading={readinessLoading} error={!!readinessError} />

      {/* Data gaps (Prompt E) — supplier-level blockers aggregated from the
       * same readiness rows. */}
      <SupplierDataGapsCard supplierId={supplier.id} pos={readinessPos ?? []} />

      {/* Certifications — moved below Sourcing/Data gaps (Prompt E). */}
      <div>
        <h2 className="text-sm font-medium mb-3 flex items-center gap-2">
          <ShieldCheck className="size-4 text-muted-foreground" />
          Certifications
        </h2>
        {supplier.certifications && supplier.certifications.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className={TH}>Type</TableHead>
                  <TableHead className={TH}>Certificate #</TableHead>
                  <TableHead className={TH}>Issuing Body</TableHead>
                  <TableHead className={TH}>Valid From</TableHead>
                  <TableHead className={TH}>Valid Until</TableHead>
                  <TableHead className={TH}>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {supplier.certifications.map((cert) => (
                  <TableRow key={cert.id} className="border-border/30">
                    <TableCell className="text-sm font-medium">{cert.certification_type}</TableCell>
                    <TableCell className="text-sm font-mono">{cert.certificate_number}</TableCell>
                    <TableCell className="text-sm">{cert.issuing_body}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(cert.valid_from)}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">{formatDate(cert.valid_until)}</TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`border-0 font-medium text-xs gap-1.5 px-2.5 ${
                          cert.is_valid
                            ? "bg-success/10 text-success-foreground"
                            : "bg-destructive/10 text-destructive"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${cert.is_valid ? "bg-success" : "bg-destructive"}`} />
                        {cert.is_valid ? "Valid" : "Expired"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No certifications on file</p>
          </div>
        )}
      </div>

      <SupplierForm open={editOpen} onOpenChange={setEditOpen} supplier={supplier} />
    </div>
  );
}

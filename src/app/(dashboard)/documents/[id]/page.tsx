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
import { ArrowLeft, Pencil, Archive, Lock } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { DocumentForm } from "@/components/forms/document-form";
import type { Document, DocumentType } from "@/lib/api/types";
import { formatDate } from "@/lib/format";

const TYPE_LABEL: Record<DocumentType, string> = {
  SUPPLIER_DECLARATION: "Supplier Declaration",
  LAND_TITLE: "Land Title",
  CERTIFICATION: "Certification",
  AUDIT_REPORT: "Audit Report",
  SATELLITE_IMAGE: "Satellite Image",
  DDS_EXPORT: "DDS Export",
  KYC_DOCUMENT: "KYC Document",
  TRANSPORT_DOCUMENT: "Transport Document",
  OTHER: "Other",
};

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const TH = "text-xs font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

export default function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();
  const [editOpen, setEditOpen] = useState(false);

  const { data: doc, isLoading, error } = useQuery<Document>({
    queryKey: ["documents", id],
    queryFn: async () => {
      const res = await authFetch(`/api/v1/documents/${id}/`);
      if (!res.ok) throw new Error("Failed to fetch document");
      return res.json();
    },
  });

  const archiveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/documents/${id}/archive/`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to archive");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents", id] });
      queryClient.invalidateQueries({ queryKey: ["documents"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(`/api/v1/documents/${id}/`, { method: "DELETE" });
      if (!res.ok && res.status !== 204) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      router.push("/documents");
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/documents")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Back
        </Button>
        <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-3 border border-destructive/15">
          Document not found or failed to load.
        </div>
      </div>
    );
  }

  const isPending = archiveMutation.isPending || deleteMutation.isPending;

  return (
    <div className="space-y-6">
      <DetailHeader
        back={{ href: "/documents", label: "All documents" }}
        eyebrow="Document"
        title={doc.title}
        status={
          <>
            {doc.is_confidential && (
              <Badge variant="secondary" className="bg-warning/10 text-warning-foreground border-0 font-medium text-xs gap-1.5 px-2.5">
                <Lock className="size-3" />
                Confidential
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={`border-0 font-medium text-xs gap-1.5 px-2.5 ${
                doc.is_archived
                  ? "bg-muted text-muted-foreground"
                  : "bg-success/10 text-success-foreground"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${doc.is_archived ? "bg-muted-foreground" : "bg-success"}`} />
              {doc.is_archived ? "Archived" : "Active"}
            </Badge>
          </>
        }
        context={TYPE_LABEL[doc.document_type] ?? doc.document_type}
        actions={
          !doc.is_archived ? (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" /> Edit
            </Button>
          ) : null
        }
      />

      {/* Record card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-card">
        {doc.description && (
          <p className="text-sm text-muted-foreground mb-4">{doc.description}</p>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">MIME Type</p>
            <p className="text-xs font-mono">{doc.mime_type || "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">File Size</p>
            <p className="text-xs">{formatBytes(doc.file_size_bytes)}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Archival Deadline</p>
            <p className="text-xs">{doc.archival_deadline ? formatDate(doc.archival_deadline) : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Uploaded</p>
            <p className="text-xs">{formatDate(doc.uploaded_at)}</p>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border/50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Storage Key</p>
              <p className="text-xs font-mono break-all">{doc.storage_key || "—"}</p>
            </div>
            <div>
              <p className="text-muted-foreground text-xs mb-0.5">Checksum (SHA-256)</p>
              <p className="text-xs font-mono break-all">{doc.checksum_sha256 || "—"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2">
        {!doc.is_archived && (
          <Button
            size="sm"
            variant="secondary"
            disabled={isPending}
            onClick={() => {
              if (confirm("Archive this document? This cannot be undone.")) {
                archiveMutation.mutate();
              }
            }}
            className="gap-1.5"
          >
            <Archive className="size-3.5" />
            Archive
          </Button>
        )}
        <Button
          size="sm"
          variant="destructive"
          disabled={isPending}
          onClick={() => {
            if (confirm("Delete this document permanently?")) {
              deleteMutation.mutate();
            }
          }}
        >
          Delete
        </Button>
        {(archiveMutation.error || deleteMutation.error) && (
          <span className="text-xs text-destructive self-center">
            {((archiveMutation.error || deleteMutation.error) as Error).message}
          </span>
        )}
      </div>

      {/* Version history */}
      <div>
        <h2 className="text-sm font-medium mb-3">Version history</h2>
        {doc.versions && doc.versions.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-card">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent border-border/50">
                  <TableHead className={TH}>Version</TableHead>
                  <TableHead className={TH}>Size</TableHead>
                  <TableHead className={TH}>Checksum</TableHead>
                  <TableHead className={TH}>Notes</TableHead>
                  <TableHead className={TH}>Uploaded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.versions.map((v) => (
                  <TableRow key={v.id} className="border-border/30">
                    <TableCell className="text-sm font-mono font-medium">v{v.version_number}</TableCell>
                    <TableCell className="text-sm">{formatBytes(v.file_size_bytes)}</TableCell>
                    <TableCell className="text-sm font-mono text-muted-foreground max-w-[120px] truncate">
                      {v.checksum_sha256 ? v.checksum_sha256.slice(0, 12) + "…" : "—"}
                    </TableCell>
                    <TableCell className="text-sm">{v.change_notes || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDate(v.uploaded_at)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="rounded-2xl border border-border/50 bg-card p-8 text-center">
            <p className="text-sm text-muted-foreground">No versions recorded</p>
          </div>
        )}
      </div>

      {doc.archived_at && (
        <div className="text-xs text-muted-foreground">
          Archived: {formatDate(doc.archived_at)}
        </div>
      )}

      <DocumentForm open={editOpen} onOpenChange={setEditOpen} document={doc} />
    </div>
  );
}

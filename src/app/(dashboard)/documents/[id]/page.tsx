"use client";

import { use, useState } from "react";
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
import { ArrowLeft, Pencil, FolderOpen, Archive, Lock } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { DocumentForm } from "@/components/forms/document-form";
import type { Document, DocumentType } from "@/lib/api/types";

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

const TH = "text-[11px] font-medium tracking-[0.12em] uppercase text-muted-foreground/70 h-11";

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
      {/* Back + Actions */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" size="sm" onClick={() => router.push("/documents")} className="gap-1.5">
          <ArrowLeft className="size-4" /> Documents
        </Button>
        <div className="flex gap-2">
          {!doc.is_archived && (
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(true)} className="gap-1.5">
              <Pencil className="size-3.5" /> Edit
            </Button>
          )}
        </div>
      </div>

      {/* Header Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#6366F1]/10 flex items-center justify-center">
              <FolderOpen className="size-5 text-[#6366F1]" />
            </div>
            <div>
              <h1 className="text-xl font-medium">{doc.title}</h1>
              <p className="text-sm text-muted-foreground">{TYPE_LABEL[doc.document_type] ?? doc.document_type}</p>
            </div>
          </div>
          <div className="flex gap-2">
            {doc.is_confidential && (
              <Badge variant="secondary" className="bg-[#E8C468]/10 text-[#9A7D2E] border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5">
                <Lock className="size-3" />
                Confidential
              </Badge>
            )}
            <Badge
              variant="secondary"
              className={`border-0 rounded-lg font-medium text-[11px] gap-1.5 px-2.5 ${
                doc.is_archived
                  ? "bg-muted text-muted-foreground"
                  : "bg-[#34D399]/10 text-[#1A6B5A]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${doc.is_archived ? "bg-muted-foreground" : "bg-[#34D399]"}`} />
              {doc.is_archived ? "Archived" : "Active"}
            </Badge>
          </div>
        </div>

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
            <p className="text-xs">{doc.archival_deadline ? new Date(doc.archival_deadline).toLocaleDateString() : "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground text-xs mb-0.5">Uploaded</p>
            <p className="text-xs">{new Date(doc.uploaded_at).toLocaleDateString()}</p>
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

      {/* Version History */}
      <div>
        <h2 className="text-sm font-medium mb-3">Version History</h2>
        {doc.versions && doc.versions.length > 0 ? (
          <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
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
                    <TableCell className="text-[13px] font-mono font-medium">v{v.version_number}</TableCell>
                    <TableCell className="text-[13px]">{formatBytes(v.file_size_bytes)}</TableCell>
                    <TableCell className="text-[13px] font-mono text-muted-foreground max-w-[120px] truncate">
                      {v.checksum_sha256 ? v.checksum_sha256.slice(0, 12) + "…" : "—"}
                    </TableCell>
                    <TableCell className="text-[13px]">{v.change_notes || "—"}</TableCell>
                    <TableCell className="text-muted-foreground text-[13px]">
                      {new Date(v.uploaded_at).toLocaleDateString()}
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
          Archived: {new Date(doc.archived_at).toLocaleDateString()}
        </div>
      )}

      <DocumentForm open={editOpen} onOpenChange={setEditOpen} document={doc} />
    </div>
  );
}

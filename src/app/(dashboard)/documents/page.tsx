"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FolderOpen, FileQuestion, Plus } from "lucide-react";
import { DataTable, type ColumnDef, type FilterDef } from "@/components/data-table";
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

const columns: ColumnDef<Document>[] = [
  {
    key: "title",
    header: "Title",
    sortable: true,
    render: (doc) => (
      <div className="flex items-center gap-2.5">
        <div className="w-7 h-7 rounded-lg bg-[#6366F1]/10 flex items-center justify-center shrink-0">
          <FolderOpen className="size-3.5 text-[#6366F1]" />
        </div>
        <span className="font-medium text-[13px]">{doc.title}</span>
      </div>
    ),
  },
  {
    key: "document_type",
    header: "Type",
    sortable: true,
    render: (doc) => (
      <span className="text-[13px]">{TYPE_LABEL[doc.document_type] ?? doc.document_type}</span>
    ),
  },
  {
    key: "mime_type",
    header: "Format",
    render: (doc) => (
      <span className="text-muted-foreground text-xs font-mono">{doc.mime_type || "—"}</span>
    ),
  },
  {
    key: "file_size_bytes",
    header: "Size",
    sortable: true,
    render: (doc) => (
      <span className="text-muted-foreground text-[13px]">{formatBytes(doc.file_size_bytes)}</span>
    ),
  },
  {
    key: "is_archived",
    header: "Status",
    render: (doc) => (
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
    ),
  },
  {
    key: "uploaded_at",
    header: "Uploaded",
    sortable: true,
    render: (doc) => (
      <span className="text-muted-foreground text-[13px]">
        {new Date(doc.uploaded_at).toLocaleDateString()}
      </span>
    ),
  },
];

const filters: FilterDef[] = [
  {
    key: "document_type",
    label: "All Types",
    options: [
      { label: "Supplier Declaration", value: "SUPPLIER_DECLARATION" },
      { label: "Land Title", value: "LAND_TITLE" },
      { label: "Certification", value: "CERTIFICATION" },
      { label: "Audit Report", value: "AUDIT_REPORT" },
      { label: "Satellite Image", value: "SATELLITE_IMAGE" },
      { label: "DDS Export", value: "DDS_EXPORT" },
      { label: "KYC Document", value: "KYC_DOCUMENT" },
      { label: "Transport Document", value: "TRANSPORT_DOCUMENT" },
      { label: "Other", value: "OTHER" },
    ],
  },
  {
    key: "is_archived",
    label: "All Statuses",
    options: [
      { label: "Active", value: "false" },
      { label: "Archived", value: "true" },
    ],
  },
];

export default function DocumentsPage() {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-display text-2xl font-light italic mb-0.5">Documents</h1>
          <p className="text-sm text-muted-foreground">Compliance documents &amp; archival records</p>
        </div>
        <Button onClick={() => setFormOpen(true)} className="gap-1.5">
          <Plus className="size-4" />
          Add Document
        </Button>
      </div>

      <DataTable<Document>
        queryKey="documents"
        endpoint="/api/v1/documents/"
        columns={columns}
        filters={filters}
        searchPlaceholder="Search documents..."
        rowKey={(doc) => doc.id}
        onRowClick={(doc) => router.push(`/documents/${doc.id}`)}
        emptyIcon={<FileQuestion className="w-5 h-5 text-muted-foreground" />}
        emptyTitle="No documents yet"
        emptyDescription="Upload compliance documents to maintain your EUDR archival records"
      />

      <DocumentForm open={formOpen} onOpenChange={setFormOpen} />
    </div>
  );
}

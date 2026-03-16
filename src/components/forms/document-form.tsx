"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { authFetch } from "@/lib/api/client";
import type { Document } from "@/lib/api/types";

const documentSchema = z.object({
  title: z.string().min(1, "Title is required"),
  document_type: z.enum([
    "SUPPLIER_DECLARATION",
    "LAND_TITLE",
    "CERTIFICATION",
    "AUDIT_REPORT",
    "SATELLITE_IMAGE",
    "DDS_EXPORT",
    "KYC_DOCUMENT",
    "TRANSPORT_DOCUMENT",
    "OTHER",
  ]),
  description: z.string().optional(),
  storage_key: z.string().min(1, "Storage key is required"),
  storage_bucket: z.string().min(1, "Storage bucket is required"),
  mime_type: z.string().optional(),
  file_size_bytes: z.number().nonnegative().nullable().optional(),
  is_confidential: z.boolean().optional(),
  archival_deadline: z.string().optional(),
});

type DocumentFormValues = z.infer<typeof documentSchema>;

interface DocumentFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document?: Document | null;
}

export function DocumentForm({ open, onOpenChange, document }: DocumentFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!document;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<DocumentFormValues>({
    resolver: zodResolver(documentSchema),
    defaultValues: document
      ? {
          title: document.title,
          document_type: document.document_type,
          description: document.description || "",
          storage_key: document.storage_key || "",
          storage_bucket: document.storage_bucket || "",
          mime_type: document.mime_type || "",
          file_size_bytes: document.file_size_bytes,
          is_confidential: document.is_confidential,
          archival_deadline: document.archival_deadline?.split("T")[0] || "",
        }
      : {
          title: "",
          document_type: "OTHER",
          description: "",
          storage_key: "",
          storage_bucket: "eudr-documents",
          mime_type: "",
          file_size_bytes: null,
          is_confidential: false,
          archival_deadline: "",
        },
  });

  const mutation = useMutation({
    mutationFn: async (values: DocumentFormValues) => {
      const url = isEditing
        ? `/api/v1/documents/${document.id}/`
        : "/api/v1/documents/";
      const res = await authFetch(url, {
        method: isEditing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err) || "Failed to save document");
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["documents"] });
      onOpenChange(false);
      reset();
    },
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{isEditing ? "Edit Document" : "Add Document"}</SheetTitle>
          <SheetDescription>
            {isEditing ? "Update document metadata." : "Register a new compliance document."}
          </SheetDescription>
        </SheetHeader>

        <form
          onSubmit={handleSubmit((v) => mutation.mutate(v))}
          className="flex flex-col gap-4 px-4 flex-1 overflow-y-auto"
        >
          <div className="space-y-1.5">
            <Label htmlFor="title">Title *</Label>
            <Input id="title" {...register("title")} placeholder="e.g. Supplier KYC Certificate" />
            {errors.title && <p className="text-xs text-destructive">{errors.title.message}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="document_type">Document Type *</Label>
            <select
              id="document_type"
              {...register("document_type")}
              className="w-full h-9 rounded-xl border border-border/60 bg-secondary/50 px-3 text-[13px] text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
            >
              <option value="SUPPLIER_DECLARATION">Supplier Declaration</option>
              <option value="LAND_TITLE">Land Title</option>
              <option value="CERTIFICATION">Certification</option>
              <option value="AUDIT_REPORT">Audit Report</option>
              <option value="SATELLITE_IMAGE">Satellite Image</option>
              <option value="DDS_EXPORT">DDS Export</option>
              <option value="KYC_DOCUMENT">KYC Document</option>
              <option value="TRANSPORT_DOCUMENT">Transport Document</option>
              <option value="OTHER">Other</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Brief description of the document…"
              rows={3}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="storage_key">Storage Key *</Label>
            <Input id="storage_key" {...register("storage_key")} placeholder="e.g. docs/2025/kyc-cert.pdf" className="font-mono text-xs" />
            {errors.storage_key && <p className="text-xs text-destructive">{errors.storage_key.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="storage_bucket">Bucket *</Label>
              <Input id="storage_bucket" {...register("storage_bucket")} placeholder="eudr-documents" className="font-mono text-xs" />
              {errors.storage_bucket && <p className="text-xs text-destructive">{errors.storage_bucket.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="mime_type">MIME Type</Label>
              <Input id="mime_type" {...register("mime_type")} placeholder="application/pdf" className="font-mono text-xs" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="file_size_bytes">File Size (bytes)</Label>
              <Input id="file_size_bytes" type="number" {...register("file_size_bytes", { valueAsNumber: true })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="archival_deadline">Archival Deadline</Label>
              <Input id="archival_deadline" type="date" {...register("archival_deadline")} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="is_confidential"
              type="checkbox"
              {...register("is_confidential")}
              className="rounded border-border/60"
            />
            <Label htmlFor="is_confidential" className="text-[13px]">
              Confidential — not shared with partners
            </Label>
          </div>

          {mutation.error && (
            <p className="text-xs text-destructive">{(mutation.error as Error).message}</p>
          )}

          <SheetFooter className="px-0">
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEditing ? "Update" : "Create"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

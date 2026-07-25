"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Ship } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AgendaRow } from "@/components/shipments/agenda-row";
import { bucketConsignments } from "@/lib/consignment-agenda";
import { authFetch } from "@/lib/api/client";
import { cn } from "@/lib/utils";
import type { ConsignmentRow } from "@/lib/api/types";

export function ShipmentsAgenda({
  rag,
  search,
  canWrite,
}: {
  rag: string;
  search: string;
  canWrite: boolean;
}) {
  const { data, isLoading, error } = useQuery<ConsignmentRow[]>({
    queryKey: ["shipments-agenda", { rag, search }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (rag) params.set("rag", rag);
      if (search) params.set("search", search);
      const qs = params.toString();
      const res = await authFetch(
        `/api/v1/supply-chain/consignments/agenda/${qs ? `?${qs}` : ""}`,
      );
      if (!res.ok) throw new Error("Failed to fetch agenda");
      return res.json();
    },
    staleTime: 60_000,
  });

  const buckets = useMemo(() => bucketConsignments(data ?? []), [data]);

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded-xl border border-destructive/15 bg-destructive/8 px-4 py-3 text-sm text-destructive">
        Failed to load the arrival agenda.
      </div>
    );
  }
  if (buckets.length === 0) {
    const filtered = !!(rag || search);
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 py-12 text-center">
        <Ship className="size-5 text-muted-foreground" />
        <p className="text-sm font-medium">
          {filtered ? "No consignments match these filters" : "Nothing arriving that needs a DDS"}
        </p>
        <p className="text-sm text-muted-foreground">
          {filtered
            ? "Try adjusting the status or search."
            : "Consignments landing in the next 90 days with an open DDS will appear here."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {buckets.map((bucket) => (
        <section key={bucket.key}>
          <h2 className="mb-1 flex items-baseline gap-2 text-sm font-semibold">
            <span className={cn(bucket.key === "overdue" && "text-destructive")}>{bucket.label}</span>
            <span className="text-xs font-normal text-muted-foreground">· {bucket.rows.length}</span>
          </h2>
          <div className="divide-y divide-border/40">
            {bucket.rows.map((c) => (
              <AgendaRow key={c.id} c={c} canWrite={canWrite} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

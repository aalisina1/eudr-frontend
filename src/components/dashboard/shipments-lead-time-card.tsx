"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Ship } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/api/client";
import type { ConsignmentSummary } from "@/lib/api/types";

const CHIPS: { key: keyof ConsignmentSummary; label: string; className: string }[] = [
  { key: "red", label: "Red", className: "border-destructive/40 text-destructive" },
  { key: "amber", label: "Amber", className: "border-accent/55 text-accent" },
  { key: "gray", label: "Gray", className: "border-border text-muted-foreground" },
  { key: "green", label: "Green", className: "border-primary/45 text-primary" },
];

/** Dashboard lead-time alert (spec Decision 8 ⑥-card / shipments.md [UX
 * decision]): a stat line, not a chart. Headline =
 * `landing_within_red_window_uncovered`, click-through to the RED-pre-filtered
 * list; a muted red/amber/gray/green chip strip beneath. */
export function ShipmentsLeadTimeCard() {
  const { data, isLoading } = useQuery<ConsignmentSummary>({
    queryKey: ["dashboard", "consignments-summary"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/supply-chain/consignments/summary/");
      if (!res.ok) throw new Error("Failed to load shipments summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  const n = data?.landing_within_red_window_uncovered ?? 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Ship className="size-4 text-muted-foreground" /> Shipment lead time
        </CardTitle>
        <CardDescription>Consignments approaching customs clearance without a complete DDS.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <Skeleton className="h-7 w-64" />
        ) : (
          <Link href="/shipments?rag=RED" className="inline-flex items-baseline gap-2 hover:underline">
            <span className={`text-2xl font-semibold ${n > 0 ? "text-destructive" : "text-foreground"}`}>{n}</span>
            <span className="text-sm text-muted-foreground">
              consignment{n === 1 ? "" : "s"} land within 10 days with incomplete DDS
            </span>
          </Link>
        )}
        {data && (
          <div className="flex flex-wrap gap-1.5">
            {CHIPS.map((c) => (
              <span key={c.key} className={`rounded-full border px-2.5 py-0.5 text-[11.5px] ${c.className}`}>
                {data[c.key]} {c.label}
              </span>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

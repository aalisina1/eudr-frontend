"use client";

import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

interface PoProvenanceCardProps {
  supplierId: string;
  supplierName?: string;
  countryOfOrigin?: string;
  plotCount: number;
  lotCount: number;
}

/** PO Detail compact "Provenance" card — a plots-map placeholder (real
 * rendering is out of scope for this issue; the design snapshot itself
 * specs a `Skeleton` "Map renders at runtime" placeholder here) plus the
 * supplier link and a plots/lots summary line. */
export function PoProvenanceCard({ supplierId, supplierName, countryOfOrigin, plotCount, lotCount }: PoProvenanceCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Provenance</CardTitle>
        <CardDescription>Where this order&apos;s commodity is grown</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-stretch gap-5">
        <div className="relative h-[130px] w-full max-w-[300px] shrink-0 overflow-hidden rounded-xl">
          <Skeleton className="h-full w-full" />
          <span className="absolute inset-0 flex items-center justify-center gap-1.5 font-mono text-[11px] tracking-wider text-muted-foreground uppercase">
            <MapPin className="size-3.5" /> Map renders at runtime
          </span>
        </div>
        <div className="flex min-w-[220px] flex-col justify-center gap-2">
          <Link
            href={`/suppliers/${supplierId}`}
            className="inline-flex items-center gap-1.5 text-[14.5px] font-semibold text-foreground hover:underline"
          >
            {supplierName ?? "Supplier"} <ArrowRight className="size-3.5 text-primary" />
          </Link>
          {countryOfOrigin && <span className="text-[13px] text-muted-foreground">{countryOfOrigin}</span>}
          <span className="text-[13px] text-muted-foreground">
            <span className="font-mono text-foreground">{plotCount}</span> plots across{" "}
            <span className="font-mono text-foreground">{lotCount}</span> lot{lotCount === 1 ? "" : "s"}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

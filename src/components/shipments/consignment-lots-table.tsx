"use client";

import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StageBadge } from "@/components/sourcing/stage-badge";
import { UNIT_LABELS } from "@/lib/readiness-format";
import type { ConsignmentLot } from "@/lib/api/types";

const COLUMN_COUNT = 5;

/** Covering-DDS cell — mirrors po-lots-table's `DdsCell`: link when covered,
 * muted "Not covered" otherwise. */
function DdsCell({ lot }: { lot: ConsignmentLot }) {
  if (lot.covered && lot.covering_dds_id) {
    return (
      <Link
        href={`/due-diligence/${lot.covering_dds_id}`}
        className="font-mono text-xs font-medium whitespace-nowrap text-primary hover:underline"
      >
        {lot.covering_dds_reference || lot.covering_dds_id}
      </Link>
    );
  }
  return <span className="text-[12.5px] text-muted-foreground">Not covered</span>;
}

/** Deep-link to the blocker for an uncovered lot (shipments.md journey step 5,
 * same intent as po-lots-table's BLOCKER_ACTIONS). An ALLOCATED lot's blocker
 * is incomplete plots → /plots; a PLOTS_COMPLETE-but-uncovered lot just needs a
 * DDS (the header's Compose DDS button handles that), so no per-row link. */
function ResolveCell({ lot }: { lot: ConsignmentLot }) {
  if (lot.covered || lot.stage !== "ALLOCATED") return null;
  return (
    <Link href="/plots" className="text-[12.5px] font-medium text-primary hover:underline">
      Complete plots
    </Link>
  );
}

export function ConsignmentLotsTable({ lots }: { lots: ConsignmentLot[] }) {
  return (
    <Card id="lots">
      <CardHeader>
        <CardTitle>Lots in this consignment</CardTitle>
        <CardDescription>
          {lots.length} lot{lots.length === 1 ? "" : "s"} · {lots.filter((l) => l.covered).length} covered
        </CardDescription>
      </CardHeader>
      <CardContent className="px-1.5 pb-3.5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot ref</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Stage</TableHead>
              <TableHead>DDS</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-6 text-center text-sm text-muted-foreground">
                  No lots assigned to this consignment yet.
                </TableCell>
              </TableRow>
            ) : (
              lots.map((lot) => {
                const unitLabel = UNIT_LABELS[lot.unit] ?? lot.unit.toLowerCase();
                return (
                  <TableRow key={lot.id}>
                    <TableCell>
                      <span className="font-mono text-[13px] font-medium">{lot.reference_number}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {Math.round(Number(lot.quantity)).toLocaleString()} {unitLabel}
                    </TableCell>
                    <TableCell><StageBadge stage={lot.stage} /></TableCell>
                    <TableCell><DdsCell lot={lot} /></TableCell>
                    <TableCell className="text-right"><ResolveCell lot={lot} /></TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
          {lots.length === 0 && <TableCaption>No lots yet</TableCaption>}
        </Table>
      </CardContent>
    </Card>
  );
}

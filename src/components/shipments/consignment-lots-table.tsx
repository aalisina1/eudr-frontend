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
import { Button } from "@/components/ui/button";
import { StageBadge } from "@/components/sourcing/stage-badge";
import { UNIT_LABELS } from "@/lib/readiness-format";
import type { ConsignmentLot } from "@/lib/api/types";
import { formatNumber } from "@/lib/format";

const COLUMN_COUNT = 7;

/** Covering-DDS cell — mirrors po-lots-table's `DdsCell`: link when covered,
 * muted "Not covered" otherwise. */
function DdsCell({ lot }: { lot: ConsignmentLot }) {
  if (lot.covered && lot.covering_dds_id) {
    return (
      <Link
        href={`/submissions/${lot.covering_dds_id}`}
        className="font-mono text-xs font-medium whitespace-nowrap text-primary hover:underline"
      >
        {lot.covering_dds_reference || lot.covering_dds_id}
      </Link>
    );
  }
  return <span className="text-sm text-muted-foreground">Not covered</span>;
}

/** Resolve action for an uncovered lot (shipments.md journey step 5, same
 * intent as po-lots-table's BLOCKER_ACTIONS). An ALLOCATED lot's blocker is
 * incomplete plots — opens `AssignPlotsSheet` in place (issue #78: this used
 * to `<Link href="/plots">`, a dead end — a plot LIST with no way to assign a
 * plot to this lot and no way back). A PLOTS_COMPLETE-but-uncovered lot just
 * needs a DDS (the header's Compose DDS button handles that), so no per-row
 * action. Write-only affordance: absent from the DOM (not disabled) unless
 * `canWrite`. */
function ResolveCell({
  lot,
  canWrite,
  onCompletePlots,
}: {
  lot: ConsignmentLot;
  canWrite: boolean;
  onCompletePlots: (lot: ConsignmentLot) => void;
}) {
  if (lot.covered || lot.stage !== "ALLOCATED" || !canWrite) return null;
  return (
    <Button
      type="button"
      variant="link"
      size="sm"
      className="h-auto p-0 text-sm font-medium"
      onClick={() => onCompletePlots(lot)}
    >
      Complete plots
    </Button>
  );
}

interface ConsignmentLotsTableProps {
  lots: ConsignmentLot[];
  /** Write-only affordance gate (ADMIN/COMPLIANCE_OFFICER) — the "Complete
   * plots" action is absent from the DOM entirely for VIEWER. */
  canWrite: boolean;
  onCompletePlots: (lot: ConsignmentLot) => void;
}

export function ConsignmentLotsTable({ lots, canWrite, onCompletePlots }: ConsignmentLotsTableProps) {
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
              <TableHead>Purchase order</TableHead>
              <TableHead>Plots</TableHead>
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
                      <span className="font-mono text-sm font-medium">{lot.reference_number}</span>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatNumber(Math.round(Number(lot.quantity)))} {unitLabel}
                    </TableCell>
                    {/* #134: the order this lot fulfils and the plots it traces to. */}
                    <TableCell>
                      {lot.po_id ? (
                        <Link href={`/sourcing/${lot.po_id}`} className="font-mono text-sm text-primary hover:underline">
                          {lot.po_reference || lot.po_id}
                        </Link>
                      ) : (
                        <span className="text-sm text-muted-foreground">No order</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {(lot.plot_ids?.length ?? 0) === 1 ? "1 plot" : `${lot.plot_ids?.length ?? 0} plots`}
                    </TableCell>
                    <TableCell><StageBadge stage={lot.stage} /></TableCell>
                    <TableCell><DdsCell lot={lot} /></TableCell>
                    <TableCell className="text-right">
                      <ResolveCell lot={lot} canWrite={canWrite} onCompletePlots={onCompletePlots} />
                    </TableCell>
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

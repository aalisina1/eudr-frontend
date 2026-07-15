"use client";

import { Fragment, type ReactNode } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
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
import { DeadlineChip } from "@/components/sourcing/deadline-chip";
import type { LotReadiness } from "@/lib/api/types";

const UNIT_LABELS: Record<string, string> = { KG: "kg", TONNES: "t", M3: "m³", PIECES: "pcs" };

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  return Math.round((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
}

function formatEta(dateStr: string): string {
  // `timeZone: "UTC"` — these are date-only (`DateField`) values; `new
  // Date("2025-10-01")` parses as UTC midnight, so formatting in the
  // viewer's local zone can roll the displayed calendar day (and even
  // month) backward west of UTC. Force UTC so the date always reads as
  // the day the backend actually stored.
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
}

/** "Oct – Dec 2025" (design vocabulary) from the lot's harvest period dates;
 * `null` when the start date is missing (renders the destructive "Missing"
 * badge instead). Dates are formatted in UTC — see `formatEta`'s note. */
function formatHarvestPeriod(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const s = new Date(start);
  const monthLabel = (d: Date) => d.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  if (!end || end === start) return `${monthLabel(s)} ${s.getUTCFullYear()}`;
  const e = new Date(end);
  return s.getUTCFullYear() === e.getUTCFullYear()
    ? `${monthLabel(s)} – ${monthLabel(e)} ${e.getUTCFullYear()}`
    : `${monthLabel(s)} ${s.getUTCFullYear()} – ${monthLabel(e)} ${e.getUTCFullYear()}`;
}

function PlotsCell({ lot }: { lot: LotReadiness }) {
  const label = `${lot.plot_count} plot${lot.plot_count === 1 ? "" : "s"}`;
  let badge: ReactNode;
  if (lot.plot_count === 0) {
    badge = <Badge variant="destructive">Missing</Badge>;
  } else if (lot.plots_failed_count > 0) {
    badge = <Badge variant="destructive">{lot.plots_failed_count} failed</Badge>;
  } else if (lot.plots_pending_count > 0) {
    badge = <Badge variant="secondary">{lot.plots_pending_count} pending</Badge>;
  } else if (lot.plots_resolved) {
    badge = (
      <Badge variant="outline" className="gap-1 border-primary/40 text-primary">
        <Check className="size-2.5" /> Validated
      </Badge>
    );
  } else {
    badge = <Badge variant="destructive">Unresolved</Badge>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="text-[12.5px] text-muted-foreground">{label}</span>
      {badge}
    </span>
  );
}

function DdsCell({ lot }: { lot: LotReadiness }) {
  if (lot.filed && lot.filing_dds_id) {
    return (
      <Link
        href={`/due-diligence/${lot.filing_dds_id}`}
        className="font-mono text-xs font-medium whitespace-nowrap text-primary hover:underline"
      >
        {lot.filing_dds_reference || lot.filing_dds_id}
      </Link>
    );
  }
  return <span className="text-[12.5px] text-muted-foreground">Not filed</span>;
}

function LotRow({ lot }: { lot: LotReadiness }) {
  const unitLabel = UNIT_LABELS[lot.unit] ?? lot.unit.toLowerCase();
  const harvest = formatHarvestPeriod(lot.harvest_period_start, lot.harvest_period_end);
  return (
    <TableRow>
      <TableCell>
        <span className="font-mono text-[13px] font-medium">{lot.reference_number}</span>
      </TableCell>
      <TableCell className="text-right font-mono">
        {Math.round(Number(lot.quantity)).toLocaleString()} {unitLabel}
      </TableCell>
      <TableCell>
        {harvest ? <span className="text-[13px]">{harvest}</span> : <Badge variant="destructive">Missing</Badge>}
      </TableCell>
      <TableCell>
        <PlotsCell lot={lot} />
      </TableCell>
      <TableCell>
        <DdsCell lot={lot} />
      </TableCell>
    </TableRow>
  );
}

/** A "shipment" cluster of lots — grouped by `shipment_reference` when the
 * backend provides it per-lot (see the `LotReadiness.shipment_reference`
 * FOLLOW-UP note in `types.ts`). `label === null` means "don't render a
 * group header row for this cluster" — used both for the graceful
 * single-implicit-group fallback (today's live API) and to avoid a
 * redundant header when every lot shares the same (or no) shipment. */
interface ShipmentGroup {
  key: string;
  label: string | null;
  deadline: string | null;
  lots: LotReadiness[];
}

function groupByShipment(lots: LotReadiness[]): ShipmentGroup[] {
  const hasShipmentData = lots.some((l) => l.shipment_reference);
  if (!hasShipmentData) {
    return [{ key: "__all__", label: null, deadline: null, lots }];
  }

  const order: string[] = [];
  const byKey = new Map<string, LotReadiness[]>();
  for (const lot of lots) {
    const key = lot.shipment_reference || "__unassigned__";
    if (!byKey.has(key)) {
      byKey.set(key, []);
      order.push(key);
    }
    byKey.get(key)!.push(lot);
  }

  return order.map((key) => {
    const groupLots = byKey.get(key)!;
    const dates = groupLots.map((l) => l.expected_clearance_date).filter((d): d is string => Boolean(d));
    const deadline = dates.length ? dates.slice().sort()[0] : null;
    return {
      key,
      label: key === "__unassigned__" ? "No shipment assigned" : key,
      deadline,
      lots: groupLots,
    };
  });
}

const COLUMN_COUNT = 5;

function GroupHeaderRow({ group }: { group: ShipmentGroup }) {
  if (group.label === null) return null;
  const days = daysUntil(group.deadline);
  return (
    <TableRow className="bg-foreground/4 hover:bg-foreground/4">
      <TableCell colSpan={COLUMN_COUNT} className="py-1.5">
        <span className="inline-flex items-center gap-3">
          <span className="text-[12.5px] font-semibold">{group.label}</span>
          {group.deadline && <DeadlineChip etaLabel={formatEta(group.deadline)} days={days} />}
        </span>
      </TableCell>
    </TableRow>
  );
}

interface PoLotsTableProps {
  lots: LotReadiness[];
  /** Precomputed "250,000 kg allocated" caption fragment — the parent page
   * knows the PO's own funnel/unit; computing it here from possibly
   * mixed-unit lots (a lot can use a different unit than its PO — see
   * `UNIT_MISMATCH`) would risk silently summing incompatible units. */
  allocatedLabel: string;
}

/** PO Detail "Lots fulfilling this order" card — a `Table` of the PO's
 * linked lot batches, grouped by shipment where the data allows it (see
 * `groupByShipment` above). Columns follow sourcing-readiness.design-
 * prompt.md Prompt B minus the Shipment/ETA columns, which move to the
 * group header row instead (that's genuinely per-shipment data, not
 * per-lot). */
export function PoLotsTable({ lots, allocatedLabel }: PoLotsTableProps) {
  const groups = groupByShipment(lots);

  return (
    <Card id="lots">
      <CardHeader>
        <CardTitle>Lots fulfilling this order</CardTitle>
        <CardDescription>
          {lots.length} lot{lots.length === 1 ? "" : "s"} · {allocatedLabel}
        </CardDescription>
      </CardHeader>
      <CardContent className="px-1.5 pb-3.5">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Lot ref</TableHead>
              <TableHead className="text-right">Quantity</TableHead>
              <TableHead>Harvest period</TableHead>
              <TableHead>Plots</TableHead>
              <TableHead>DDS</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lots.length === 0 ? (
              <TableRow>
                <TableCell colSpan={COLUMN_COUNT} className="py-6 text-center text-sm text-muted-foreground">
                  No lots linked to this order yet.
                </TableCell>
              </TableRow>
            ) : (
              groups.map((group) => (
                <Fragment key={group.key}>
                  <GroupHeaderRow group={group} />
                  {group.lots.map((lot) => (
                    <LotRow key={lot.id} lot={lot} />
                  ))}
                </Fragment>
              ))
            )}
          </TableBody>
          {lots.length === 0 && <TableCaption>No lots yet</TableCaption>}
        </Table>
      </CardContent>
    </Card>
  );
}

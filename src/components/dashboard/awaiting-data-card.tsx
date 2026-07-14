"use client";

import { RefLink, WorkCard, WorkRow } from "@/components/dashboard/work-card";
import { StageBadge } from "@/components/sourcing/stage-badge";
import { useReadinessRows } from "@/hooks/use-dashboard-data";
import { bucketReadiness } from "@/lib/dashboard-worklist";
import type { BatchReadiness } from "@/lib/api/types";

function AwaitingRow({ po }: { po: BatchReadiness }) {
  const note = po.blockers[0]?.message ?? "Waiting on data";
  return (
    <WorkRow>
      <RefLink href={`/supply-chains/${po.id}`}>{po.reference_number}</RefLink>
      <StageBadge stage={po.stage} />
      <span className="text-[12.5px] text-muted-foreground">{note}</span>
    </WorkRow>
  );
}

/** "Awaiting data" — the lowest-priority card: OPEN/ALLOCATED POs that
 * aren't blocked, with what they're waiting on (the readiness endpoint's
 * own itemised `blockers`, e.g. "No lots linked yet" / "2 lots missing
 * plot geolocation") in muted text. No action button — there's nothing to
 * click until the data itself arrives (ingestion sync or supplier
 * follow-up), unlike the other two cards. */
export function AwaitingDataCard() {
  const { data: rows, isLoading } = useReadinessRows();
  const { awaiting } = bucketReadiness(rows ?? []);

  return (
    <WorkCard
      title="Awaiting data"
      description="Orders that can't move forward until data arrives"
      count={awaiting.length}
      emptyText="No orders waiting on data — syncs are up to date"
      isLoading={isLoading}
    >
      {awaiting.map((po) => (
        <AwaitingRow key={po.id} po={po} />
      ))}
    </WorkCard>
  );
}

"use client";

import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface WorkCardProps {
  title: string;
  description: string;
  /** Row count — 0 renders the quiet empty state, per the design's "a clean
   * state reads as good news" principle (never an empty-looking blank
   * card). */
  count: number;
  emptyText: string;
  isLoading?: boolean;
  children: React.ReactNode;
}

/** One of the Dashboard worklist's three stacked cards (Needs filing /
 * Needs remediation / Awaiting data) — `eudr-vault/99-Attachments/
 * design-snapshots/2026-07-11/dashboard/worklist.jsx`'s `WorkCard`, ported
 * onto our real `Card` primitives. */
export function WorkCard({ title, description, count, emptyText, isLoading, children }: WorkCardProps) {
  return (
    <Card className="shadow-[0_1px_2px_rgba(11,29,28,0.04),0_10px_26px_-18px_rgba(11,29,28,0.14)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-2.5">
          {title}
          {count > 0 && (
            <span className="font-mono text-[11.5px] font-medium text-muted-foreground">{count}</span>
          )}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {isLoading ? (
          <div className="flex flex-col gap-2" aria-hidden>
            <Skeleton className="h-9 w-full rounded-[10px]" />
            <Skeleton className="h-9 w-full rounded-[10px]" />
          </div>
        ) : count === 0 ? (
          <EmptyLine text={emptyText} />
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

/** A quiet, single-line empty state — never a barren blank card. A check
 * mark reads as "good news" (design prompt), not "nothing to show". */
function EmptyLine({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-2.5 px-0.5 py-1 text-[13.5px] text-muted-foreground">
      <CheckCircle2 className="size-[15px] shrink-0 text-primary" />
      {text}
    </div>
  );
}

export function WorkRow({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-3 rounded-[10px] border border-border px-3 py-2.5",
        className
      )}
    >
      {children}
    </div>
  );
}

export function RefLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="whitespace-nowrap font-mono text-[13px] font-medium text-foreground no-underline hover:underline">
      {children}
    </Link>
  );
}

"use client";

import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * The one detail header (eudr-frontend#167).
 *
 * A detail page is about one thing with a reference: a supplier, a plot, an
 * order, a shipment, a statement, a document, a source. Before this, seven
 * pages introduced that thing three different ways (a sans title inside a
 * card; an italic serif at 3xl; an italic serif at 4xl under an eyebrow).
 * This is the third one, which the statement page already had and which the
 * founder chose from rendered frames, with the size settled at 3xl, a step
 * under the page title.
 *
 * Shape, top to bottom: a back control naming the list it returns to; an
 * eyebrow in mono naming the kind of thing; the title with its status chips
 * beside it, never inside it, so the heading's accessible name is the
 * reference alone (every e2e journey finds a detail page that way); one line
 * of context; then anything else the page needs under the title, as
 * children. Actions sit on the right.
 *
 * The back control is a button that navigates, not a link, because that is
 * what the six existing pages did and what the journeys click by role.
 */
export function DetailHeader({
  back,
  eyebrow,
  title,
  status,
  context,
  actions,
  children,
  className,
}: {
  back: { href: string; label: string };
  /** The kind of thing: "Purchase order", "Land plot", "Due diligence statement". */
  eyebrow: string;
  title: ReactNode;
  /** One or more chips, rendered beside the title. */
  status?: ReactNode;
  /** One line under the title: who, where, what. */
  context?: ReactNode;
  actions?: ReactNode;
  /** Further rows under the context line (a shipment's dates and tracking). */
  children?: ReactNode;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={cn("space-y-6", className)}>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push(back.href)}
        className="-ml-2 gap-1.5 text-muted-foreground"
      >
        <ArrowLeft className="size-4" /> {back.label}
      </Button>

      <header className="flex flex-wrap items-start justify-between gap-x-6 gap-y-4">
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-xs tracking-[0.1em] uppercase text-muted-foreground">
            {eyebrow}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-display text-3xl leading-[1.04] font-light italic">{title}</h1>
            {status}
          </div>
          {context ? <p className="text-base text-muted-foreground">{context}</p> : null}
          {children}
        </div>
        {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
      </header>
    </div>
  );
}

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The one page header (eudr-frontend#167).
 *
 * Every list and settings page opens with the same three things: a title in
 * the display face, one line saying what the page is for, and the page's
 * actions on the right. Before this component those three things were laid
 * out by hand on fifteen pages at three title sizes, so moving from
 * Suppliers (24px) to Shipments (36px) changed the chrome as well as the
 * content. The size lives here and nowhere else; page-headers.test.tsx
 * rejects any page that renders its own <h1>.
 *
 * The description is the page's purpose in the founder's register ("Who you
 * buy from, and whether their plot data is good enough to file on"), not a
 * category label. Leave it out rather than write a generic one.
 */
export function PageHeader({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  /** Buttons, links or a segmented control; laid out as one row on the right. */
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("flex flex-wrap items-end justify-between gap-x-6 gap-y-4", className)}>
      <div className="min-w-0">
        <h1 className="text-display text-4xl leading-[1.04] font-light italic text-balance">{title}</h1>
        {description ? (
          <p className="mt-2.5 max-w-2xl text-base text-muted-foreground">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

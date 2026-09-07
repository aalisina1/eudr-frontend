"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * One gate for every administration route (#158).
 *
 * The sidebar hides this whole section from non-administrators, so arriving
 * here without the role means someone followed a link or typed a URL. They get
 * a plain explanation rather than a blank page or a silent redirect: being
 * bounced somewhere else with no reason given is how people conclude the
 * product is broken.
 *
 * This is the presentation of the rule. The backend enforces it independently
 * on every endpoint underneath — `IsAdmin` — so a determined caller gains
 * nothing by getting past this.
 */
export default function AdministrationLayout({ children }: { children: React.ReactNode }) {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  if (user?.role !== "ADMIN") {
    return (
      <div className="mx-auto max-w-md space-y-4 py-16 text-center">
        <ShieldAlert className="mx-auto size-8 text-muted-foreground" />
        <h1 className="text-display text-2xl leading-tight font-light italic">
          Administration is for administrators
        </h1>
        <p className="text-sm text-muted-foreground">
          Managing people, groups and the TRACES connection is limited to
          administrators of your organisation. Ask one of them if you need a change.
        </p>
        <Button variant="ghost" render={<Link href="/settings" />}>
          Go to your settings
        </Button>
      </div>
    );
  }

  return <div className="space-y-6">{children}</div>;
}

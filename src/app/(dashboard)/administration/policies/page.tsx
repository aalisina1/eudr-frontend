"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Check, ArrowRight } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AdministrationHeader } from "@/components/admin/administration-header";
import { authFetch } from "@/lib/api/client";
import type { AccessGroup, GrantableRole, PaginatedResponse } from "@/lib/api/types";

/**
 * What each policy grants, and which groups carry it (#174).
 *
 * A policy attaches to a **group**, never to a user: this page shows the
 * catalogue and, against each entry, the groups that hold it, so "who can
 * approve a statement" is answerable by reading down one column. Users appear
 * nowhere here, which is the point.
 */
const POLICIES: { role: GrantableRole; name: string; grants: string[] }[] = [
  {
    role: "VIEWER",
    name: "Read only",
    grants: [
      "See suppliers, plots, orders, shipments and statements",
      "Export any list",
      "Change nothing",
    ],
  },
  {
    role: "COMPLIANCE_OFFICER",
    name: "Compliance",
    grants: [
      "Everything Read only grants",
      "Create and edit suppliers, plots, orders and shipments",
      "Build a statement, submit it to TRACES, amend and withdraw it",
      "Resolve a flagged plot",
    ],
  },
  {
    role: "ADMIN",
    name: "Administration",
    grants: [
      "Everything Compliance grants",
      "Add, deactivate and reassign people",
      "Create groups and decide which policy each one carries",
      "Configure the TRACES connection and the operator identity",
    ],
  },
];

/** Enforced no matter which policy a group carries. Not configurable, and the
 * page says so rather than implying a switch that does not exist. These were
 * invisible until now: an administrator who tried to demote the last remaining
 * administrator got a refusal with no way of having known the rule existed. */
const INVARIANTS = [
  "The organisation always keeps at least one active administrator. A change is refused if it would remove the last one, whether by deactivating them, taking them out of a group, downgrading that group or deleting it.",
  "You cannot deactivate yourself, or remove your own last route to administration. Another administrator has to.",
  "Nobody grants a policy above the one they hold themselves.",
  "A supplier contact is an external identity and is never placed in a group.",
  "Invitations expire after seven days, work once, and can be withdrawn. The record is kept either way.",
  "Every change to users, groups, memberships and invitations is written to the audit log.",
];

export default function AdministrationPoliciesPage() {
  const { data: groups, isLoading } = useQuery<PaginatedResponse<AccessGroup>>({
    queryKey: ["access-groups"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/accounts/groups/?page_size=100");
      if (!res.ok) throw new Error("Failed to load groups");
      return res.json();
    },
  });

  function groupsCarrying(role: GrantableRole): AccessGroup[] {
    return (groups?.results ?? []).filter((group) => group.role === role);
  }

  return (
    <>
      <AdministrationHeader
        title="Policies"
        description="What each policy allows, and which groups carry it. A policy is attached to a group and never to a person, so to change what someone can do, change the groups they are in."
      />

      <div className="space-y-4">
        {POLICIES.map((policy) => {
          const carriers = groupsCarrying(policy.role);
          return (
            <Card key={policy.role}>
              <CardHeader>
                <CardTitle>{policy.name}</CardTitle>
                <CardDescription>Allows the following.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <ul className="space-y-1.5">
                  {policy.grants.map((grant) => (
                    <li key={grant} className="flex gap-2.5 text-sm">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" />
                      {grant}
                    </li>
                  ))}
                </ul>

                <div className="flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                  <span className="text-xs text-muted-foreground">Carried by</span>
                  {isLoading ? (
                    <Skeleton className="h-5 w-40" />
                  ) : carriers.length ? (
                    carriers.map((group) => (
                      <Badge key={group.id} variant="secondary">
                        {group.name}
                        <span className="ml-1.5 opacity-60">
                          {group.member_count}
                        </span>
                      </Badge>
                    ))
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      No group yet, so nobody has it.
                    </span>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto gap-1 text-primary hover:text-primary"
                    render={<Link href="/administration/groups" />}
                  >
                    Manage groups <ArrowRight className="size-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}

        <Card>
          <CardHeader>
            <CardTitle>Always enforced</CardTitle>
            <CardDescription>
              These hold whichever policy a group carries, and are not configurable.
            </CardDescription>
          </CardHeader>
          <CardContent className="divide-y divide-border/60 p-0">
            {INVARIANTS.map((rule) => (
              <p key={rule} className="px-5 py-3.5 text-sm text-muted-foreground">
                {rule}
              </p>
            ))}
          </CardContent>
        </Card>
      </div>
    </>
  );
}

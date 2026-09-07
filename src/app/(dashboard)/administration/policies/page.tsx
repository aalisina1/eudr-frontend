"use client";

import { Check } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";

/**
 * The access rules in force, stated once (#158).
 *
 * These are enforced in the backend's `apps/accounts/policies.py` and were
 * previously invisible to the person they constrain: an administrator who tried
 * to demote the last remaining administrator got a refusal with no way of
 * having known the rule existed. Nothing here is configurable, and the page
 * says so rather than implying a switch that does not exist.
 */
const POLICIES = [
  {
    rule: "Only administrators administer",
    detail:
      "Inviting someone, changing a role, deactivating an account and every group operation are limited to administrators. Every other role is read-only here.",
  },
  {
    rule: "The organisation always keeps an administrator",
    detail:
      "A change is refused if it would leave nobody with active administrator access. That covers demoting them, deactivating them, removing them from a group that grants it, downgrading that group, and deleting it.",
  },
  {
    rule: "You cannot demote or deactivate yourself",
    detail:
      "Another administrator has to do it. This is a guard against the common accident rather than a statement about trust.",
  },
  {
    rule: "Nobody grants a role above their own",
    detail:
      "An invitation or group cannot hand out access stronger than the person creating it already holds.",
  },
  {
    rule: "A supplier contact is never a group member",
    detail:
      "Supplier contact is an external identity scoped to its own data, not a job function, so it sits outside the ordering that groups grant roles over.",
  },
  {
    rule: "Invitations expire, are single use, and can be withdrawn",
    detail:
      "A link lasts seven days and stops working once accepted. Withdrawing one takes effect immediately, and the record is kept as evidence of who was invited and by whom.",
  },
  {
    rule: "Access changes are audited",
    detail:
      "Users, groups, memberships and invitations are all written to the audit log, because who can reach compliance data is part of the compliance record.",
  },
];

export default function AdministrationPoliciesPage() {
  return (
    <>
      <PageHeader
        title="Policies"
        description="The rules that govern access to this organisation. They are enforced by the platform and are not configurable, so this page is a statement of what is already true rather than a set of switches."
      />
      <Card>
        <CardContent className="divide-y divide-border/60 p-0">
          {POLICIES.map((policy) => (
            <div key={policy.rule} className="flex gap-3 px-5 py-4">
              <Check className="mt-0.5 size-4 shrink-0 text-primary" />
              <div className="space-y-1">
                <p className="text-sm font-medium">{policy.rule}</p>
                <p className="text-sm text-muted-foreground">{policy.detail}</p>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </>
  );
}

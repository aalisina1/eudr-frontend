"use client";

import { UsersCard } from "@/components/admin/users-card";
import { InvitationsCard } from "@/components/admin/invitations-card";
import { GroupsCard } from "@/components/admin/groups-card";
import { useCurrentUser } from "@/hooks/use-current-user";

/**
 * Administration, on the Settings page. Administrators only.
 *
 * The gate returns `null` rather than rendering disabled controls: the house
 * convention is that a role which cannot do something does not see the control
 * at all. The backend enforces the same rule independently, so this is the
 * presentation of the policy, never the policy itself.
 */
export function AdministrationSection() {
  const { data: user, isLoading } = useCurrentUser();

  if (isLoading || user?.role !== "ADMIN") return null;

  return (
    <section className="space-y-6" aria-labelledby="administration-heading">
      <div>
        <h2
          id="administration-heading"
          className="text-xs font-medium tracking-[0.15em] uppercase text-muted-foreground"
        >
          Administration
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Who can reach this organisation&apos;s compliance data, and what they can do
          with it. Every change here is recorded in the audit log.
        </p>
      </div>

      <UsersCard currentUserId={user?.id} />
      <InvitationsCard />
      <GroupsCard />
    </section>
  );
}

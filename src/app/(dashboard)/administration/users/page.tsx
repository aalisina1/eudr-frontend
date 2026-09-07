"use client";

import { UsersCard } from "@/components/admin/users-card";
import { InvitationsCard } from "@/components/admin/invitations-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { AdministrationHeader } from "@/components/admin/administration-header";

export default function AdministrationUsersPage() {
  const { data: user } = useCurrentUser();

  return (
    <>
      <AdministrationHeader
        title="Users"
        description="Everyone who can reach this organisation. Access itself comes from the groups a user belongs to, never from the user, so this is where you add people and put them in the right groups."
      />
      <UsersCard currentUserId={user?.id} />
      <InvitationsCard />
    </>
  );
}

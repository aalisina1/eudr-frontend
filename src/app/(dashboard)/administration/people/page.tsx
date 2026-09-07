"use client";

import { UsersCard } from "@/components/admin/users-card";
import { InvitationsCard } from "@/components/admin/invitations-card";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PageHeader } from "@/components/page-header";

export default function AdministrationPeoplePage() {
  const { data: user } = useCurrentUser();

  return (
    <>
      <PageHeader
        title="People"
        description="Everyone with access to this organisation, and where that access comes from. Every change here is recorded in the audit log."
      />
      <UsersCard currentUserId={user?.id} />
      <InvitationsCard />
    </>
  );
}

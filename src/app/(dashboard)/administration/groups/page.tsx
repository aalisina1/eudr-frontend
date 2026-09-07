"use client";

import { GroupsCard } from "@/components/admin/groups-card";
import { AdministrationHeader } from "@/components/admin/administration-header";

export default function AdministrationGroupsPage() {
  return (
    <>
      <AdministrationHeader
        title="Groups"
        description="A group grants one role to everyone in it. People keep their own role as well, and whichever is stronger applies."
      />
      <GroupsCard />
    </>
  );
}

"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/data-table";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import { UserGroupsSheet } from "@/components/admin/user-groups-sheet";
import type { OrgUser } from "@/lib/api/types";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  COMPLIANCE_OFFICER: "Compliance officer",
  VIEWER: "Viewer",
  SUPPLIER_CONTACT: "Supplier contact",
};

/** Where someone's access actually comes from. An administrator who cannot see
 * *why* a person is an administrator cannot manage access, only observe it. */
function RoleCell({ user }: { user: OrgUser }) {
  const viaGroup = user.access_groups.find((group) => group.role === user.effective_role);
  const isInherited = user.effective_role !== user.role && viaGroup;

  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm">{ROLE_LABEL[user.effective_role] ?? user.effective_role}</span>
      <span className="text-xs text-muted-foreground">
        {isInherited
          ? `via ${viaGroup!.name}`
          : user.access_groups.length > 0
            ? "granted directly"
            : "granted directly"}
      </span>
    </div>
  );
}

export function UsersCard({ currentUserId }: { currentUserId: string | undefined }) {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string | null>(null);
  const [editingGroupsFor, setEditingGroupsFor] = useState<OrgUser | null>(null);

  const setActive = useMutation({
    mutationFn: async ({ user, isActive }: { user: OrgUser; isActive: boolean }) => {
      setPending(user.id);
      const res = await authFetch(`/api/v1/accounts/users/${user.id}/`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: isActive }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return res.json();
    },
    onSuccess: (_data, { isActive }) => {
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
      toast.success(isActive ? "Access restored" : "Access removed");
    },
    // The backend refuses to leave an organisation with no administrator, and
    // refuses self-deactivation. Both arrive as a readable message; show it
    // rather than a generic failure.
    onError: (error: Error) => toast.error(error.message),
    onSettled: () => setPending(null),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>People</CardTitle>
        <CardDescription>
          Add someone, deactivate them, or change which groups they are in. There is no
          per-user role here on purpose: a policy attaches to a group.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <DataTable<OrgUser>
          queryKey="org-users"
          endpoint="/api/v1/accounts/users/"
          rowKey={(user) => user.id}
          searchPlaceholder="Search people"
          emptyTitle="No one to show"
          emptyDescription="Invite a colleague to get started."
          columns={[
            {
              key: "email",
              header: "Person",
              render: (user) => (
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">
                    {user.first_name || user.last_name
                      ? `${user.first_name} ${user.last_name}`.trim()
                      : user.email}
                  </span>
                  <span className="text-xs text-muted-foreground">{user.email}</span>
                </div>
              ),
            },
            { key: "effective_role", header: "Role", render: (user) => <RoleCell user={user} /> },
            {
              key: "access_groups",
              header: "Groups",
              render: (user) =>
                user.access_groups.length === 0 ? (
                  <span className="text-xs text-muted-foreground">None</span>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {user.access_groups.map((group) => (
                      <Badge key={group.id} variant="secondary">
                        {group.name}
                      </Badge>
                    ))}
                  </div>
                ),
            },
            {
              key: "is_active",
              header: "Status",
              render: (user) =>
                user.is_active ? (
                  <Badge variant="secondary">Active</Badge>
                ) : (
                  <Badge variant="outline">Deactivated</Badge>
                ),
            },
            {
              key: "actions",
              header: "",
              render: (user) => (
                <div className="flex items-center justify-end gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setEditingGroupsFor(user)}
                  >
                    Groups
                  </Button>
                  {user.id === currentUserId ? (
                    <span className="px-2 text-xs text-muted-foreground">You</span>
                  ) : (
                    <Button
                      size="sm"
                      variant="ghost"
                      disabled={pending === user.id}
                      onClick={() => setActive.mutate({ user, isActive: !user.is_active })}
                    >
                      {user.is_active ? "Deactivate" : "Reactivate"}
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </CardContent>

      {/* Keyed on the user so each opening starts from that person's current
          membership rather than the previous row's. */}
      <UserGroupsSheet
        key={editingGroupsFor?.id ?? "none"}
        open={editingGroupsFor !== null}
        onOpenChange={(open) => !open && setEditingGroupsFor(null)}
        user={editingGroupsFor}
      />
    </Card>
  );
}

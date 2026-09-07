"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, UserMinus, UserPlus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { AccessGroupForm } from "@/components/forms/access-group-form";
import { AddGroupMemberSheet } from "@/components/admin/add-group-member-sheet";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import type { AccessGroup, PaginatedResponse } from "@/lib/api/types";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "Administrator",
  COMPLIANCE_OFFICER: "Compliance officer",
  VIEWER: "Viewer",
};

export function GroupsCard() {
  const queryClient = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<AccessGroup | null>(null);
  const [addingTo, setAddingTo] = useState<AccessGroup | null>(null);

  const { data, isLoading } = useQuery<PaginatedResponse<AccessGroup>>({
    queryKey: ["access-groups"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/accounts/groups/?page_size=100");
      if (!res.ok) throw new Error("Failed to load groups");
      return res.json();
    },
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ["access-groups"] });
    queryClient.invalidateQueries({ queryKey: ["org-users"] });
  }

  const removeGroup = useMutation({
    mutationFn: async (group: AccessGroup) => {
      const res = await authFetch(`/api/v1/accounts/groups/${group.id}/`, { method: "DELETE" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Group deleted");
    },
    // The backend refuses to delete the group granting the last administrator,
    // and says why. Surface that sentence rather than a generic failure.
    onError: (error: Error) => toast.error(error.message),
  });

  const removeMember = useMutation({
    mutationFn: async ({ group, userId }: { group: AccessGroup; userId: string }) => {
      const res = await authFetch(`/api/v1/accounts/groups/${group.id}/members/${userId}/`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
    },
    onSuccess: () => {
      invalidate();
      toast.success("Removed from group");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Groups</CardTitle>
          <CardDescription>
            A group grants one role to everyone in it. People keep their own role too,
            and whichever is stronger applies.
          </CardDescription>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="size-4" /> New group
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <>
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </>
        ) : data?.results.length ? (
          data.results.map((group) => (
            <div key={group.id} className="rounded-lg border border-border/60 px-3.5 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="text-sm font-medium hover:underline"
                  onClick={() => {
                    setEditing(group);
                    setFormOpen(true);
                  }}
                >
                  {group.name}
                </button>
                <Badge variant="secondary">{ROLE_LABEL[group.role] ?? group.role}</Badge>
                <span className="text-xs text-muted-foreground">
                  {group.member_count} {group.member_count === 1 ? "member" : "members"}
                </span>
                <div className="ml-auto flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5"
                    onClick={() => setAddingTo(group)}
                  >
                    <UserPlus className="size-3.5" /> Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-destructive hover:text-destructive"
                    onClick={() => removeGroup.mutate(group)}
                  >
                    <Trash2 className="size-3.5" /> Delete
                  </Button>
                </div>
              </div>

              {group.description && (
                <p className="mt-1 text-xs text-muted-foreground">{group.description}</p>
              )}

              {group.members.length > 0 && (
                <ul className="mt-2.5 flex flex-wrap gap-1.5">
                  {group.members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center gap-1.5 rounded-full border border-border/60 py-0.5 pr-1 pl-2.5 text-xs"
                    >
                      {member.email}
                      <button
                        type="button"
                        aria-label={`Remove ${member.email} from ${group.name}`}
                        className="rounded-full p-0.5 text-muted-foreground hover:text-destructive"
                        onClick={() => removeMember.mutate({ group, userId: member.id })}
                      >
                        <UserMinus className="size-3.5" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 px-3.5 py-6 text-center text-sm text-muted-foreground">
            No groups yet. Create one to grant a role to a whole team at once.
          </p>
        )}
      </CardContent>

      <AccessGroupForm
        key={editing?.id ?? "new"}
        open={formOpen}
        onOpenChange={setFormOpen}
        group={editing}
      />
      <AddGroupMemberSheet
        key={addingTo?.id ?? "none"}
        open={addingTo !== null}
        onOpenChange={(open) => !open && setAddingTo(null)}
        group={addingTo}
      />
    </Card>
  );
}

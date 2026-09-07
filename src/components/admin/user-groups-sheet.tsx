"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import type { AccessGroup, OrgUser, PaginatedResponse } from "@/lib/api/types";

interface UserGroupsSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: OrgUser | null;
}

/**
 * Which groups a user belongs to, edited from the user's side (#174).
 *
 * `AddGroupMemberSheet` does the same join from the group's side. Both exist
 * because both questions get asked: "who is in this group" when you are
 * shaping a team, and "what does this person have" when someone changes job.
 * Neither offers a role — a policy attaches to a group, never to a user.
 *
 * Saves as a diff rather than a replace: the API is add-one and remove-one, and
 * sending the whole set would mean deleting and recreating memberships that did
 * not change, losing `added_by` and writing noise into the audit log.
 */
export function UserGroupsSheet({ open, onOpenChange, user }: UserGroupsSheetProps) {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(
    () => new Set(user?.access_groups.map((group) => group.id) ?? []),
  );

  const { data: groups, isLoading } = useQuery<PaginatedResponse<AccessGroup>>({
    queryKey: ["access-groups"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/accounts/groups/?page_size=100");
      if (!res.ok) throw new Error("Failed to load groups");
      return res.json();
    },
    enabled: open,
  });

  const initial = new Set(user?.access_groups.map((group) => group.id) ?? []);
  const toAdd = [...selected].filter((id) => !initial.has(id));
  const toRemove = [...initial].filter((id) => !selected.has(id));
  const dirty = toAdd.length > 0 || toRemove.length > 0;

  const save = useMutation({
    mutationFn: async () => {
      for (const groupId of toAdd) {
        const res = await authFetch(`/api/v1/accounts/groups/${groupId}/members/`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: user!.id }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(getErrorMessage(err));
        }
      }
      for (const groupId of toRemove) {
        const res = await authFetch(
          `/api/v1/accounts/groups/${groupId}/members/${user!.id}/`,
          { method: "DELETE" },
        );
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(getErrorMessage(err));
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
      queryClient.invalidateQueries({ queryKey: ["access-groups"] });
      toast.success("Groups updated");
      onOpenChange(false);
    },
    // The backend refuses a change that would leave the organisation without an
    // administrator, and says which group grants the last one. Show that.
    onError: (error: Error) => toast.error(error.message),
  });

  const isSupplierContact = user?.role === "SUPPLIER_CONTACT";

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Groups for {user?.email}</SheetTitle>
          <SheetDescription>
            Everything this person can do comes from the groups they are in. Someone
            in no group can sign in and read, and nothing more.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-2 px-4 py-5">
          {isSupplierContact ? (
            <p className="rounded-lg border border-border/60 px-3 py-2.5 text-xs text-muted-foreground">
              A supplier contact is an external counterparty scoped to their own data,
              so they are not placed in groups.
            </p>
          ) : isLoading ? (
            <p className="text-sm text-muted-foreground">Loading groups…</p>
          ) : groups?.results.length ? (
            groups.results.map((group) => (
              <label
                key={group.id}
                className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2"
              >
                <Checkbox
                  checked={selected.has(group.id)}
                  onCheckedChange={(checked) =>
                    setSelected((previous) => {
                      const next = new Set(previous);
                      if (checked) next.add(group.id);
                      else next.delete(group.id);
                      return next;
                    })
                  }
                  aria-label={group.name}
                />
                <span className="text-sm">{group.name}</span>
                <span className="ml-auto text-xs text-muted-foreground">
                  {group.role.replace("_", " ").toLowerCase()}
                </span>
              </label>
            ))
          ) : (
            <p className="rounded-lg border border-dashed border-border/60 px-3 py-6 text-center text-sm text-muted-foreground">
              No groups exist yet. Create one first, then put people in it.
            </p>
          )}
        </div>

        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            disabled={!dirty || save.isPending || isSupplierContact}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving" : "Save groups"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

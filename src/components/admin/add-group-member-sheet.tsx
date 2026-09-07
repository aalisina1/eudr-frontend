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
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import type { AccessGroup, OrgUser, PaginatedResponse } from "@/lib/api/types";

interface AddGroupMemberSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: AccessGroup | null;
}

export function AddGroupMemberSheet({ open, onOpenChange, group }: AddGroupMemberSheetProps) {
  const queryClient = useQueryClient();
  // Reset comes from remounting (the parent keys this on the group), not from
  // an effect writing state after render.
  const [search, setSearch] = useState("");

  const { data: users } = useQuery<PaginatedResponse<OrgUser>>({
    queryKey: ["org-users", "all"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/accounts/users/?page_size=100");
      if (!res.ok) throw new Error("Failed to load people");
      return res.json();
    },
    enabled: open,
  });

  const add = useMutation({
    mutationFn: async (userId: string) => {
      const res = await authFetch(`/api/v1/accounts/groups/${group!.id}/members/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-groups"] });
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
      toast.success("Added to group");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const memberIds = new Set(group?.members.map((member) => member.id) ?? []);
  const candidates = (users?.results ?? []).filter((user) => {
    if (memberIds.has(user.id)) return false;
    // A supplier contact cannot hold a group (ADR-0028). The backend rejects it;
    // there is no reason to offer it and then explain the refusal.
    if (user.role === "SUPPLIER_CONTACT") return false;
    if (!search) return true;
    const haystack = `${user.email} ${user.first_name} ${user.last_name}`.toLowerCase();
    return haystack.includes(search.toLowerCase());
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Add to {group?.name}</SheetTitle>
          <SheetDescription>
            Everyone added here is granted this group&apos;s role, on top of their own.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-3 px-4 py-5">
          <Input
            placeholder="Search people"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            aria-label="Search people"
          />
          <ul className="space-y-1.5">
            {candidates.map((user) => (
              <li key={user.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-lg border border-border/60 px-3 py-2 text-left hover:border-primary/50"
                  disabled={add.isPending}
                  onClick={() => add.mutate(user.id)}
                >
                  <span className="text-sm">{user.email}</span>
                  <span className="text-xs text-muted-foreground">Add</span>
                </button>
              </li>
            ))}
            {candidates.length === 0 && (
              <li className="py-4 text-center text-sm text-muted-foreground">
                Nobody left to add.
              </li>
            )}
          </ul>
        </div>

        <SheetFooter>
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

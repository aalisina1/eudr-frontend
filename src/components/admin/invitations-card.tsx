"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { InviteUserForm } from "@/components/forms/invite-user-form";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { formatDate } from "@/lib/format";
import { toast } from "sonner";
import type { Invitation, InvitationStatus, PaginatedResponse } from "@/lib/api/types";

const STATUS_LABEL: Record<InvitationStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  REVOKED: "Withdrawn",
  EXPIRED: "Expired",
};

export function InvitationsCard() {
  const queryClient = useQueryClient();
  const [inviteOpen, setInviteOpen] = useState(false);

  const { data, isLoading } = useQuery<PaginatedResponse<Invitation>>({
    queryKey: ["invitations"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/accounts/invitations/?page_size=100");
      if (!res.ok) throw new Error("Failed to load invitations");
      return res.json();
    },
  });

  const revoke = useMutation({
    mutationFn: async (invitation: Invitation) => {
      const res = await authFetch(`/api/v1/accounts/invitations/${invitation.id}/`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      toast.success("Invitation withdrawn");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const rows = data?.results ?? [];

  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Invitations</CardTitle>
          <CardDescription>
            A link works once and expires. Withdrawing one takes it out of use straight
            away, and the record stays as evidence of who was invited and by whom.
          </CardDescription>
        </div>
        <Button size="sm" className="gap-1.5" onClick={() => setInviteOpen(true)}>
          <Plus className="size-4" /> Invite
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isLoading ? (
          <Skeleton className="h-16 rounded-lg" />
        ) : rows.length ? (
          rows.map((invitation) => (
            <div
              key={invitation.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border/60 px-3.5 py-2.5"
            >
              <span className="text-sm">{invitation.email}</span>
              <Badge variant={invitation.status === "PENDING" ? "secondary" : "outline"}>
                {STATUS_LABEL[invitation.status]}
              </Badge>
              {invitation.groups.map((group) => (
                <Badge key={group.id} variant="outline">
                  {group.name}
                </Badge>
              ))}
              <span className="text-xs text-muted-foreground">
                {invitation.status === "PENDING"
                  ? `Expires ${formatDate(invitation.expires_at)}`
                  : `Invited ${formatDate(invitation.created_at)}`}
              </span>
              {invitation.status === "PENDING" && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto text-destructive hover:text-destructive"
                  onClick={() => revoke.mutate(invitation)}
                >
                  Withdraw
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="rounded-lg border border-dashed border-border/60 px-3.5 py-6 text-center text-sm text-muted-foreground">
            No invitations yet.
          </p>
        )}
      </CardContent>

      {/* Keyed so each opening mounts a fresh form: the reset comes from
          remounting rather than from an effect writing state after render. */}
      <InviteUserForm
        key={inviteOpen ? "open" : "closed"}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
      />
    </Card>
  );
}

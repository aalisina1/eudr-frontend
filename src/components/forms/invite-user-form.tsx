"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Copy } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import type { AccessGroup, InvitationCreated, PaginatedResponse } from "@/lib/api/types";

const ROLES = [
  { value: "VIEWER", label: "Viewer" },
  { value: "COMPLIANCE_OFFICER", label: "Compliance officer" },
  { value: "ADMIN", label: "Administrator" },
  { value: "SUPPLIER_CONTACT", label: "Supplier contact" },
] as const;

const inviteSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  role: z.enum(["VIEWER", "COMPLIANCE_OFFICER", "ADMIN", "SUPPLIER_CONTACT"]),
});

type InviteFormValues = z.infer<typeof inviteSchema>;

interface InviteUserFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function InviteUserForm({ open, onOpenChange }: InviteUserFormProps) {
  const queryClient = useQueryClient();
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set());
  const [issued, setIssued] = useState<InvitationCreated | null>(null);
  const [copied, setCopied] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "VIEWER" },
  });

  // `watch()` puts this component outside what the React Compiler can handle,
  // and the house pattern is a registered native select anyway. Compose with
  // register's own onChange so the form state and this one never diverge.
  const { onChange: onRoleFieldChange, ...roleField } = register("role");
  const [role, setRole] = useState<InviteFormValues["role"]>("VIEWER");

  const { data: groups } = useQuery<PaginatedResponse<AccessGroup>>({
    queryKey: ["access-groups"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/accounts/groups/?page_size=100");
      if (!res.ok) throw new Error("Failed to load groups");
      return res.json();
    },
    enabled: open,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: async (values: InviteFormValues) => {
      const res = await authFetch("/api/v1/accounts/invitations/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A supplier contact cannot hold a group (ADR-0028). Derived here
        // rather than cleared in an effect, so there is one rule, not two.
        body: JSON.stringify({
          ...values,
          group_ids:
            values.role === "SUPPLIER_CONTACT" ? [] : Array.from(selectedGroups),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return (await res.json()) as InvitationCreated;
    },
    onSuccess: (invitation) => {
      queryClient.invalidateQueries({ queryKey: ["invitations"] });
      setIssued(invitation);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const acceptUrl = issued
    ? `${typeof window === "undefined" ? "" : window.location.origin}/invite/${issued.token}`
    : "";

  async function copyLink() {
    await navigator.clipboard.writeText(acceptUrl);
    setCopied(true);
    toast.success("Invitation link copied");
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        {issued ? (
          // The token is disclosed exactly once, here. There is no way back to
          // it: the list endpoint does not carry it, deliberately.
          <>
            <SheetHeader>
              <SheetTitle>Invitation ready</SheetTitle>
              <SheetDescription>
                Send this link to {issued.email}. It works once and only until{" "}
                {new Date(issued.expires_at).toISOString().slice(0, 10)}. This is the
                only time it is shown, so copy it now.
              </SheetDescription>
            </SheetHeader>
            <div className="space-y-3 px-4 py-5">
              <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2.5 font-mono text-xs break-all">
                {acceptUrl}
              </div>
              <Button type="button" onClick={copyLink} className="gap-1.5">
                {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
            <SheetFooter>
              <Button type="button" onClick={() => onOpenChange(false)}>
                Done
              </Button>
            </SheetFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
            <SheetHeader>
              <SheetTitle>Invite someone</SheetTitle>
              <SheetDescription>
                They receive a single-use link and choose their own password. Nothing
                is sent by email yet, so you pass the link on yourself.
              </SheetDescription>
            </SheetHeader>

            <div className="space-y-4 px-4 py-5">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  {...register("email")}
                  placeholder="colleague@example.com"
                />
                {errors.email && (
                  <p className="text-xs text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="invite-role">Role</Label>
                <select
                  id="invite-role"
                  {...roleField}
                  onChange={(event) => {
                    onRoleFieldChange(event);
                    setRole(event.target.value as InviteFormValues["role"]);
                  }}
                  className="w-full h-9 rounded-lg border border-border/60 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                >
                  {ROLES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {role === "SUPPLIER_CONTACT" ? (
                <p className="rounded-lg border border-border/60 px-3 py-2.5 text-xs text-muted-foreground">
                  A supplier contact is an external counterparty, so they are scoped to
                  their own data rather than placed in a group.
                </p>
              ) : (
                <div className="space-y-2">
                  <Label>Groups</Label>
                  {groups?.results.length ? (
                    groups.results.map((group) => (
                      <label
                        key={group.id}
                        className="flex items-center gap-2.5 rounded-lg border border-border/60 px-3 py-2"
                      >
                        <Checkbox
                          checked={selectedGroups.has(group.id)}
                          onCheckedChange={(checked) =>
                            setSelectedGroups((previous) => {
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
                    <p className="text-xs text-muted-foreground">
                      No groups yet. You can add them to one later.
                    </p>
                  )}
                </div>
              )}
            </div>

            <SheetFooter>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Creating" : "Create invitation"}
              </Button>
            </SheetFooter>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

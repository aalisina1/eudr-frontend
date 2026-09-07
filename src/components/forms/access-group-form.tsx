"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { toast } from "sonner";
import type { AccessGroup, GrantableRole } from "@/lib/api/types";

/** The three roles a group may grant. `SUPPLIER_CONTACT` is absent on purpose:
 * ADR-0028 keeps it out of the privilege order, and the backend rejects it with
 * both a serializer choice and a database check constraint. This list is the
 * third layer, not the only one. */
const GRANTABLE_ROLES: { value: GrantableRole; label: string }[] = [
  { value: "VIEWER", label: "Viewer (read everything, change nothing)" },
  { value: "COMPLIANCE_OFFICER", label: "Compliance officer (build, review and file)" },
  { value: "ADMIN", label: "Administrator (everything, including this screen)" },
];

const groupSchema = z.object({
  name: z.string().min(1, "Give the group a name"),
  description: z.string().optional(),
  role: z.enum(["VIEWER", "COMPLIANCE_OFFICER", "ADMIN"]),
});

type GroupFormValues = z.infer<typeof groupSchema>;

interface AccessGroupFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group?: AccessGroup | null;
}

export function AccessGroupForm({ open, onOpenChange, group }: AccessGroupFormProps) {
  const queryClient = useQueryClient();
  const isEditing = !!group;

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<GroupFormValues>({
    resolver: zodResolver(groupSchema),
    // Seeded from the group being edited; the parent keys this component on
    // that group, so a fresh mount is the reset.
    defaultValues: {
      name: group?.name ?? "",
      description: group?.description ?? "",
      role: group?.role ?? "VIEWER",
    },
  });

  const mutation = useMutation({
    mutationFn: async (values: GroupFormValues) => {
      const res = await authFetch(
        isEditing ? `/api/v1/accounts/groups/${group!.id}/` : "/api/v1/accounts/groups/",
        {
          method: isEditing ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(values),
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(err));
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["access-groups"] });
      queryClient.invalidateQueries({ queryKey: ["org-users"] });
      toast.success(isEditing ? "Group updated" : "Group created");
      onOpenChange(false);
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg">
        <form onSubmit={handleSubmit((values) => mutation.mutate(values))}>
          <SheetHeader>
            <SheetTitle>{isEditing ? "Edit group" : "New group"}</SheetTitle>
            <SheetDescription>
              A group grants one role to everyone in it. Someone keeps their own role
              as well, and whichever is stronger is the one that applies.
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 px-4 py-5">
            <div className="space-y-1.5">
              <Label htmlFor="group-name">Name</Label>
              <Input id="group-name" {...register("name")} placeholder="Compliance team" />
              {errors.name && (
                <p className="text-xs text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="group-description">Description</Label>
              <Input
                id="group-description"
                {...register("description")}
                placeholder="What this group is for"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="group-role">Role granted</Label>
              <select id="group-role" {...register("role")} className="w-full h-9 rounded-lg border border-border/60 bg-secondary/50 px-3 text-sm text-foreground outline-none focus:border-ring focus:ring-2 focus:ring-ring/30">
                {GRANTABLE_ROLES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Supplier contact is not offered: it is an external identity scoped to
                its own data, not a job function a group can hand out.
              </p>
            </div>
          </div>

          <SheetFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving" : isEditing ? "Save changes" : "Create group"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}

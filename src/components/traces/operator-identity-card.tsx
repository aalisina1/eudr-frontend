"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { Organization } from "@/lib/api/types";
import { OperatorIdentityForm } from "@/components/traces/operator-identity-form";

const ORG_TYPE_LABEL: Record<string, string> = {
  OPERATOR: "Operator",
  TRADER: "Trader",
  DOWNSTREAM_OPERATOR: "Downstream Operator",
  SUPPLIER: "Supplier",
};

async function fetchOrganization(): Promise<Organization> {
  const res = await authFetch("/api/v1/accounts/organization/");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(err));
  }
  return res.json() as Promise<Organization>;
}

export function OperatorIdentityCard() {
  const [formOpen, setFormOpen] = useState(false);

  const { data: organization, isLoading, isError } = useQuery({
    queryKey: ["organization"],
    queryFn: fetchOrganization,
  });

  return (
    <>
      <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
              Operator Identity
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              The EORI number and TRACES actor ID used to identify your
              organization in submitted Due Diligence Statements.
            </p>
          </div>
          {organization && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => setFormOpen(true)}
            >
              <Pencil className="size-3.5" />
              Edit
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-5 w-64" />
          </div>
        ) : isError || !organization ? (
          <p className="text-sm text-muted-foreground">
            Unable to load operator identity.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground w-32 shrink-0">Organization</span>
              <span className="truncate">{organization.name}</span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground w-32 shrink-0">Type</span>
              <Badge variant="secondary" className="border-0">
                {ORG_TYPE_LABEL[organization.organization_type] ?? organization.organization_type}
              </Badge>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground w-32 shrink-0">Operator EORI</span>
              {organization.eori_number ? (
                <span className="font-mono text-xs">{organization.eori_number}</span>
              ) : (
                <span className="text-xs text-muted-foreground italic">Not set</span>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground w-32 shrink-0">TRACES Actor ID</span>
              {organization.traces_actor_id ? (
                <span className="font-mono text-xs">{organization.traces_actor_id}</span>
              ) : (
                <span className="text-xs text-muted-foreground italic">
                  Not yet assigned — set by TRACES after your first successful submission
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {organization && (
        <OperatorIdentityForm
          open={formOpen}
          onOpenChange={setFormOpen}
          organization={organization}
        />
      )}
    </>
  );
}

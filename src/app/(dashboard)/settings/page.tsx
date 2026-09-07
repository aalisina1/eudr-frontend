"use client";

import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Building2, Shield, Mail } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { PRODUCT_TITLE } from "@/lib/brand";

export default function SettingsPage() {
  const { data: user, isLoading } = useCurrentUser();

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrator",
    COMPLIANCE_OFFICER: "Compliance Officer",
    VIEWER: "Viewer",
    SUPPLIER_CONTACT: "Supplier Contact",
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Settings"
        description="Your account. Organisation settings live under Administration."
      />

      {/* Profile Card */}
      <Card className="border-border/50 shadow-card">
        <CardContent className="p-6">
          <h2 className="text-xs font-medium tracking-[0.15em] uppercase text-muted-foreground mb-4">
            Profile
          </h2>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-5 w-48" />
              <Skeleton className="h-5 w-64" />
              <Skeleton className="h-5 w-36" />
            </div>
          ) : user ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                  <User className="w-[18px] h-[18px] text-success-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">
                    {user.first_name && user.last_name
                      ? `${user.first_name} ${user.last_name}`
                      : user.username}
                  </p>
                  <p className="text-xs text-muted-foreground">@{user.username}</p>
                </div>
              </div>

              <div className="grid gap-3 pt-2">
                <div className="flex items-center gap-3 text-sm">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-20">Email</span>
                  <span>{user.email}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-20">Role</span>
                  <span className="px-2 py-0.5 rounded-full bg-success/10 text-success-foreground text-xs font-medium">
                    {roleLabels[user.role] ?? user.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-muted-foreground w-20">Organization</span>
                  <span>{user.organization_name ?? "—"}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground opacity-0" />
                  <span className="text-muted-foreground w-20">Org ID</span>
                  <span className="font-mono text-xs">{user.organization_id ?? "—"}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Unable to load profile.</p>
          )}
        </CardContent>
      </Card>

      {/* App Info */}
      <Card className="border-border/50 shadow-card">
        <CardContent className="p-6">
          <h2 className="text-xs font-medium tracking-[0.15em] uppercase text-muted-foreground mb-4">
            Application
          </h2>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span>{PRODUCT_TITLE}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Version</span>
              <span className="font-mono text-xs">0.1.0</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Regulation</span>
              <span>EU 2023/1115</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { User, Building2, Shield, Mail } from "lucide-react";
import { authFetch } from "@/lib/api/client";
import type { User as UserType } from "@/lib/api/types";
import { CredentialsCard } from "@/components/traces/credentials-card";

export default function SettingsPage() {
  const { data: user, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/auth/users/me/");
      if (!res.ok) throw new Error("Failed to fetch profile");
      return res.json() as Promise<UserType>;
    },
  });

  const roleLabels: Record<string, string> = {
    ADMIN: "Administrator",
    COMPLIANCE_OFFICER: "Compliance Officer",
    VIEWER: "Viewer",
    SUPPLIER_CONTACT: "Supplier Contact",
  };

  return (
    <div className="space-y-8 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your profile and account information.
        </p>
      </div>

      {/* Profile Card */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <h2 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground mb-4">
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
                <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <User className="w-[18px] h-[18px] text-emerald-700 dark:text-emerald-400" />
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
                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium">
                    {roleLabels[user.role] ?? user.role}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
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

      {/* TRACES Connection */}
      <CredentialsCard />

      {/* App Info */}
      <Card className="border-border/50">
        <CardContent className="p-6">
          <h2 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground mb-4">
            Application
          </h2>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Platform</span>
              <span>Canopy EUDR Compliance</span>
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

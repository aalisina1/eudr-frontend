"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Link2,
  Ship,
  FileText,
  FolderOpen,
  Cable,
  Settings,
  ArrowLeft,
  ShieldCheck,
  UserCog,
  UsersRound,
  ScrollText,
  PlugZap,
  LogOut,
  Moon,
  Sun,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { auth } from "@/lib/auth";
import { GrovetraceMark } from "@/components/brand/grovetrace-mark";
import { PRODUCT_NAME, PRODUCT_DESCRIPTOR } from "@/lib/brand";

/** Left accent bar shown on the active nav item — ported from the prototype
 * shell's `NavBtn` (a 3px pill in `--sidebar-primary`, inset 10px top/bottom). */
function ActiveAccentBar() {
  return <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-sidebar-primary" />;
}

const navMain = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/suppliers", label: "Suppliers", icon: Users },
  { href: "/plots", label: "Land plots", icon: MapPin },
];

const navCompliance = [
  { href: "/sourcing", label: "Sourcing", icon: Link2 },
  { href: "/shipments", label: "Shipments", icon: Ship },
  { href: "/submissions", label: "Submissions", icon: FileText },
  { href: "/documents", label: "Documents", icon: FolderOpen },
];

/** Organisation administration (#174). Administrators only — absent from the
 * DOM for everyone else, not disabled — and every route beneath it is gated
 * again by `administration/layout.tsx` and by `IsAdmin` on the backend. The
 * sidebar is the signpost, never the lock.
 *
 * Integrations lives here rather than under Compliance: connecting a source
 * system is organisation configuration, and its write actions were already
 * admin-only on the backend. Note the *route* stays ungated, so a compliance
 * officer who has the URL keeps the access they had; what they lose is the nav
 * entry. */
const navAdmin = [
  { href: "/administration/users", label: "Users", icon: UserCog },
  { href: "/administration/groups", label: "Groups", icon: UsersRound },
  { href: "/administration/policies", label: "Policies", icon: ScrollText },
  { href: "/integrations", label: "Integrations", icon: Cable },
  { href: "/administration/traces", label: "TRACES", icon: PlugZap },
];

/** Admin is a *context*, not a section: entering it swaps the sidebar rather
 * than adding a third group to it. Driven off the route so the mode is never
 * hidden state — the URL says which one you are in, and reloading keeps it. */
function isAdminRoute(pathname: string): boolean {
  return (
    pathname === "/integrations" ||
    pathname.startsWith("/integrations/") ||
    pathname === "/administration" ||
    pathname.startsWith("/administration/")
  );
}

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { data: currentUser } = useCurrentUser();
  const isAdmin = currentUser?.role === "ADMIN";
  const adminContext = isAdmin && isAdminRoute(pathname);
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // One-time sync of the initial theme from the pre-hydration <html> class.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggleTheme = useCallback(() => {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  }, [dark]);

  function handleLogout() {
    auth.clearTokens();
    router.push("/login");
  }

  return (
    <Sidebar>
      <SidebarHeader className="px-5 pt-6 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-[34px] h-[34px] rounded-md bg-sidebar-primary flex items-center justify-center">
            <GrovetraceMark variant="small" className="w-[19px] h-[19px] text-sidebar" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-base tracking-tight text-sidebar-foreground leading-none">
              {PRODUCT_NAME}
            </span>
            {PRODUCT_DESCRIPTOR && (
              <span className="text-xs tracking-[0.12em] uppercase text-sidebar-foreground/35 leading-none">
                {PRODUCT_DESCRIPTOR}
              </span>
            )}
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        {adminContext ? (
          <>
            <SidebarMenu className="mb-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  render={<Link href="/dashboard" />}
                  className="rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
                >
                  <ArrowLeft className="size-[15px]" />
                  <span className="text-sm">Back to {PRODUCT_NAME}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>

            <SidebarSeparator className="mx-3 my-1 opacity-50" />

            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/30 text-xs uppercase tracking-[0.15em] font-medium px-3 mb-1">
                Administration
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navAdmin.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          isActive={isActive}
                          className="relative rounded-md h-9"
                        >
                          {isActive && <ActiveAccentBar />}
                          <Icon className={cn("size-[15px]", isActive && "text-sidebar-primary")} />
                          <span className="text-sm">{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/30 text-xs uppercase tracking-[0.15em] font-medium px-3 mb-1">
                Overview
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navMain.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          isActive={isActive}
                          className="relative rounded-md h-9"
                        >
                          {isActive && <ActiveAccentBar />}
                          <Icon className={cn("size-[15px]", isActive && "text-sidebar-primary")} />
                          <span className="text-sm">{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarSeparator className="mx-3 my-1 opacity-50" />

            <SidebarGroup>
              <SidebarGroupLabel className="text-sidebar-foreground/30 text-xs uppercase tracking-[0.15em] font-medium px-3 mb-1">
                Compliance
              </SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {navCompliance.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + "/");
                    return (
                      <SidebarMenuItem key={href}>
                        <SidebarMenuButton
                          render={<Link href={href} />}
                          isActive={isActive}
                          className="relative rounded-md h-9"
                        >
                          {isActive && <ActiveAccentBar />}
                          <Icon className={cn("size-[15px]", isActive && "text-sidebar-primary")} />
                          <span className="text-sm">{label}</span>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarSeparator className="mx-3 mb-2 opacity-50" />
        <SidebarMenu>
          {isAdmin && !adminContext && (
            <SidebarMenuItem>
              <SidebarMenuButton
                render={<Link href="/administration" />}
                className="rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
              >
                <ShieldCheck className="size-[15px]" />
                <span className="text-sm">Admin</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname === "/settings"}
              className="relative rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
            >
              {pathname === "/settings" && <ActiveAccentBar />}
              <Settings className={cn("size-[15px]", pathname === "/settings" && "text-sidebar-primary")} />
              <span className="text-sm">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              className="rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
            >
              {dark ? <Sun className="size-[15px]" /> : <Moon className="size-[15px]" />}
              <span className="text-sm">{dark ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
            >
              <LogOut className="size-[15px]" />
              <span className="text-sm">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

"use client";

import Link from "next/link";
import { useState, useEffect, useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Users,
  MapPin,
  Link2,
  FileText,
  FolderOpen,
  Cable,
  Settings,
  LogOut,
  Moon,
  Sun,
  TreePine,
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

/** Left accent bar shown on the active nav item — ported from the prototype
 * shell's `NavBtn` (a 3px pill in `--sidebar-primary`, inset 10px top/bottom). */
function ActiveAccentBar() {
  return <span aria-hidden className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full bg-sidebar-primary" />;
}

const navMain = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/suppliers", label: "Suppliers", icon: Users },
  { href: "/plots", label: "Land Plots", icon: MapPin },
];

const navCompliance = [
  { href: "/supply-chains", label: "Sourcing", icon: Link2 },
  { href: "/due-diligence", label: "Submissions", icon: FileText },
  { href: "/documents", label: "Documents", icon: FolderOpen },
  { href: "/integrations", label: "Integrations", icon: Cable },
];

export function AppSidebar() {
  const pathname = usePathname();
  const router = useRouter();
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
            <TreePine className="w-[18px] h-[18px] text-sidebar" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-semibold text-[15px] tracking-tight text-sidebar-foreground leading-none">
              Grovetrace
            </span>
            <span className="text-[10px] tracking-[0.12em] uppercase text-sidebar-foreground/35 leading-none">
              EUDR Compliance
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2">
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/30 text-[10px] uppercase tracking-[0.15em] font-medium px-3 mb-1">
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
                      <span className="text-[13px]">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="mx-3 my-1 opacity-50" />

        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/30 text-[10px] uppercase tracking-[0.15em] font-medium px-3 mb-1">
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
                      <span className="text-[13px]">{label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 pb-4">
        <SidebarSeparator className="mx-3 mb-2 opacity-50" />
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              render={<Link href="/settings" />}
              isActive={pathname === "/settings"}
              className="relative rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
            >
              {pathname === "/settings" && <ActiveAccentBar />}
              <Settings className={cn("size-[15px]", pathname === "/settings" && "text-sidebar-primary")} />
              <span className="text-[13px]">Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={toggleTheme}
              className="rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
            >
              {dark ? <Sun className="size-[15px]" /> : <Moon className="size-[15px]" />}
              <span className="text-[13px]">{dark ? "Light mode" : "Dark mode"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              className="rounded-md h-9 text-sidebar-foreground/40 hover:text-sidebar-foreground/70"
            >
              <LogOut className="size-[15px]" />
              <span className="text-[13px]">Sign out</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}

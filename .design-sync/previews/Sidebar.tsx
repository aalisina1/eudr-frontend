import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
} from "eudr-frontend";
import { LayoutDashboard, Users, Leaf, FileCheck, Boxes, Settings } from "lucide-react";

const nav = [
  { label: "Dashboard", icon: LayoutDashboard, active: true },
  { label: "Suppliers", icon: Users },
  { label: "Land plots", icon: Leaf },
  { label: "Batches", icon: Boxes },
  { label: "Statements", icon: FileCheck },
];

export const DashboardNav = () => (
  <SidebarProvider>
    <Sidebar collapsible="none" style={{ height: 460 }}>
      <SidebarHeader>
        <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 8px", fontWeight: 600 }}>
          <Leaf style={{ width: 18, height: 18, color: "var(--primary)" }} />
          Canopy EUDR
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Compliance</SidebarGroupLabel>
          <SidebarMenu>
            {nav.map((item) => (
              <SidebarMenuItem key={item.label}>
                <SidebarMenuButton isActive={item.active}>
                  <item.icon />
                  <span>{item.label}</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton>
              <Settings />
              <span>Settings</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  </SidebarProvider>
);

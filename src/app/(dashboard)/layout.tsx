import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border/60 px-6">
          <SidebarTrigger className="-ml-2 text-muted-foreground hover:text-foreground transition-colors" />
          <Separator orientation="vertical" className="h-4 bg-border/60" />
          <span className="text-[11px] tracking-[0.12em] uppercase text-muted-foreground/60 font-medium">
            EUDR Compliance
          </span>
        </header>
        <main className="flex-1 overflow-auto p-6 lg:p-8">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}

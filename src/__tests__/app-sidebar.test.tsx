import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./helpers";
import { AppSidebar } from "@/components/app-sidebar";

// The sidebar uses SidebarProvider context. Mock the UI primitives
// to just render children so we can test navigation items.
vi.mock("@/components/ui/sidebar", () => ({
  Sidebar: ({ children }: { children: React.ReactNode }) => <nav data-testid="sidebar">{children}</nav>,
  SidebarContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarFooter: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroup: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarGroupLabel: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SidebarMenu: ({ children }: { children: React.ReactNode }) => <ul>{children}</ul>,
  SidebarMenuButton: ({
    children,
    onClick,
    render,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    render?: React.ReactElement;
  }) => {
    if (render && render.props?.href) {
      return <li><a href={render.props.href}>{children}</a></li>;
    }
    if (render) {
      return <li><span>{children}</span></li>;
    }
    return (
      <li>
        <button onClick={onClick}>{children}</button>
      </li>
    );
  },
  SidebarMenuItem: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SidebarSeparator: () => <hr />,
}));

describe("AppSidebar", () => {
  it("renders the Grovetrace branding", () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText("Grovetrace")).toBeInTheDocument();
    expect(screen.getByText("EUDR Compliance")).toBeInTheDocument();
  });

  it("renders all main navigation items", () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("Land Plots")).toBeInTheDocument();
  });

  it("renders all compliance navigation items", () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText("Sourcing")).toBeInTheDocument();
    expect(screen.getByText("Submissions")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
  });

  it("nav item for /supply-chains route is labelled Sourcing, not Supply Chains (#28 rename)", () => {
    renderWithProviders(<AppSidebar />);
    const link = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/supply-chains");
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain("Sourcing");
    expect(screen.queryByText("Supply Chains")).toBeNull();
  });

  it("nav item for /due-diligence route is labelled Submissions (not Due Diligence)", () => {
    renderWithProviders(<AppSidebar />);
    // The link to /due-diligence must exist and its visible text must be "Submissions"
    const ddLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/due-diligence");
    expect(ddLink).toBeTruthy();
    expect(ddLink?.textContent).toContain("Submissions");
    expect(screen.queryByText("Due Diligence")).toBeNull();
  });

  it("renders footer items (Settings, theme toggle, sign out)", () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText("Settings")).toBeInTheDocument();
    expect(screen.getByText("Dark mode")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();
  });

  it("has correct navigation link hrefs", () => {
    renderWithProviders(<AppSidebar />);
    const links = screen.getAllByRole("link");
    const hrefs = links.map((l) => l.getAttribute("href"));
    expect(hrefs).toContain("/dashboard");
    expect(hrefs).toContain("/suppliers");
    expect(hrefs).toContain("/integrations");
    expect(hrefs).toContain("/settings");
  });

  it("toggles theme label on click", async () => {
    renderWithProviders(<AppSidebar />);

    const themeButton = screen.getByText("Dark mode");
    expect(themeButton).toBeInTheDocument();

    await userEvent.click(themeButton);

    // After click, should toggle to "Light mode"
    expect(screen.getByText("Light mode")).toBeInTheDocument();
  });
});

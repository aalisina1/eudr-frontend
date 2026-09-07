import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "./helpers";
import { AppSidebar } from "@/components/app-sidebar";
import { PRODUCT_NAME, PRODUCT_DESCRIPTOR } from "@/lib/brand";

// #174 made the sidebar route-driven (an admin *context*, not a third section),
// so these two have to be steerable per test rather than fixed in setup.ts.
let pathname = "/dashboard";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  useParams: () => ({}),
  useSearchParams: () => new URLSearchParams(),
}));

let currentRole: string | undefined;
vi.mock("@/hooks/use-current-user", () => ({
  useCurrentUser: () => ({
    data: currentRole ? { id: "u1", email: "a@example.com", role: currentRole } : undefined,
    isLoading: false,
  }),
}));

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
  beforeEach(() => {
    pathname = "/dashboard";
    currentRole = undefined;
  });

  it("renders the product name from the single brand definition", () => {
    // Was asserting a hardcoded "EUDR Compliance" subtitle. That subtitle was
    // one of four competing descriptors and is gone by decision; the descriptor
    // slot is now empty so the name stands alone. See ADR-0027 and
    // 10-Specs/product-voice-and-identity.md Decision 1.
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText(PRODUCT_NAME)).toBeInTheDocument();
  });

  it("renders the real mark, not a stock icon", () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByRole("img", { name: "Grovetrace" })).toBeInTheDocument();
  });

  it("shows the descriptor only when one is set", () => {
    renderWithProviders(<AppSidebar />);
    if (PRODUCT_DESCRIPTOR) {
      expect(screen.getByText(PRODUCT_DESCRIPTOR)).toBeInTheDocument();
    } else {
      // No empty element left behind where the old subtitle used to sit.
      expect(screen.queryByText("EUDR Compliance")).not.toBeInTheDocument();
    }
  });

  it("renders all main navigation items", () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Suppliers")).toBeInTheDocument();
    expect(screen.getByText("Land plots")).toBeInTheDocument();
  });

  it("renders all compliance navigation items", () => {
    renderWithProviders(<AppSidebar />);
    expect(screen.getByText("Sourcing")).toBeInTheDocument();
    expect(screen.getByText("Submissions")).toBeInTheDocument();
    expect(screen.getByText("Documents")).toBeInTheDocument();
    // Integrations is organisation configuration and moved into the admin
    // context in #174. Its replacement home is asserted below.
    expect(screen.queryByText("Integrations")).toBeNull();
  });

  it("nav item for /sourcing route is labelled Sourcing, not Supply Chains (#28 rename)", () => {
    renderWithProviders(<AppSidebar />);
    const link = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/sourcing");
    expect(link).toBeTruthy();
    expect(link?.textContent).toContain("Sourcing");
    expect(screen.queryByText("Supply Chains")).toBeNull();
  });

  it("nav item for /submissions route is labelled Submissions (not Due Diligence)", () => {
    renderWithProviders(<AppSidebar />);
    // The link to /submissions must exist and its visible text must be "Submissions"
    const ddLink = screen.getAllByRole("link").find((l) => l.getAttribute("href") === "/submissions");
    expect(ddLink).toBeTruthy();
    expect(ddLink?.textContent).toContain("Submissions");
    expect(screen.queryByText("Due Diligence")).toBeNull();
  });

  it("renders the Shipments nav item linking to /shipments", () => {
    renderWithProviders(<AppSidebar />);
    const link = screen.getByRole("link", { name: /Shipments/i });
    expect(link).toHaveAttribute("href", "/shipments");
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
    expect(hrefs).toContain("/settings");
    // /integrations is reachable from the admin context now (#174), not here.
    expect(hrefs).not.toContain("/integrations");
  });

  describe("the admin context (#174)", () => {
    it("puts Admin at the bottom, for administrators only", () => {
      currentRole = "ADMIN";
      renderWithProviders(<AppSidebar />);

      const admin = screen.getByRole("link", { name: /Admin/i });
      expect(admin).toHaveAttribute("href", "/administration");
    });

    it.each(["COMPLIANCE_OFFICER", "VIEWER", "SUPPLIER_CONTACT"])(
      "hides Admin from %s entirely",
      (role) => {
        currentRole = role;
        renderWithProviders(<AppSidebar />);

        // Absent from the DOM, not disabled.
        expect(screen.queryByText("Admin")).toBeNull();
      },
    );

    it("swaps the whole sidebar once you are inside it", () => {
      currentRole = "ADMIN";
      pathname = "/administration/users";
      renderWithProviders(<AppSidebar />);

      // The admin options, including Integrations.
      for (const label of ["Users", "Groups", "Policies", "Integrations", "TRACES"]) {
        expect(screen.getByText(label)).toBeInTheDocument();
      }
      // And not the everyday nav underneath it.
      expect(screen.queryByText("Sourcing")).toBeNull();
      expect(screen.queryByText("Dashboard")).toBeNull();
    });

    it("offers a way back out", () => {
      currentRole = "ADMIN";
      pathname = "/administration/groups";
      renderWithProviders(<AppSidebar />);

      const back = screen.getByRole("link", { name: new RegExp(`Back to ${PRODUCT_NAME}`, "i") });
      expect(back).toHaveAttribute("href", "/dashboard");
    });

    it("treats /integrations as part of the context, so the nav does not flip back", () => {
      currentRole = "ADMIN";
      pathname = "/integrations";
      renderWithProviders(<AppSidebar />);

      expect(screen.getByText("Policies")).toBeInTheDocument();
      expect(screen.queryByText("Sourcing")).toBeNull();
    });

    it("leaves a non-admin on /integrations in the ordinary nav", () => {
      // The route is deliberately ungated: a compliance officer keeps the access
      // they had, they just lose the nav entry. Sending them into an admin
      // context they cannot use would be worse than either.
      currentRole = "COMPLIANCE_OFFICER";
      pathname = "/integrations";
      renderWithProviders(<AppSidebar />);

      expect(screen.getByText("Sourcing")).toBeInTheDocument();
      expect(screen.queryByText("Policies")).toBeNull();
    });
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

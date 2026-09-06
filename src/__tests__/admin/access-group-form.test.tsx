import { describe, it, expect, vi } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { AccessGroupForm } from "@/components/forms/access-group-form";

vi.mock("@/lib/api/client", () => ({ authFetch: vi.fn() }));

describe("AccessGroupForm", () => {
  it("offers exactly the three grantable roles", () => {
    renderWithProviders(<AccessGroupForm open onOpenChange={() => {}} />);

    const select = screen.getByLabelText("Role granted") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);

    expect(values).toEqual(["VIEWER", "COMPLIANCE_OFFICER", "ADMIN"]);
  });

  it("never offers SUPPLIER_CONTACT", () => {
    /* ADR-0028: it is an identity, not a job function, and it sits outside the
     * privilege order the backend maxes over. Asserted rather than merely
     * omitted, so re-adding it to the list fails here first. */
    renderWithProviders(<AccessGroupForm open onOpenChange={() => {}} />);

    const select = screen.getByLabelText("Role granted") as HTMLSelectElement;
    const values = Array.from(select.options).map((option) => option.value);

    expect(values).not.toContain("SUPPLIER_CONTACT");
  });

  it("seeds from the group being edited", () => {
    renderWithProviders(
      <AccessGroupForm
        open
        onOpenChange={() => {}}
        group={{
          id: "g1",
          name: "Compliance team",
          description: "Files statements",
          role: "COMPLIANCE_OFFICER",
          member_count: 2,
          members: [],
          created_at: "2026-09-01T00:00:00Z",
          updated_at: "2026-09-01T00:00:00Z",
        }}
      />,
    );

    expect(screen.getByLabelText("Name")).toHaveValue("Compliance team");
    expect(screen.getByLabelText("Role granted")).toHaveValue("COMPLIANCE_OFFICER");
  });
});

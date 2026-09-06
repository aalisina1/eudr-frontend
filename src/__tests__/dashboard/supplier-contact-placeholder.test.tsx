import { describe, it, expect } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import { SupplierContactPlaceholder } from "@/components/dashboard/supplier-contact-placeholder";

describe("SupplierContactPlaceholder", () => {
  it("shows the no-access message", () => {
    renderWithProviders(<SupplierContactPlaceholder />);
    expect(
      screen.getByText(
        /You don't have access to organisation-wide compliance data\. Ask your organisation administrator for access\./i
      )
    ).toBeInTheDocument();
  });

  it("renders no organisation-wide compliance data (no RAG, PO, or supplier references)", () => {
    renderWithProviders(<SupplierContactPlaceholder />);
    expect(screen.queryByText(/PO-/)).not.toBeInTheDocument();
    expect(screen.queryByText(/on time|at risk|breached/i)).not.toBeInTheDocument();
  });
});

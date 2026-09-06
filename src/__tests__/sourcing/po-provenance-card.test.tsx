import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PoProvenanceCard } from "@/components/sourcing/po-provenance-card";

/** eudr-frontend#133: "N plots across M lots" is a fact the user can act on
 * only if it goes somewhere. It links to the plot list filtered to this
 * order's supplier, which `/plots` honours as `?supplier_id=`. */
describe("PoProvenanceCard", () => {
  it("links the plot count to the plot list filtered to the supplier", () => {
    render(<PoProvenanceCard supplierId="sup-9" supplierName="Kuapa" countryOfOrigin="GH" plotCount={23} lotCount={4} />);
    const link = screen.getByRole("link", { name: /23 plots/ });
    expect(link).toHaveAttribute("href", "/plots?supplier_id=sup-9");
  });
});

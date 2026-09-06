import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { redirect } from "next/navigation";
import SupplyChainsRedirect from "@/app/(dashboard)/supply-chains/page";
import SupplyChainDetailRedirect from "@/app/(dashboard)/supply-chains/[id]/page";
import DueDiligenceRedirect from "@/app/(dashboard)/due-diligence/page";
import DueDiligenceDetailRedirect from "@/app/(dashboard)/due-diligence/[id]/page";

/**
 * eudr-frontend#121: the routes now match their nav labels — /sourcing and
 * /submissions — and the old paths redirect rather than 404, following the
 * /data-import precedent. A bookmark or a link shared in a demo before the
 * rename must still land, list and detail alike.
 */
describe("legacy route redirects (#121)", () => {
  it("/supply-chains → /sourcing", () => {
    SupplyChainsRedirect();
    expect(redirect).toHaveBeenCalledWith("/sourcing");
  });

  it("/supply-chains/[id] → /sourcing/[id], id preserved and escaped", async () => {
    await SupplyChainDetailRedirect({ params: Promise.resolve({ id: "po 1/x" }) });
    expect(redirect).toHaveBeenCalledWith("/sourcing/po%201%2Fx");
  });

  it("/due-diligence → /submissions", () => {
    DueDiligenceRedirect();
    expect(redirect).toHaveBeenCalledWith("/submissions");
  });

  it("/due-diligence/[id] → /submissions/[id]", async () => {
    await DueDiligenceDetailRedirect({ params: Promise.resolve({ id: "dds-9" }) });
    expect(redirect).toHaveBeenCalledWith("/submissions/dds-9");
  });

  it("the sidebar's routes agree with its labels", () => {
    // The whole point: what the URL bar shows in a demo matches the nav.
    const src = readFileSync(resolve(__dirname, "../../components/app-sidebar.tsx"), "utf8");
    expect(src).toMatch(/href: "\/sourcing", label: "Sourcing"/);
    expect(src).toMatch(/href: "\/submissions", label: "Submissions"/);
    expect(src).not.toMatch(/supply-chains|due-diligence/);
  });
});

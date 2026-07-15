/**
 * Confirms the Submissions route's own `?po=` branch (eudr-frontend #26) —
 * the full-page File DDS composer takes over the `/due-diligence` route
 * instead of the Submissions list when a `po` query param is present,
 * matching PO Detail's "File DDS" CTA (`router.push('/due-diligence?po=' +
 * po.id)`, `src/app/(dashboard)/supply-chains/[id]/page.tsx`).
 *
 * The composer's own behavior (prefill, meter, submit) is covered by
 * `file-dds-composer-component.test.tsx`; this file only exercises the
 * page-level routing seam, so `FileDdsComposer` is stubbed.
 */
import { describe, it, expect, vi, afterEach } from "vitest";
import { screen } from "@testing-library/react";
import { renderWithProviders } from "../helpers";
import DueDiligencePage from "@/app/(dashboard)/due-diligence/page";

let searchParams = new URLSearchParams();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
  usePathname: () => "/due-diligence",
  useParams: () => ({}),
  useSearchParams: () => searchParams,
  redirect: vi.fn(),
}));

vi.mock("@/components/due-diligence/file-dds-composer", () => ({
  FileDdsComposer: ({ poId }: { poId: string }) => <div data-testid="composer-stub">Composer for {poId}</div>,
}));

const originalFetch = globalThis.fetch;

describe("DueDiligencePage — ?po= routing to the File DDS composer (#26)", () => {
  afterEach(() => {
    globalThis.fetch = originalFetch;
    searchParams = new URLSearchParams();
  });

  it("renders the Submissions list when there is no `po` param", () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), { status: 200 }),
    );
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Submissions");
    expect(screen.queryByTestId("composer-stub")).toBeNull();
  });

  it("renders the File DDS composer instead of the list when `?po=<id>` is present", () => {
    searchParams = new URLSearchParams("po=po-123");
    renderWithProviders(<DueDiligencePage />);
    expect(screen.getByTestId("composer-stub")).toHaveTextContent("Composer for po-123");
    expect(screen.queryByRole("heading", { level: 1, name: "Submissions" })).toBeNull();
  });
});

import { PlotForm } from "eudr-frontend";
import { QueryClient, QueryClientProvider } from "eudr-frontend";

// Forms render in a Sheet via react-hook-form + zod. They need a QueryClient
// (for their option queries + submit mutation). Mock the network so their
// option dropdowns resolve to empty lists instead of throwing; the form fields
// themselves render from the schema. Mounted in create mode (no entity prop).
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fetch = async () =>
    new Response(JSON.stringify({ count: 0, next: null, previous: null, results: [] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}
const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export const Create = () => (
  <QueryClientProvider client={qc}>
    <PlotForm open onOpenChange={() => {}} />
  </QueryClientProvider>
);

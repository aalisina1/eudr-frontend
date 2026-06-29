import { DataTable, Badge } from "eudr-frontend";
import { QueryClient, QueryClientProvider } from "eudr-frontend";

// DataTable fetches its rows internally via React Query + authFetch. Mock the
// network so the preview renders a populated table instead of the error state.
type Row = { id: string; name: string; commodity: string; country: string; plots: number; status: string };
const rows: Row[] = [
  { id: "1", name: "Fazenda Boa Vista", commodity: "Coffee", country: "Brazil", plots: 14, status: "Verified" },
  { id: "2", name: "Cocoa Collective Ltd", commodity: "Cocoa", country: "Côte d'Ivoire", plots: 8, status: "Pending review" },
  { id: "3", name: "Riverside Timber Co", commodity: "Wood", country: "Indonesia", plots: 22, status: "At risk" },
  { id: "4", name: "Highland Rubber Estate", commodity: "Rubber", country: "Vietnam", plots: 6, status: "Verified" },
  { id: "5", name: "Palmtree Agro SA", commodity: "Palm oil", country: "Colombia", plots: 11, status: "Pending review" },
];
if (typeof window !== "undefined") {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (window as any).fetch = async () =>
    new Response(JSON.stringify({ count: rows.length, next: null, previous: null, results: rows }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
}
const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: Infinity } } });

const statusVariant = (s: string) =>
  s === "Verified" ? "default" : s === "At risk" ? "destructive" : "outline";

const columns = [
  { key: "name", header: "Supplier", sortable: true, render: (r: Row) => r.name },
  { key: "commodity", header: "Commodity", sortable: true, render: (r: Row) => r.commodity },
  { key: "country", header: "Country", render: (r: Row) => r.country },
  { key: "plots", header: "Plots", sortable: true, render: (r: Row) => r.plots },
  { key: "status", header: "Status", render: (r: Row) => <Badge variant={statusVariant(r.status)}>{r.status}</Badge> },
];

export const SuppliersList = () => (
  <QueryClientProvider client={qc}>
    <div style={{ width: 820 }}>
      <DataTable
        queryKey="suppliers"
        endpoint="/suppliers/"
        columns={columns}
        rowKey={(r: Row) => r.id}
        searchable
        exportable
        searchPlaceholder="Search suppliers…"
        filters={[
          { key: "commodity", label: "Commodity", options: [
            { label: "Coffee", value: "coffee" },
            { label: "Cocoa", value: "cocoa" },
            { label: "Wood", value: "wood" },
          ] },
        ]}
      />
    </div>
  </QueryClientProvider>
);

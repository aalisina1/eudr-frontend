import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  Badge,
} from "eudr-frontend";

const rows = [
  { supplier: "Fazenda Boa Vista", commodity: "Coffee", plots: 14, status: "Verified", variant: "default" as const },
  { supplier: "Cocoa Collective Ltd", commodity: "Cocoa", plots: 8, status: "Pending review", variant: "outline" as const },
  { supplier: "Riverside Timber Co", commodity: "Wood", plots: 22, status: "At risk", variant: "destructive" as const },
];

export const SuppliersTable = () => (
  <div style={{ width: 540 }}>
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Supplier</TableHead>
          <TableHead>Commodity</TableHead>
          <TableHead style={{ textAlign: "right" }}>Plots</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rows.map((r) => (
          <TableRow key={r.supplier}>
            <TableCell style={{ fontWeight: 500 }}>{r.supplier}</TableCell>
            <TableCell>{r.commodity}</TableCell>
            <TableCell style={{ textAlign: "right" }}>{r.plots}</TableCell>
            <TableCell>
              <Badge variant={r.variant}>{r.status}</Badge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);

export const WithCaption = () => (
  <div style={{ width: 480 }}>
    <Table>
      <TableCaption>Batches awaiting due diligence — Q2 2026</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Batch</TableHead>
          <TableHead>Weight (t)</TableHead>
          <TableHead>Harvest</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell>BATCH-2026-031</TableCell>
          <TableCell>4.2</TableCell>
          <TableCell>2026-03</TableCell>
        </TableRow>
        <TableRow>
          <TableCell>BATCH-2026-032</TableCell>
          <TableCell>1.8</TableCell>
          <TableCell>2026-04</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
);

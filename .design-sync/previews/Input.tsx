import { Input, Label } from "eudr-frontend";

export const Default = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
    <Input placeholder="Search suppliers…" />
    <Input defaultValue="Fazenda Boa Vista" />
    <Input type="email" placeholder="contact@supplier.com" />
  </div>
);

export const WithLabel = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 280 }}>
    <Label htmlFor="plot-area">Plot area (hectares)</Label>
    <Input id="plot-area" type="number" defaultValue="12.4" />
  </div>
);

export const States = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 12, width: 280 }}>
    <Input placeholder="Default" />
    <Input placeholder="Disabled" disabled />
    <Input defaultValue="Invalid value" aria-invalid />
  </div>
);

import { Label, Input, Textarea } from "eudr-frontend";

export const FormFields = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 16, width: 300 }}>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label htmlFor="supplier-name">Supplier name</Label>
      <Input id="supplier-name" placeholder="e.g. Fazenda Boa Vista" />
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <Label htmlFor="notes">Due diligence notes</Label>
      <Textarea id="notes" placeholder="Risk assessment summary…" />
    </div>
  </div>
);

export const WithCheckbox = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
    <input id="confirm" type="checkbox" defaultChecked />
    <Label htmlFor="confirm">Geolocation verified against deforestation cutoff</Label>
  </div>
);

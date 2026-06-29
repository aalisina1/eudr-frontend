import { Textarea, Label } from "eudr-frontend";

export const Default = () => (
  <div style={{ width: 360 }}>
    <Textarea
      defaultValue={"Geolocation cross-checked against the 2020 deforestation baseline. No alerts within plot boundaries. Supporting satellite imagery attached."}
      rows={4}
    />
  </div>
);

export const WithLabel = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 6, width: 360 }}>
    <Label htmlFor="risk">Risk mitigation</Label>
    <Textarea id="risk" placeholder="Describe mitigation measures for negligible-risk conclusion…" rows={4} />
  </div>
);

export const Disabled = () => (
  <div style={{ width: 360 }}>
    <Textarea disabled defaultValue="Locked after DDS submission to TRACES." rows={3} />
  </div>
);

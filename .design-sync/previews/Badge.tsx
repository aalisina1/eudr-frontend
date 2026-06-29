import { Badge } from "eudr-frontend";
import { CheckCircle2, AlertTriangle, Clock } from "lucide-react";

export const Variants = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <Badge>Verified</Badge>
    <Badge variant="secondary">Draft</Badge>
    <Badge variant="destructive">At risk</Badge>
    <Badge variant="outline">Pending review</Badge>
    <Badge variant="ghost">Archived</Badge>
    <Badge variant="link">Open DDS</Badge>
  </div>
);

export const ComplianceStatuses = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <Badge>
      <CheckCircle2 /> Compliant
    </Badge>
    <Badge variant="outline">
      <Clock /> Awaiting evidence
    </Badge>
    <Badge variant="destructive">
      <AlertTriangle /> Deforestation flag
    </Badge>
  </div>
);

export const WithCounts = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
    <Badge variant="secondary">12 batches</Badge>
    <Badge variant="secondary">3 suppliers</Badge>
    <Badge variant="outline">EUDR 2023/1115</Badge>
  </div>
);

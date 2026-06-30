import { Separator } from "eudr-frontend";

export const Horizontal = () => (
  <div style={{ width: 320, fontSize: 14 }}>
    <div style={{ fontWeight: 600 }}>Due diligence statement</div>
    <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
      DDS-2026-0142
    </div>
    <Separator style={{ margin: "12px 0" }} />
    <div style={{ color: "var(--muted-foreground)", fontSize: 13 }}>
      3 batches · 2 suppliers · accepted by TRACES
    </div>
  </div>
);

export const Vertical = () => (
  <div style={{ display: "flex", alignItems: "center", gap: 12, height: 24, fontSize: 13 }}>
    <span>Suppliers</span>
    <Separator orientation="vertical" />
    <span>Batches</span>
    <Separator orientation="vertical" />
    <span>Statements</span>
  </div>
);

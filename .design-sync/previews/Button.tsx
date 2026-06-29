import { Button } from "eudr-frontend";
import { Plus, Download, Trash2 } from "lucide-react";

export const Variants = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
    <Button>Submit DDS</Button>
    <Button variant="secondary">Save draft</Button>
    <Button variant="outline">Cancel</Button>
    <Button variant="ghost">Details</Button>
    <Button variant="destructive">Delete batch</Button>
    <Button variant="link">View on TRACES</Button>
  </div>
);

export const Sizes = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
    <Button size="xs">Extra small</Button>
    <Button size="sm">Small</Button>
    <Button size="default">Default</Button>
    <Button size="lg">Large</Button>
  </div>
);

export const WithIcons = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
    <Button>
      <Plus /> Add supplier
    </Button>
    <Button variant="outline">
      <Download /> Export CSV
    </Button>
    <Button variant="destructive">
      <Trash2 /> Remove plot
    </Button>
    <Button size="icon" variant="outline" aria-label="Add">
      <Plus />
    </Button>
  </div>
);

export const States = () => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center" }}>
    <Button>Enabled</Button>
    <Button disabled>Disabled</Button>
    <Button variant="outline" disabled>
      Disabled outline
    </Button>
  </div>
);

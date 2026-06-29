import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
  CardFooter,
  Badge,
  Button,
  Separator,
} from "eudr-frontend";

export const SupplierCard = () => (
  <Card style={{ width: 360 }}>
    <CardHeader>
      <CardTitle>Fazenda Boa Vista</CardTitle>
      <CardDescription>Coffee · Minas Gerais, Brazil</CardDescription>
      <CardAction>
        <Badge>Verified</Badge>
      </CardAction>
    </CardHeader>
    <CardContent>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 13 }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--muted-foreground)" }}>Land plots</span>
          <span>14</span>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <span style={{ color: "var(--muted-foreground)" }}>Last DDS</span>
          <span>2026-05-18</span>
        </div>
      </div>
    </CardContent>
    <CardFooter style={{ gap: 8 }}>
      <Button size="sm">View supplier</Button>
      <Button size="sm" variant="outline">
        New batch
      </Button>
    </CardFooter>
  </Card>
);

export const StatTiles = () => (
  <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
    {[
      { label: "Active suppliers", value: "48", note: "+4 this month" },
      { label: "DDS submitted", value: "212", note: "EUDR-ready" },
      { label: "At-risk plots", value: "3", note: "needs review" },
    ].map((s) => (
      <Card key={s.label} size="sm" style={{ width: 168 }}>
        <CardHeader>
          <CardDescription>{s.label}</CardDescription>
          <CardTitle style={{ fontSize: 28 }}>{s.value}</CardTitle>
        </CardHeader>
        <CardContent style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
          {s.note}
        </CardContent>
      </Card>
    ))}
  </div>
);

export const SimpleCard = () => (
  <Card style={{ width: 320 }}>
    <CardHeader>
      <CardTitle>Due diligence statement</CardTitle>
      <CardDescription>Reference DDS-2026-0142</CardDescription>
    </CardHeader>
    <Separator />
    <CardContent style={{ paddingTop: 16, fontSize: 13 }}>
      Submitted to TRACES and accepted. Covers 3 batches of cocoa from 2 verified
      suppliers.
    </CardContent>
  </Card>
);

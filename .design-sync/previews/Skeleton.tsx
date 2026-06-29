import { Skeleton, Card, CardHeader, CardContent } from "eudr-frontend";

export const TextLines = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 10, width: 320 }}>
    <Skeleton style={{ height: 16, width: "70%" }} />
    <Skeleton style={{ height: 12, width: "100%" }} />
    <Skeleton style={{ height: 12, width: "90%" }} />
    <Skeleton style={{ height: 12, width: "40%" }} />
  </div>
);

export const CardSkeleton = () => (
  <Card style={{ width: 320 }}>
    <CardHeader>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Skeleton style={{ height: 40, width: 40, borderRadius: 999 }} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8, flex: 1 }}>
          <Skeleton style={{ height: 14, width: "60%" }} />
          <Skeleton style={{ height: 10, width: "40%" }} />
        </div>
      </div>
    </CardHeader>
    <CardContent>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Skeleton style={{ height: 12, width: "100%" }} />
        <Skeleton style={{ height: 12, width: "80%" }} />
      </div>
    </CardContent>
  </Card>
);

export const TableRows = () => (
  <div style={{ display: "flex", flexDirection: "column", gap: 8, width: 360 }}>
    {[0, 1, 2, 3].map((i) => (
      <div key={i} style={{ display: "flex", gap: 12, alignItems: "center" }}>
        <Skeleton style={{ height: 14, flex: 2 }} />
        <Skeleton style={{ height: 14, flex: 1 }} />
        <Skeleton style={{ height: 14, width: 60 }} />
      </div>
    ))}
  </div>
);

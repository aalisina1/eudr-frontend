"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Users,
  MapPin,
  Link2,
  FileText,
  Plus,
  Upload,
  ArrowRight,
  TreePine,
} from "lucide-react";
import { authFetch } from "@/lib/api/client";
import type { PaginatedResponse, DueDiligenceStatement, LandPlot } from "@/lib/api/types";

async function fetchCount(path: string) {
  const res = await authFetch(`${path}?limit=1`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.count as number;
}

const stats = [
  {
    label: "Suppliers",
    description: "Registered partners",
    path: "/api/v1/suppliers/",
    icon: Users,
    href: "/suppliers",
    accent: "#1A6B5A",
  },
  {
    label: "Land Plots",
    description: "Verified parcels",
    path: "/api/v1/geolocation/plots/",
    icon: MapPin,
    href: "/plots",
    accent: "#34D399",
  },
  {
    label: "Batches",
    description: "Traced supply chain",
    path: "/api/v1/supply-chain/batches/",
    icon: Link2,
    href: "/supply-chains",
    accent: "#C7956D",
  },
  {
    label: "Statements",
    description: "Due diligence",
    path: "/api/v1/due-diligence/statements/",
    icon: FileText,
    href: "/due-diligence",
    accent: "#E8C468",
  },
];

const quickActions = [
  { label: "Add Supplier", href: "/suppliers", icon: Plus },
  { label: "New Statement", href: "/due-diligence", icon: FileText },
  { label: "Import Plots", href: "/plots", icon: Upload },
];

function StatCard({
  label,
  description,
  path,
  icon: Icon,
  href,
  accent,
}: (typeof stats)[number]) {
  const { data, isLoading } = useQuery({
    queryKey: ["count", path],
    queryFn: () => fetchCount(path),
  });

  return (
    <Link href={href} className="group">
      <Card className="relative overflow-hidden border-border/50 bg-card hover:shadow-[0_8px_30px_rgba(0,0,0,0.06)] transition-all duration-300 hover:-translate-y-0.5">
        {/* Top accent bar */}
        <div className="h-[3px]" style={{ background: `linear-gradient(to right, ${accent}, transparent)` }} />

        <CardContent className="pt-5 pb-5 px-5">
          <div className="flex items-start justify-between mb-4">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: `${accent}12`, color: accent }}
            >
              <Icon className="size-[18px]" />
            </div>
            <ArrowRight
              className="size-4 text-muted-foreground/0 group-hover:text-muted-foreground/60 transition-all duration-300 group-hover:translate-x-0.5"
            />
          </div>

          {isLoading ? (
            <Skeleton className="h-10 w-20 mb-1" />
          ) : (
            <p className="text-display text-4xl font-light italic tracking-tight mb-0.5">
              {data ?? "—"}
            </p>
          )}
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}

// ── Charts ──

const ddsStatusColors: Record<string, string> = {
  DRAFT: "#94a3b8",
  UNDER_REVIEW: "#f59e0b",
  APPROVED: "#34d399",
  SUBMITTED: "#3b82f6",
  REJECTED: "#ef4444",
  WITHDRAWN: "#a78bfa",
};

function DDSStatusChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["dds-all"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/due-diligence/statements/?limit=200");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<DueDiligenceStatement>>;
    },
  });

  const segments = useMemo(() => {
    if (!data?.results) return [];
    const counts: Record<string, number> = {};
    for (const d of data.results) {
      counts[d.status] = (counts[d.status] || 0) + 1;
    }
    const total = data.results.length;
    if (total === 0) return [];
    let offset = 0;
    return Object.entries(counts).map(([status, count]) => {
      const pct = count / total;
      const seg = { status, count, pct, offset };
      offset += pct;
      return seg;
    });
  }, [data]);

  const total = data?.results?.length ?? 0;
  const r = 60;
  const circ = 2 * Math.PI * r;

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <h3 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground mb-4">
          Due Diligence by Status
        </h3>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No statements yet</p>
        ) : (
          <div className="flex items-center gap-6">
            <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0">
              {segments.map((seg) => (
                <circle
                  key={seg.status}
                  cx="80" cy="80" r={r}
                  fill="none"
                  stroke={ddsStatusColors[seg.status] ?? "#94a3b8"}
                  strokeWidth="18"
                  strokeDasharray={`${seg.pct * circ} ${circ}`}
                  strokeDashoffset={-seg.offset * circ}
                  transform="rotate(-90 80 80)"
                />
              ))}
              <text x="80" y="76" textAnchor="middle" className="fill-foreground text-2xl font-light" style={{ fontFamily: "inherit" }}>
                {total}
              </text>
              <text x="80" y="94" textAnchor="middle" className="fill-muted-foreground text-[10px]">
                total
              </text>
            </svg>
            <div className="space-y-1.5 flex-1">
              {segments.map((seg) => (
                <div key={seg.status} className="flex items-center gap-2 text-sm">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: ddsStatusColors[seg.status] }} />
                  <span className="text-muted-foreground text-xs flex-1">{seg.status.replace("_", " ")}</span>
                  <span className="font-medium tabular-nums text-xs">{seg.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const validationColors: Record<string, string> = {
  PENDING: "#94a3b8",
  PASSED: "#34d399",
  FAILED: "#ef4444",
  REQUIRES_REVIEW: "#f59e0b",
};

function PlotValidationChart() {
  const { data, isLoading } = useQuery({
    queryKey: ["plots-all"],
    queryFn: async () => {
      const res = await authFetch("/api/v1/geolocation/plots/?limit=200");
      if (!res.ok) throw new Error("Failed");
      return res.json() as Promise<PaginatedResponse<LandPlot>>;
    },
  });

  const bars = useMemo(() => {
    if (!data?.results) return [];
    const counts: Record<string, number> = {};
    for (const p of data.results) {
      counts[p.validation_status] = (counts[p.validation_status] || 0) + 1;
    }
    const max = Math.max(...Object.values(counts), 1);
    return Object.entries(counts).map(([status, count]) => ({
      status,
      count,
      pct: count / max,
    }));
  }, [data]);

  return (
    <Card className="border-border/50">
      <CardContent className="p-5">
        <h3 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground mb-4">
          Plot Validation Status
        </h3>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : bars.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No plots yet</p>
        ) : (
          <div className="space-y-3">
            {bars.map((bar) => (
              <div key={bar.status}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-muted-foreground">{bar.status.replace("_", " ")}</span>
                  <span className="text-xs font-medium tabular-nums">{bar.count}</span>
                </div>
                <div className="h-6 rounded-lg bg-muted overflow-hidden">
                  <div
                    className="h-full rounded-lg transition-all duration-500"
                    style={{
                      width: `${bar.pct * 100}%`,
                      backgroundColor: validationColors[bar.status] ?? "#94a3b8",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-6xl">
      {/* Hero banner */}
      <div
        className="relative overflow-hidden rounded-2xl px-8 py-9"
        style={{
          background: "linear-gradient(135deg, #0B1D1C 0%, #143330 50%, #1A6B5A 100%)",
        }}
      >
        {/* Topo lines */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.05]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="dtopo" width="100" height="100" patternUnits="userSpaceOnUse">
              <path d="M0 50 Q25 25 50 50 Q75 75 100 50" stroke="white" fill="none" strokeWidth="0.5" />
              <path d="M0 25 Q25 0 50 25 Q75 50 100 25" stroke="white" fill="none" strokeWidth="0.5" />
              <path d="M0 75 Q25 50 50 75 Q75 100 100 75" stroke="white" fill="none" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#dtopo)" />
        </svg>

        {/* Decorative element */}
        <div className="absolute top-0 right-0 w-64 h-64 opacity-[0.06]">
          <TreePine className="w-full h-full" strokeWidth={0.3} />
        </div>

        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[#34D399] text-[11px] font-medium tracking-[0.15em] uppercase mb-3">
              Dashboard
            </p>
            <h1 className="text-display text-white text-3xl font-light italic mb-2">
              Welcome to Canopy
            </h1>
            <p className="text-white/45 text-sm max-w-md leading-relaxed">
              Monitor compliance, verify land origins, and manage due diligence
              for EUDR Regulation 2023/1115.
            </p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <StatCard key={s.path} {...s} />
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground mb-3">
          Quick actions
        </h2>
        <div className="flex flex-wrap gap-2.5">
          {quickActions.map(({ label, href, icon: Icon }) => (
            <Link
              key={label}
              href={href}
              className={cn(
                buttonVariants({ variant: "outline" }),
                "gap-2 rounded-xl border-border/60 hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all duration-200 text-[13px] no-underline"
              )}
            >
              <Icon className="size-3.5" />
              {label}
            </Link>
          ))}
        </div>
      </div>

      {/* Charts */}
      <div className="grid gap-4 sm:grid-cols-2">
        <DDSStatusChart />
        <PlotValidationChart />
      </div>
    </div>
  );
}

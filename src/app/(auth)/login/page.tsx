"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TreePine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/client";
import { auth } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const tokens = await login(email, password);
      auth.setTokens(tokens.access, tokens.refresh);
      router.push("/");
    } catch {
      setError("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex">
      {/* ── Left: editorial branding panel ── */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between"
        style={{
          background: "linear-gradient(165deg, #0B1D1C 0%, #143330 40%, #1A6B5A 100%)",
        }}
      >
        {/* Topographic line pattern */}
        <svg className="absolute inset-0 w-full h-full opacity-[0.06]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="topo" width="120" height="120" patternUnits="userSpaceOnUse">
              <path d="M0 60 Q30 30 60 60 Q90 90 120 60" stroke="white" fill="none" strokeWidth="0.5" />
              <path d="M0 30 Q30 0 60 30 Q90 60 120 30" stroke="white" fill="none" strokeWidth="0.5" />
              <path d="M0 90 Q30 60 60 90 Q90 120 120 90" stroke="white" fill="none" strokeWidth="0.5" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#topo)" />
        </svg>

        {/* Decorative rings */}
        <div className="absolute -bottom-32 -left-32 w-96 h-96 rounded-full border border-white/[0.06]" />
        <div className="absolute -bottom-20 -left-20 w-72 h-72 rounded-full border border-white/[0.04]" />
        <div className="absolute top-20 -right-16 w-64 h-64 rounded-full border border-white/[0.05]" />

        {/* Content */}
        <div className="relative z-10 p-12 pt-14">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#34D399] flex items-center justify-center">
              <TreePine className="w-5 h-5 text-[#0B1D1C]" />
            </div>
            <div>
              <span className="text-white text-lg font-semibold tracking-tight block leading-none">
                Grovetrace
              </span>
              <span className="text-white/40 text-[11px] tracking-widest uppercase">
                EUDR Platform
              </span>
            </div>
          </div>
        </div>

        <div className="relative z-10 p-12 flex-1 flex flex-col justify-center max-w-xl">
          <p className="text-[#34D399] text-sm font-medium tracking-wider uppercase mb-5">
            EU Regulation 2023/1115
          </p>
          <h1 className="text-display text-white text-[clamp(2.5rem,4vw,3.5rem)] font-light leading-[1.1] mb-6 italic">
            Protecting forests through transparency
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-md">
            Track your supply chain from origin to shelf. Verify land plots, manage
            suppliers, and generate compliance statements.
          </p>
        </div>

        <div className="relative z-10 p-12 pb-10">
          <div className="flex items-center gap-4 text-[13px] text-white/30">
            <span>Deforestation-free</span>
            <span className="w-1 h-1 rounded-full bg-[#34D399]/40" />
            <span>Compliant</span>
            <span className="w-1 h-1 rounded-full bg-[#34D399]/40" />
            <span>Traceable</span>
          </div>
        </div>
      </div>

      {/* ── Right: login form ── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="absolute top-8 right-8 text-[11px] text-muted-foreground tracking-wider uppercase">
          v1.0
        </div>

        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <TreePine className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">Grovetrace</span>
          </div>

          <div className="mb-8">
            <h2 className="text-display text-2xl font-normal italic text-foreground mb-1.5">
              Welcome back
            </h2>
            <p className="text-muted-foreground text-sm">
              Sign in to continue to your dashboard
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@company.com"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 bg-secondary/50 border-border/60 focus:bg-card transition-colors"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium tracking-wider uppercase text-muted-foreground">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-secondary/50 border-border/60 focus:bg-card transition-colors"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/8 rounded-xl px-4 py-2.5 border border-destructive/15">
                <span className="w-1.5 h-1.5 rounded-full bg-destructive shrink-0" />
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-11 text-sm font-medium" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>

          <p className="text-[11px] text-center text-muted-foreground/60 mt-10">
            Grovetrace EUDR Compliance Platform
          </p>
        </div>
      </div>
    </div>
  );
}

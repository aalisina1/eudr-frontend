"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { login } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { GrovetraceMark } from "@/components/brand/grovetrace-mark";
import { PRODUCT_NAME, PRODUCT_DESCRIPTOR } from "@/lib/brand";

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
            <div className="w-10 h-10 rounded-2xl bg-success flex items-center justify-center">
              <GrovetraceMark variant="small" className="w-[22px] h-[22px] text-sidebar" />
            </div>
            <div>
              <span className="text-white text-lg font-semibold tracking-tight block leading-none">
                {PRODUCT_NAME}
              </span>
              {PRODUCT_DESCRIPTOR && (
                <span className="text-white/40 text-xs tracking-widest uppercase">
                  {PRODUCT_DESCRIPTOR}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="relative z-10 p-12 flex-1 flex flex-col justify-center max-w-xl">
          <p className="text-success text-sm font-medium tracking-wider uppercase mb-5">
            EU Regulation 2023/1115
          </p>
          <h1 className="text-display text-white text-[clamp(2.5rem,4vw,3.5rem)] font-light leading-[1.1] mb-6 italic">
            Know which shipments will clear, before they land
          </h1>
          <p className="text-white/50 text-lg leading-relaxed max-w-md">
            Every arriving consignment sits in one list, ordered by whatever runs
            out of time first. The plot geometry and supplier records behind it
            are checked in advance, not in the week the container ships.
          </p>
        </div>

        <div className="relative z-10 p-12 pb-10">
          <div className="flex items-center gap-2.5 text-sm text-white/30">
            <span className="w-1 h-1 rounded-full bg-success/40" />
            <span>Statements file directly to TRACES</span>
          </div>
        </div>
      </div>

      {/* ── Right: login form ── */}
      <div className="flex-1 flex items-center justify-center p-8 relative">
        <div className="w-full max-w-[360px]">
          {/* Mobile logo */}
          <div className="flex items-center gap-2.5 mb-10 lg:hidden">
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <GrovetraceMark variant="small" className="w-[19px] h-[19px] text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg tracking-tight">{PRODUCT_NAME}</span>
          </div>

          <div className="mb-8">
            <h2 className="text-display text-2xl font-normal italic text-foreground">
              Sign in
            </h2>
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

          <p className="text-xs text-center text-muted-foreground/60 mt-10">
            {PRODUCT_NAME}
          </p>
        </div>
      </div>
    </div>
  );
}

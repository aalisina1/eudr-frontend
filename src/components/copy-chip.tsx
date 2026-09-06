"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A labelled, click-to-copy value chip. Extracted from traces-panel.tsx so
 * the Customs Reference Ledger can reuse the same affordance for the TRACES
 * reference/verification pair instead of duplicating it. */
export function CopyChip({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="text-muted-foreground text-xs mb-0.5">{label}</p>
      <button
        type="button"
        onClick={() => {
          navigator.clipboard?.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
        className="inline-flex items-center gap-1.5 rounded-md bg-secondary/60 px-2 py-1 font-mono text-xs hover:bg-secondary"
        aria-label={`Copy ${label}`}
      >
        {value}
        {copied ? <Check className="size-3 text-success" /> : <Copy className="size-3 opacity-50" />}
      </button>
    </div>
  );
}

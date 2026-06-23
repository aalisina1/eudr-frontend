"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Clock,
  Play,
  Pause,
  CheckCircle2,
  AlertCircle,
  CalendarClock,
} from "lucide-react";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import { isValidCron, describeCron, getNextRun } from "@/lib/cron";
import type { IngestionSchedule } from "@/lib/api/types";

// Quick presets that fill the (still-editable) cron field. "Custom" leaves it
// untouched so the operator can type any 5-field expression the backend accepts.
const PRESETS: { label: string; cron: string }[] = [
  { label: "Custom…", cron: "" },
  { label: "Every hour", cron: "0 * * * *" },
  { label: "Daily at 02:00", cron: "0 2 * * *" },
  { label: "Weekly (Mon 02:00)", cron: "0 2 * * 1" },
  { label: "Monthly (1st, 02:00)", cron: "0 2 1 * *" },
];

// A pragmatic shortlist; the backend accepts any valid IANA zone.
const TIMEZONES = [
  "UTC",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Sao_Paulo",
  "Africa/Accra",
  "Asia/Jakarta",
];

const SELECT_CLASS =
  "h-9 rounded-lg border border-input bg-transparent px-3 text-sm shadow-xs " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function formatTimestamp(value: string | null): string {
  if (!value) return "Never";
  return new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function ScheduleSection({ sourceId }: { sourceId: string }) {
  const queryClient = useQueryClient();
  const [cron, setCron] = useState("");
  const [timezone, setTimezone] = useState("UTC");
  const [enabled, setEnabled] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<string | null>(null);
  const [hydratedId, setHydratedId] = useState<string | null>(null);
  // The editor only authors CRON schedules. We still load INTERVAL schedules
  // (backend-supported) so they can be paused/resumed without being silently
  // rewritten — these preserve the original type/interval on save.
  const [scheduleType, setScheduleType] =
    useState<IngestionSchedule["schedule_type"]>("CRON");
  const [intervalSeconds, setIntervalSeconds] = useState<number | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["source-schedule", sourceId],
    queryFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/schedule/`,
      );
      // No schedule configured yet — show the editor with defaults.
      if (res.status === 404) return null;
      if (!res.ok) {
        throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
      }
      return res.json() as Promise<IngestionSchedule>;
    },
  });

  // Seed the editable form from the loaded schedule exactly once, during render
  // (React's "adjust state when data changes" pattern — avoids a cascading
  // setState-in-effect). A later refetch keeps the same id, so user edits aren't
  // clobbered.
  if (data && data.id !== hydratedId) {
    setHydratedId(data.id);
    setCron(data.cron_expression ?? "");
    setTimezone(data.timezone ?? "UTC");
    setEnabled(data.is_enabled);
    setLastRunAt(data.last_run_at);
    setScheduleType(data.schedule_type);
    setIntervalSeconds(data.interval_seconds);
  }

  const isInterval = scheduleType === "INTERVAL";

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await authFetch(
        `/api/v1/data-integration/sources/${sourceId}/schedule/`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          // Preserve an INTERVAL schedule's type + interval (the editor can
          // only pause/resume it) rather than silently rewriting it to CRON.
          body: JSON.stringify(
            isInterval
              ? {
                  schedule_type: "INTERVAL",
                  interval_seconds: intervalSeconds,
                  is_enabled: enabled,
                }
              : {
                  schedule_type: "CRON",
                  cron_expression: cron,
                  timezone,
                  is_enabled: enabled,
                },
          ),
        },
      );
      if (!res.ok) {
        throw new Error(getErrorMessage(await res.json().catch(() => ({}))));
      }
      return res.json() as Promise<IngestionSchedule>;
    },
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["source-schedule", sourceId] });
      setLastRunAt(updated.last_run_at);
      toast.success(enabled ? "Schedule saved" : "Schedule paused");
    },
    onError: (err) => toast.error(getErrorMessage(err)),
  });

  const cronValid = isValidCron(cron);
  const description = describeCron(cron);
  const nextRun = enabled && cronValid ? getNextRun(cron, timezone) : null;
  // Mirror the backend: an enabled CRON schedule must carry a valid 5-field
  // cron. INTERVAL schedules are pause/resume-only here, so cron validity
  // doesn't gate their save.
  const saveDisabled =
    saveMutation.isPending || (enabled && !isInterval && !cronValid);

  const activePreset =
    PRESETS.find((p) => p.cron === cron && p.cron !== "")?.cron ?? "";

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" />
          Loading schedule…
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-5">
        <div className="flex items-center gap-2">
          <CalendarClock className="size-4 text-emerald-600" />
          <h3 className="text-sm font-medium">Ingestion Schedule</h3>
          <span
            className={`ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
              enabled
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400"
                : "bg-muted text-muted-foreground"
            }`}
          >
            {enabled ? "Active" : "Paused"}
          </span>
        </div>

        {isInterval ? (
          <div className="rounded-lg border border-border/60 bg-muted/40 px-3.5 py-3 text-xs text-muted-foreground">
            This source uses an{" "}
            <span className="font-medium text-foreground">interval</span>{" "}
            schedule — runs every{" "}
            <span className="font-medium text-foreground">
              {intervalSeconds ?? "?"}s
            </span>
            . You can pause or resume it here; editing the interval isn&apos;t
            supported in this editor yet.
          </div>
        ) : (
          <>
        {/* Preset + cron */}
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="schedule-preset">Preset</Label>
            <select
              id="schedule-preset"
              className={`${SELECT_CLASS} w-full`}
              value={activePreset}
              onChange={(e) => setCron(e.target.value)}
            >
              {PRESETS.map((p) => (
                <option key={p.label} value={p.cron}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cron-expression">Cron expression</Label>
            <Input
              id="cron-expression"
              value={cron}
              onChange={(e) => setCron(e.target.value)}
              placeholder="0 2 * * *"
              className="font-mono"
              aria-invalid={cron.length > 0 && !cronValid}
            />
          </div>
        </div>

        {/* Validation / preview line */}
        {cron.length > 0 &&
          (cronValid ? (
            <p className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="size-3.5" />
              {description} ({timezone})
            </p>
          ) : (
            <p className="flex items-center gap-1.5 text-xs text-red-600">
              <AlertCircle className="size-3.5" />
              Enter a valid 5-field cron expression (e.g. &quot;0 2 * * *&quot;).
            </p>
          ))}

        {/* Timezone */}
        <div className="space-y-1.5">
          <Label htmlFor="schedule-timezone">Timezone</Label>
          <select
            id="schedule-timezone"
            className={`${SELECT_CLASS} w-full sm:w-64`}
            value={timezone}
            onChange={(e) => setTimezone(e.target.value)}
          >
            {(TIMEZONES.includes(timezone)
              ? TIMEZONES
              : [timezone, ...TIMEZONES]
            ).map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </div>
          </>
        )}

        {/* Run timestamps */}
        <div className="grid gap-3 sm:grid-cols-2 text-xs">
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Clock className="size-3.5" />
            <span className="font-medium text-foreground">Last run:</span>{" "}
            {formatTimestamp(lastRunAt)}
          </div>
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <CalendarClock className="size-3.5" />
            <span className="font-medium text-foreground">Next run:</span>{" "}
            {nextRun
              ? nextRun.toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : enabled
                ? "—"
                : "Paused"}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setEnabled((v) => !v)}
            className="gap-1.5"
          >
            {enabled ? (
              <>
                <Pause className="size-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="size-3.5" /> Resume
              </>
            )}
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => saveMutation.mutate()}
            disabled={saveDisabled}
            className="gap-1.5"
          >
            {saveMutation.isPending && (
              <Loader2 className="size-3.5 animate-spin" />
            )}
            Save schedule
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

import type { DDSStatus } from "@/lib/api/types";

/**
 * Visual style map for DDS status badges.
 * Single source of truth — imported by both the list page and the detail page.
 *
 * Status semantics:
 *   DRAFT / UNDER_REVIEW  → neutral / amber  (work-in-progress)
 *   APPROVED              → green            (compliance positive)
 *   SUBMITTED             → amber-gold       (sent to TRACES, awaiting confirmation)
 *   REJECTED              → red              (compliance negative)
 *   WITHDRAWN             → muted            (voided)
 */
export const DDS_STATUS_STYLE: Record<
  DDSStatus,
  { bg: string; text: string; dot: string; label: string }
> = {
  DRAFT: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    label: "Draft",
  },
  UNDER_REVIEW: {
    bg: "bg-[#C7956D]/10",
    text: "text-[#A07850]",
    dot: "bg-[#C7956D]",
    label: "Under Review",
  },
  APPROVED: {
    bg: "bg-[#34D399]/10",
    text: "text-[#1A6B5A]",
    dot: "bg-[#34D399]",
    label: "Approved",
  },
  SUBMITTED: {
    bg: "bg-[#E8C468]/10",
    text: "text-[#9A7D2E]",
    dot: "bg-[#E8C468]",
    label: "Submitted",
  },
  REJECTED: {
    bg: "bg-[#C23D3D]/10",
    text: "text-[#C23D3D]",
    dot: "bg-[#C23D3D]",
    label: "Rejected",
  },
  WITHDRAWN: {
    bg: "bg-muted",
    text: "text-muted-foreground",
    dot: "bg-muted-foreground",
    label: "Withdrawn",
  },
};

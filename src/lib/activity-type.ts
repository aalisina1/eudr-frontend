import type { ActivityType } from "@/lib/api/types";

/**
 * The EUDR activity types, with the gloss a compliance officer needs to pick
 * the right one.
 *
 * These three strings were duplicated verbatim in four files: the DDS form, the
 * operator-identity form and card, and the File DDS composer. A fifth copy was
 * one screen away from existing. Defining them once means the wording, and the
 * legal gloss attached to it, cannot drift between the place a default is set
 * and the place a statement is actually filed.
 *
 * The gloss is parenthesised rather than joined with an em dash (spec
 * Decision 3, enforced by `grovetrace-voice/no-em-dash`). Parentheses are the
 * right punctuation for a definition inside a `<option>` anyway.
 */
export const ACTIVITY_TYPE_LABEL: Record<ActivityType, string> = {
  DOMESTIC: "Domestic (placing product on the EU market)",
  IMPORT: "Import (release for free circulation)",
  EXPORT: "Export (leaving the EU)",
};

/** Rendered where no default has been chosen and the user must pick per statement. */
export const ACTIVITY_TYPE_UNSET_LABEL = "No default, ask each time";

/** `[value, label]` pairs, for building a `<select>` without repeating the map. */
export const ACTIVITY_TYPE_OPTIONS = Object.entries(ACTIVITY_TYPE_LABEL) as [
  ActivityType,
  string,
][];

/**
 * Standardized extraction of a human-readable message from a failed API call.
 *
 * `authFetch` is a thin wrapper — it does not throw or parse error bodies
 * itself (see docs/ARCHITECTURE.md). Call sites that want a friendly message
 * for a toast (rather than branching on `res.ok`) should call this helper
 * explicitly, e.g.:
 *
 *   if (!res.ok) {
 *     const body = await res.json().catch(() => ({}));
 *     throw new Error(getErrorMessage(body));
 *   }
 *   // ...
 *   onError: (err) => toast.error(getErrorMessage(err)),
 *
 * It does NOT change authFetch's contract or make it throw automatically.
 */

const DEFAULT_ERROR_MESSAGE = "Something went wrong. Please try again.";

/**
 * Extract a human-readable message from an API error shape or a thrown Error.
 *
 * Checks, in order:
 * 1. `detail` (DRF's standard error field)
 * 2. `error` (used by some custom endpoints, e.g. sync/promote actions)
 * 3. DRF field-validation errors — an object of `{ field: string[] }` — joined into one line
 * 4. `Error.message` (for errors already thrown by a mutationFn)
 * 5. A generic fallback string
 */
export function getErrorMessage(err: unknown): string {
  if (err == null) return DEFAULT_ERROR_MESSAGE;

  if (typeof err === "string" && err.trim()) return err;

  if (err instanceof Error && err.message.trim()) return err.message;

  if (typeof err === "object") {
    const body = err as Record<string, unknown>;

    if (typeof body.detail === "string" && body.detail.trim()) {
      return body.detail;
    }

    if (typeof body.error === "string" && body.error.trim()) {
      return body.error;
    }

    // DRF field-validation error shape: { field_name: ["msg1", "msg2"], ... }
    const fieldMessages = Object.values(body)
      .flat()
      .filter((v): v is string => typeof v === "string" && v.trim().length > 0);
    if (fieldMessages.length > 0) {
      return fieldMessages.join(", ");
    }
  }

  return DEFAULT_ERROR_MESSAGE;
}

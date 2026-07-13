"use client";

import { useQuery } from "@tanstack/react-query";
import { authFetch } from "@/lib/api/client";
import { getErrorMessage } from "@/lib/api/errors";
import type { User } from "@/lib/api/types";

async function fetchCurrentUser(): Promise<User> {
  const res = await authFetch("/api/v1/auth/users/me/");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(getErrorMessage(err));
  }
  return res.json() as Promise<User>;
}

/**
 * The current authenticated user — role + organization context
 * (`/auth/users/me/`, eudr-app #72). Shared under one `["me"]` query key so
 * every consumer (Settings profile card, the TRACES credentials pre-check
 * role gate #36/#70, the credentials-card "Add credentials" role gate #70)
 * dedupes onto a single request instead of each firing its own fetch.
 */
export function useCurrentUser() {
  return useQuery({
    queryKey: ["me"],
    queryFn: fetchCurrentUser,
  });
}

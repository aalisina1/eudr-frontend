"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { GrovetraceMark } from "@/components/brand/grovetrace-mark";
import { login } from "@/lib/api/client";
import { auth } from "@/lib/auth";
import { getErrorMessage } from "@/lib/api/errors";
import { PRODUCT_NAME } from "@/lib/brand";
import { formatDate } from "@/lib/format";
import type { InvitationPreview } from "@/lib/api/types";

const ROLE_LABEL: Record<string, string> = {
  ADMIN: "an administrator",
  COMPLIANCE_OFFICER: "a compliance officer",
  VIEWER: "a viewer",
  SUPPLIER_CONTACT: "a supplier contact",
};

const API = process.env.NEXT_PUBLIC_API_URL ?? "";

/**
 * Accepting an invitation. Unauthenticated by necessity: the person holding
 * this link has no account yet, which is the whole point.
 *
 * Deliberately does not use `authFetch` — there is no session to attach or
 * refresh, and routing an anonymous call through the 401-refresh-retry path
 * would bounce the invitee to the login screen they cannot use.
 */
export function AcceptInvitation({ token }: { token: string }) {
  const router = useRouter();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const {
    data: invitation,
    isLoading,
    error: previewError,
  } = useQuery<InvitationPreview>({
    queryKey: ["invitation-preview", token],
    queryFn: async () => {
      const res = await fetch(`${API}/api/v1/accounts/invitations/token/${token}/`);
      if (!res.ok) {
        throw new Error(
          res.status === 410
            ? "This invitation is no longer valid. It may have been used, withdrawn or expired. Ask your administrator for a new one."
            : "This invitation link is not valid.",
        );
      }
      return res.json();
    },
    retry: false,
  });

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/v1/accounts/invitations/accept/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          first_name: firstName,
          last_name: lastName,
          password,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(getErrorMessage(body));
      }
      // Straight in, rather than handing them a login form for an account they
      // created two seconds ago.
      const tokens = await login(invitation!.email, password);
      auth.setTokens(tokens.access, tokens.refresh);
      router.push("/");
    } catch (caught) {
      setError(getErrorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-8">
        <div className="flex items-center gap-2.5">
          <GrovetraceMark className="size-7" />
          <span className="text-lg font-medium">{PRODUCT_NAME}</span>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        ) : previewError ? (
          <div className="space-y-4">
            <h1 className="text-display text-3xl leading-tight font-light italic">
              This link has expired
            </h1>
            <p className="rounded-xl border border-destructive/15 bg-destructive/8 px-4 py-3 text-sm text-destructive">
              {(previewError as Error).message}
            </p>
            <Button variant="ghost" onClick={() => router.push("/login")}>
              Go to sign in
            </Button>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              <h1 className="text-display text-3xl leading-tight font-light italic">
                Join {invitation!.organization_name}
              </h1>
              <p className="text-sm text-muted-foreground">
                You have been invited as {ROLE_LABEL[invitation!.role] ?? invitation!.role},
                using {invitation!.email}. This link works once, and expires on{" "}
                {formatDate(invitation!.expires_at)}.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="first-name">First name</Label>
                  <Input
                    id="first-name"
                    value={firstName}
                    onChange={(event) => setFirstName(event.target.value)}
                    autoComplete="given-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="last-name">Last name</Label>
                  <Input
                    id="last-name"
                    value={lastName}
                    onChange={(event) => setLastName(event.target.value)}
                    autoComplete="family-name"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="password">Choose a password</Label>
                <Input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                />
              </div>

              {error && (
                <p className="rounded-xl border border-destructive/15 bg-destructive/8 px-4 py-3 text-sm text-destructive">
                  {error}
                </p>
              )}

              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Setting up your account" : "Accept invitation"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}

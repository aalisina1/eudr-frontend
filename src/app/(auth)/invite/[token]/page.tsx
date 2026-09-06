"use client";

import { use } from "react";

import { AcceptInvitation } from "@/components/admin/accept-invitation";

/** Thin route wrapper. The screen itself is a component taking a plain token,
 * so it can be rendered directly in a test without a Suspense boundary around
 * `use()` — and so the route file stays one job. */
export default function AcceptInvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = use(params);
  return <AcceptInvitation token={token} />;
}

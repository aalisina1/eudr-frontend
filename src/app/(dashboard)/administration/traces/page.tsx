"use client";

import { CredentialsCard } from "@/components/traces/credentials-card";
import { OperatorIdentityCard } from "@/components/traces/operator-identity-card";
import { PageHeader } from "@/components/page-header";

/**
 * TRACES connection and operator identity — moved off `/settings` by #158.
 *
 * Both are `IsAdmin` on the backend and both describe the *organisation*, not
 * the person signed in. They sat on the personal settings page by accident of
 * history, which is what made that page's shape depend on your role.
 */
export default function AdministrationTracesPage() {
  return (
    <>
      <PageHeader
        title="TRACES"
        description="How this organisation connects to the EU TRACES system, and the identity it files statements under. Both are needed before a statement can be submitted."
      />
      <CredentialsCard />
      <OperatorIdentityCard />
    </>
  );
}

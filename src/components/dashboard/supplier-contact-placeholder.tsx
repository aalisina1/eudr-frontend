/**
 * Tier-less terminal state for SUPPLIER_CONTACT (dashboard-redesign.md
 * Journeys: "explicitly not the cockpit" — every tier is cross-supplier,
 * org-wide data, and no supplier-scoped surface exists anywhere in the app
 * yet). Rendered in place, not a redirect — `/shipments`'s own
 * SUPPLIER_CONTACT block already redirects here, so this has to be a
 * landing spot, not another bounce.
 */
export function SupplierContactPlaceholder() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-2 px-6 text-center">
      <p className="text-lg font-medium text-foreground">No organization-wide compliance data here</p>
      <p className="max-w-md text-sm text-muted-foreground">
        You don&apos;t have access to organization-wide compliance data — contact your organization administrator.
      </p>
    </div>
  );
}

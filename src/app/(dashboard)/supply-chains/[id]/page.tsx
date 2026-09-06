import { redirect } from "next/navigation";

/** #121: see ../page.tsx. Detail links shared before the rename still land. */
export default async function SupplyChainDetailRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/sourcing/${encodeURIComponent(id)}`);
}

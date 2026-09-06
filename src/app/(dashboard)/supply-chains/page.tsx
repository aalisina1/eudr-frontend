import { redirect } from "next/navigation";

/** #121: the route now matches its nav label. Kept as a redirect, like
 *  /data-import, so bookmarks and shared links from before the rename survive. */
export default function SupplyChainsRedirect() {
  redirect("/sourcing");
}

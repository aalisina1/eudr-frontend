import { redirect } from "next/navigation";

/** Administration has no landing page of its own; Users is the first thing an
 * administrator wants. */
export default function AdministrationIndexPage() {
  redirect("/administration/users");
}

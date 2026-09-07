import { redirect } from "next/navigation";

/** Administration has no landing page of its own; People is the first thing an
 * administrator wants. */
export default function AdministrationIndexPage() {
  redirect("/administration/people");
}

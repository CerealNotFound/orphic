import { redirect } from "next/navigation";
import { getViewer } from "./auth";
import type { Member } from "./members";

/** For app pages: returns the signed-in teammate, or redirects to the sign-in / connect screen. */
export async function requireMember(): Promise<{ member: Member; email: string; name: string; image: string | null }> {
  const v = await getViewer();
  if (!v) redirect("/signin");
  if (!v.member) redirect("/signin?unlinked=1");
  return { member: v.member, email: v.email, name: v.name, image: v.image };
}

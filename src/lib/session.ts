import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

/** Call at the top of every admin page and Server Action. */
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session;
}

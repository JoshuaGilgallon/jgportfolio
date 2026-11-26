import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

// call in every admin page and action
export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/admin/login");
  return session;
}

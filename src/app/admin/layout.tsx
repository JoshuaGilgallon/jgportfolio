import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s - Admin" },
  robots: { index: false, follow: false },
};

// Admin pages read the session on every request, so they never prerender.
export const instant = false;

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s - Admin" },
  robots: { index: false, follow: false },
};

// reads the session, so never prerendered
export const instant = false;

export default function AdminRootLayout({ children }: { children: React.ReactNode }) {
  return children;
}

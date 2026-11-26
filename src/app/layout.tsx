import type { Metadata, Viewport } from "next";
import { Instrument_Sans } from "next/font/google";
import { site } from "@/lib/site";
import "./globals.css";

const instrument = Instrument_Sans({
  subsets: ["latin"],
  axes: ["wdth"],
  variable: "--font-instrument",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: { default: `${site.name} - ${site.fullName}`, template: `%s - ${site.name}` },
  description: site.description,
  authors: [{ name: site.fullName }],
  openGraph: { type: "website", siteName: site.name, locale: "en_GB" },
  twitter: { card: "summary_large_image" },
  alternates: { types: { "application/rss+xml": "/feed.xml" } },
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // data-home gets set before hydration
    <html lang="en-GB" className={instrument.variable} suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}

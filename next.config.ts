import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV !== "production";
const isHttps = (process.env.SITE_URL ?? "").startsWith("https://");

// No third-party origins are used anywhere. Next.js inlines its bootstrap
// scripts, so 'unsafe-inline' stays for scripts (nonces would force every
// page to render dynamically and give up static prerendering).
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' https: data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
  ...(isHttps ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  cacheLife: {
    // Content changes only through /admin, which calls updateTag() so edits
    // show immediately. Tag state lives in server memory, though, so a
    // restart (or a second instance) can miss an invalidation; regenerating
    // in the background every 10 minutes bounds that to minutes, not forever.
    content: {
      stale: 300,
      revalidate: 600,
      expire: 60 * 60 * 24 * 30,
    },
  },
  async redirects() {
    return [{ source: "/admin", destination: "/admin/posts", permanent: false }];
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default nextConfig;

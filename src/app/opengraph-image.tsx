import { ImageResponse } from "next/og";
import { site } from "@/lib/site";

export const alt = `${site.name} — ${site.fullName}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "flex-end",
          padding: "88px 96px",
          background: "#ffffff",
          color: "#1d1d1f",
        }}
      >
        <div style={{ fontSize: 96, fontWeight: 600, letterSpacing: "-0.03em" }}>Josh</div>
        <div style={{ marginTop: 16, fontSize: 40, color: "#6e6e73", letterSpacing: "-0.01em" }}>
          Cloud architecture, low-level systems, and design.
        </div>
      </div>
    ),
    size,
  );
}

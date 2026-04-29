import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "VentraMatch — fundraising matched.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/**
 * Generated OG image. Renders at build / on demand via next/og.
 * Beige page bg, big "Fundraising, matched." with the "matched." in
 * brand green to mirror the wordmark.
 */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 96px",
          backgroundColor: "#f6efe8",
          fontFamily: "Inter, sans-serif",
        }}
      >
        {/* Top: wordmark */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <svg
            width="44"
            height="44"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M 12 22 L 36 22 L 48 64 L 60 22 L 84 22 L 48 84 Z" fill="#22c55e" />
            <path d="M 90 34 L 78 34 L 64 78 L 76 78 Z" fill="#22c55e" />
          </svg>
          <span style={{ fontSize: 32, fontWeight: 600, letterSpacing: "-0.012em" }}>
            <span style={{ color: "#111827" }}>Ventra</span>
            <span style={{ color: "#16a34a" }}>match</span>
          </span>
        </div>

        {/* Middle: headline */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <h1
            style={{
              margin: 0,
              fontSize: 144,
              fontWeight: 600,
              letterSpacing: "-0.025em",
              lineHeight: 0.98,
            }}
          >
            <div style={{ color: "#111827" }}>Fundraising,</div>
            <div style={{ color: "#16a34a" }}>matched.</div>
          </h1>
        </div>

        {/* Bottom: subhead */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            gap: 32,
            color: "#6b7280",
            fontSize: 28,
            lineHeight: 1.4,
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <div>Founders find investors who back their stage.</div>
            <div>Investors find startups in their thesis.</div>
          </div>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: 18,
              letterSpacing: "0.16em",
              textTransform: "uppercase",
              color: "#9ca3af",
            }}
          >
            ventramatch.com
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}

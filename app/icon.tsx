import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 32, height: 32 };
export const contentType = "image/png";

/** Browser tab favicon — V/ glyph at 32×32. */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#f6efe8",
          borderRadius: 6,
        }}
      >
        <svg width="26" height="26" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 12 22 L 36 22 L 48 64 L 60 22 L 84 22 L 48 84 Z" fill="#22c55e" />
          <path d="M 90 34 L 78 34 L 64 78 L 76 78 Z" fill="#22c55e" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

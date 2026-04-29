import { ImageResponse } from "next/og";

export const runtime = "edge";
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

/** iOS home-screen icon. Rounded corners are added by iOS automatically. */
export default function AppleIcon() {
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
        }}
      >
        <svg width="120" height="120" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
          <path d="M 12 22 L 36 22 L 48 64 L 60 22 L 84 22 L 48 84 Z" fill="#22c55e" />
          <path d="M 90 34 L 78 34 L 64 78 L 76 78 Z" fill="#22c55e" />
        </svg>
      </div>
    ),
    { ...size },
  );
}

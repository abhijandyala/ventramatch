import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  devIndicators: false,

  // Sprint 12.E: image optimization + allowed remote domains.
  images: {
    // Presigned S3 URLs and OAuth provider avatars are on remote domains.
    remotePatterns: [
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
      { protocol: "https", hostname: "media.licdn.com" },
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
    ],
    // WebP is the default; AVIF is smaller but slower to encode. Keep
    // WebP for v1 upload latency.
    formats: ["image/webp"],
  },

  // Tree-shake server-only modules out of the client bundle.
  serverExternalPackages: ["@aws-sdk/client-s3", "@aws-sdk/s3-request-presigner", "postgres", "bcryptjs"],
};

export default nextConfig;

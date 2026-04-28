import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  images: {
    remotePatterns: [
      // AWS S3 / CloudFront image hosts will be added when uploads land.
    ],
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Hide the floating Next.js dev indicator (the "N" badge in the corner).
  devIndicators: false,
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@resvg/resvg-js", "satori"],
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;

import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  serverExternalPackages: ["@resvg/resvg-js", "satori"],
  eslint: { ignoreDuringBuilds: true },
  async rewrites() {
    return [{ source: "/eleito", destination: "/apresentacao.html" }];
  },
};

export default nextConfig;

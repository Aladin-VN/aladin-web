import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Vercel deployment optimizations
  serverExternalPackages: ['@libsql/client'],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
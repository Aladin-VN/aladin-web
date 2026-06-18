import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  serverExternalPackages: ["@neondatabase/serverless", "@prisma/adapter-neon"],
};

export default nextConfig;
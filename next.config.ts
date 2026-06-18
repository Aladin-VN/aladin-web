import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Neon serverless driver needs to be bundled by webpack (not external)
  // @neondatabase/serverless works natively in Vercel serverless functions
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
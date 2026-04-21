import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* Netlify handles its own output format via @netlify/plugin-nextjs */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;

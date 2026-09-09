import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack (Next.js 16 default)
  turbopack: {},

  // Increase timeout for API route model loading on first request
  staticPageGenerationTimeout: 120,

  // Allow dynamic imports
  experimental: {
    esmExternals: true,
  },

  // Skip TypeScript checking during build
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

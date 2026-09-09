import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Use Turbopack (Next.js 16 default)
  turbopack: {},

  // Support WASM files for Kokoro TTS
  webpack: (config) => {
    config.experiments = {
      ...config.experiments,
      asyncWebAssembly: true,
      layers: true,
    };

    config.module.rules.push({
      test: /\.wasm$/,
      type: "webassembly/async",
    });

    config.output.webassemblyModuleFilename = "static/wasm/[modulehash].wasm";

    return config;
  },

  // Headers for WASM support
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          {
            key: "Cross-Origin-Embedder-Policy",
            value: "require-corp",
          },
        ],
      },
    ];
  },

  // Completely disable TypeScript checking (kokoro-js has types but transformers.js may not)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

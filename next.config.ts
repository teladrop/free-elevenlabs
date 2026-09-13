import type { NextConfig } from "next";

// Deploy trigger: force Vercel redeploy
const nextConfig: NextConfig = {
  turbopack: {},

  // Prevent webpack from trying to bundle Node.js-specific deps of edge-tts-universal
  serverExternalPackages: ["edge-tts-universal", "ws", "https-proxy-agent"],

  webpack: (config, { isServer }) => {
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

    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        path: false,
        crypto: false,
      };
    }

    return config;
  },

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Cross-Origin-Opener-Policy", value: "same-origin-allow-popups" },
          { key: "Cross-Origin-Embedder-Policy", value: "require-corp" },
        ],
      },
    ];
  },

  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;

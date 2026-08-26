import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@xcollab/core"],
  agentRules: false,
  // Self-contained server build for the air-gapped image (Dockerfile.k3s);
  // tracing root is the monorepo root so workspace deps are included.
  output: "standalone",
  outputFileTracingRoot: path.join(__dirname, "../.."),
  // Next 16.3 (Turbopack) traces only @swc/helpers/cjs into the standalone
  // output, but the runtime require-hook resolves its esm/ files — force the
  // whole package in, or the container dies at boot with MODULE_NOT_FOUND.
  outputFileTracingIncludes: {
    "/*": ["../../node_modules/.pnpm/@swc+helpers@*/node_modules/@swc/helpers/**"],
  },
};

export default nextConfig;

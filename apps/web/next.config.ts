import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@xcollab/core"],
  agentRules: false,
};

export default nextConfig;

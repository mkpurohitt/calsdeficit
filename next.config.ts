import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for the Cloud Run Docker image
  output: "standalone",
};

export default nextConfig;

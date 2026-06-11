import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: [
    "192.168.31.142",
    "192.168.*.*",
    "100.*.*.*",
    "*.local",
  ],
};

export default nextConfig;

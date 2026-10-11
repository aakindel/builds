import { type NextConfig } from "next";

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_AGENT === "1" ? ".next-agent" : undefined,
};

export default nextConfig;

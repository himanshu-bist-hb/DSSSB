import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Limit build/prerender worker processes; the default (one per CPU) exhausts RAM on
  // this machine and crashes workers ("Jest worker ... child process exceptions").
  experimental: { cpus: 2 },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "lh3.googleusercontent.com" },
    ],
  },
};

export default nextConfig;

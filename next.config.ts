import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Whitelist Sanity's image CDN so next/image can fetch + optimise the
    // assets editors upload via Studio. Only the production host — Sanity
    // serves all project assets from the same domain.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.sanity.io",
      },
    ],
  },
};

export default nextConfig;

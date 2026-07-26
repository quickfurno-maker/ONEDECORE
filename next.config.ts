import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "lpurlfmpvriyvpkujvyl.supabase.co",
        port: "",
        pathname: "/storage/v1/object/public/portfolio-public/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "127.0.0.1",
        port: "54321",
        pathname: "/storage/v1/object/public/portfolio-public/**",
        search: "",
      },
      {
        protocol: "http",
        hostname: "localhost",
        port: "54321",
        pathname: "/storage/v1/object/public/portfolio-public/**",
        search: "",
      },
    ],
  },
};

export default nextConfig;

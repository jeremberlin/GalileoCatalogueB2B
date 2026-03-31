import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  output: "export",
  basePath: isProd ? "/GalileoCatalogueB2B" : "",
  assetPrefix: isProd ? "/GalileoCatalogueB2B/" : "",
  images: {
    unoptimized: true,
  },
};

export default nextConfig;

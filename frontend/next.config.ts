import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/v1/:path*",
        destination: "http://localhost:8000/api/v1/:path*",
      },
      {
        source: "/business-assets/:path*",
        destination: "http://localhost:8000/business-assets/:path*",
      },
      {
        source: "/generations/:path*",
        destination: "http://localhost:8000/generations/:path*",
      },
      // email HTML templates reference /business_assets/ (underscore) internally
      {
        source: "/business_assets/:path*",
        destination: "http://localhost:8000/business-assets/:path*",
      },
    ];
  },
};

export default nextConfig;

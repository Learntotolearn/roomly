import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:8090/api/:path*',
      },
    ];
  },
  eslint: {
    ignoreDuringBuilds: true,
  },

};

export default nextConfig;
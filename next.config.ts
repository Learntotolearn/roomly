import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  output: 'standalone',
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  
  // 添加安全策略配置 - 允许麦克风访问
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Permissions-Policy',
            value: 'microphone=*, camera=*',
          },
        ],
      },
    ];
  },
  
  // 确保在开发环境中支持媒体设备
  experimental: {
    serverComponentsExternalPackages: [],
  },
};

export default nextConfig;

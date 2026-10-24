import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@senku/experiment-schema'],
  agentRules: false,
  experimental: { proxyTimeout: 120000 },
  async rewrites() {
    const server = process.env.SENKU_API_INTERNAL_URL ?? 'http://localhost:3001';
    return [
      { source: '/backend/:path*', destination: `${server}/:path*` },
      { source: '/socket.io/:path*', destination: `${server}/socket.io/:path*` },
    ];
  },
};
export default config;

import type { NextConfig } from 'next';
const config: NextConfig = {
  output: 'standalone',
  transpilePackages: ['@senku/experiment-schema'],
  agentRules: false,
  htmlLimitedBots: /.*/,
  async headers(){return [{source:'/sw.js',headers:[{key:'Cache-Control',value:'no-cache, no-store, must-revalidate'},{key:'Service-Worker-Allowed',value:'/'}]},{source:'/manifest.webmanifest',headers:[{key:'Cache-Control',value:'public, max-age=3600'}]},{source:'/social/:path*',headers:[{key:'Cache-Control',value:'public, max-age=86400'}]}];},
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

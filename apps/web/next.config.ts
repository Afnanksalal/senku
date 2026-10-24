import type { NextConfig } from 'next';
const config: NextConfig = { output: 'standalone', transpilePackages: ['@senku/experiment-schema'] };
export default config;

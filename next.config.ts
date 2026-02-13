import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Disable standalone output since we use a custom server
  output: undefined,
};

export default nextConfig;

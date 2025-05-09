/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
    ],
  },
  webpack(config) {
    config.watchOptions = {
      ...config.watchOptions,
      // Ignore the src/data directory to prevent HMR on data file changes
      // Also ignore .git and node_modules which Next.js usually does by default, but being explicit can help.
      ignored: [
        ...(config.watchOptions?.ignored || []),
        '**/.git/**',
        '**/node_modules/**',
        '**/src/data/**',
        '**/.next/**',
      ],
      poll: 1000, // Check for changes every second, if default watching is problematic
      aggregateTimeout: 300, // Delay before rebuilding
    };
    return config;
  },
};

export default nextConfig;

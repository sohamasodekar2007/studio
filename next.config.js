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
  webpack: (config) => {
    config.watchOptions = config.watchOptions || {}; // Ensure watchOptions is an object

    let existingIgnored = [];
    if (config.watchOptions.ignored) {
        if (Array.isArray(config.watchOptions.ignored)) {
            existingIgnored = config.watchOptions.ignored;
        } else {
            // If it's not an array but exists (e.g., a string or RegExp), wrap it in an array
            existingIgnored = [config.watchOptions.ignored];
        }
    }

    config.watchOptions.ignored = [
        ...existingIgnored,
        '**/.git/**',
        '**/node_modules/**',
        '**/src/data/**', // Keep ignoring data directory
        '**/.next/**',
    ];
    
    // Ensure poll and aggregateTimeout are numbers, or provide defaults if not set
    config.watchOptions.poll = typeof config.watchOptions.poll === 'number' ? config.watchOptions.poll : 1000;
    config.watchOptions.aggregateTimeout = typeof config.watchOptions.aggregateTimeout === 'number' ? config.watchOptions.aggregateTimeout : 300;
    
    return config;
  },
};

export default nextConfig;

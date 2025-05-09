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
    // Ensure watchOptions exists and is an object, then modify it.
    // Create a new object for watchOptions to avoid modifying a potentially frozen object.
    const newWatchOptions = {
      ...(config.watchOptions || {}), // Spread existing options
      poll: typeof config.watchOptions?.poll === 'number' ? config.watchOptions.poll : 1000,
      aggregateTimeout: typeof config.watchOptions?.aggregateTimeout === 'number' ? config.watchOptions.aggregateTimeout : 300,
    };

    let existingIgnored = [];
    if (newWatchOptions.ignored) {
        if (Array.isArray(newWatchOptions.ignored)) {
            existingIgnored = newWatchOptions.ignored;
        } else {
            // If it's not an array but exists (e.g., a string or RegExp), wrap it in an array
            existingIgnored = [newWatchOptions.ignored];
        }
    }

    // Define the paths to be added to the ignored list
    const pathsToIgnore = [
        '**/.git/**',
        '**/node_modules/**',
        '**/src/data/**', 
        '**/.next/**',
    ];

    // Add new paths to the existing ignored paths, ensuring no duplicates
    newWatchOptions.ignored = Array.from(new Set([...existingIgnored, ...pathsToIgnore]));
    
    // Assign the new or modified watchOptions back to the config
    config.watchOptions = newWatchOptions;
    
    return config;
  },
};

export default nextConfig;

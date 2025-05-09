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
    // Create a new watchOptions object, copying from existing if it exists
    // or initializing if it doesn't exist.
    const newWatchOptions = { ...(config.watchOptions || {}) };

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
    
    // Set poll and aggregateTimeout, ensuring they are numbers
    newWatchOptions.poll = typeof newWatchOptions.poll === 'number' ? newWatchOptions.poll : 1000;
    newWatchOptions.aggregateTimeout = typeof newWatchOptions.aggregateTimeout === 'number' ? newWatchOptions.aggregateTimeout : 300;
    
    // Assign the new or modified watchOptions back to the config
    config.watchOptions = newWatchOptions;
    
    return config;
  },
};

export default nextConfig;

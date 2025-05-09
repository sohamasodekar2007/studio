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
    };

    let existingIgnored = [];
    if (newWatchOptions.ignored) {
        if (Array.isArray(newWatchOptions.ignored)) {
            existingIgnored = newWatchOptions.ignored.filter(path => typeof path === 'string' && path.trim() !== '');
        } else if (typeof newWatchOptions.ignored === 'string' && newWatchOptions.ignored.trim() !== '') {
            // If it's a non-empty string, wrap it in an array
            existingIgnored = [newWatchOptions.ignored];
        }
        // If it's an empty string or not a string/array, existingIgnored remains []
    }

    // Define the paths to be added to the ignored list
    const pathsToIgnore = [
        '**/.git/**',
        '**/node_modules/**',
        '**/src/data/**', 
        '**/.next/**',
    ];

    // Combine existing valid paths with new paths, ensuring no duplicates and filtering out any empty strings
    const combinedIgnored = Array.from(new Set([...existingIgnored, ...pathsToIgnore]));
    newWatchOptions.ignored = combinedIgnored.filter(path => typeof path === 'string' && path.trim() !== '');

    // Set poll and aggregateTimeout, ensuring they are numbers
    newWatchOptions.poll = typeof newWatchOptions.poll === 'number' ? newWatchOptions.poll : 1000;
    newWatchOptions.aggregateTimeout = typeof newWatchOptions.aggregateTimeout === 'number' ? newWatchOptions.aggregateTimeout : 300;
    
    // Assign the new or modified watchOptions back to the config
    config.watchOptions = newWatchOptions;
    
    return config;
  },
};

export default nextConfig;

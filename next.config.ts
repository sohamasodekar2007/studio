import type {NextConfig} from 'next';

const nextConfig: NextConfig = {
  /* config options here */
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
    // Allow serving local images for question previews if needed
    // domains: ['localhost'], // Only if serving local images directly via API
  },
   // Add static file serving configuration if needed for question bank images
   // This might not be necessary if images are directly linked via public path
   // async rewrites() {
   //   return [
   //     {
   //       source: '/question_bank_images/:subject/:lesson/:image',
   //       destination: '/data/question_bank/:subject/:lesson/images/:image', // Adjust if needed
   //     },
   //   ]
   // },
};

export default nextConfig;

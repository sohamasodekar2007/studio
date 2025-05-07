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
    // Local images from public/question_bank_images will be served directly,
    // so no 'domains' configuration needed for them if using relative paths in next/image src.
  },
   // Removed rewrite as images are now in public folder
   // async rewrites() {
   //   return [
   //     {
   //       source: '/question_bank_images/:subject/:lesson/images/:image',
   //       destination: '/data/question_bank/:subject/:lesson/images/:image', // This was incorrect path for public serving
   //     },
   //   ]
   // },
};

export default nextConfig;

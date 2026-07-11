import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Vercel Blob storage for post images
      { protocol: 'https', hostname: '*.public.blob.vercel-storage.com' },
    ],
  },
  // Tell the browser to cache static avatar PNGs for 1 year.
  // Vercel's CDN will also cache them at the edge.
  async headers() {
    return [
      {
        source: '/avatars/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
    ];
  },
};

export default nextConfig;

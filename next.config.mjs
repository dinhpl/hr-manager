/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // BACKEND_URL: trong Docker set http://backend:5501 để Next server (trong container) proxy tới backend
    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5501';
    return [
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

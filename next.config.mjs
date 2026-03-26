/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  async rewrites() {
    // BACKEND_URL: trong Docker set http://backend:5501 để Next server (trong container) proxy tới backend
    const backendUrl = process.env.BACKEND_URL || 'https://hr.onetech.vn';
    return [
      {
        source: '/uploads/:path*',
        destination: `${backendUrl}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

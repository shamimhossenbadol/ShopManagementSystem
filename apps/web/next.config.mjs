/** @type {import('next').NextConfig} */
const apiBase = process.env.INTERNAL_API_URL || 'http://api:5000';

const nextConfig = {
  reactStrictMode: true,
  output: 'standalone',
  async rewrites() {
    return [
      // Fastify Backend API proxy
      {
        source: '/api/v1/:path*',
        destination: `${apiBase}/api/v1/:path*`,
      },
      // Backward compatibility rewrites for /dashboard/routes to /routes
      {
        source: '/dashboard/products',
        destination: '/products',
      },
      {
        source: '/dashboard/inventory',
        destination: '/inventory',
      },
      {
        source: '/dashboard/purchases',
        destination: '/purchases',
      },
      {
        source: '/dashboard/customers',
        destination: '/customers',
      },
      {
        source: '/dashboard/suppliers',
        destination: '/suppliers',
      },
      {
        source: '/dashboard/expenses',
        destination: '/expenses',
      },
      {
        source: '/dashboard/returns',
        destination: '/returns',
      },
      {
        source: '/dashboard/cash',
        destination: '/cash',
      },
      {
        source: '/dashboard/reports',
        destination: '/reports',
      },
      {
        source: '/dashboard/audit-logs',
        destination: '/audit-logs',
      },
      {
        source: '/dashboard/users',
        destination: '/users',
      },
      {
        source: '/dashboard/settings',
        destination: '/settings',
      },
    ];
  },
};

export default nextConfig;

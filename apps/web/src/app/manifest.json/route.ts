import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  let appName = 'Sell & Inventory';
  let shortName = 'Sell & Inventory';

  try {
    const apiUrl = process.env.INTERNAL_API_URL || 'http://api:5000';
    const res = await fetch(`${apiUrl}/api/v1/settings/public`, { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data.data?.shop_name_en && data.data.shop_name_en.trim()) {
        appName = data.data.shop_name_en.trim();
        shortName = appName.length > 25 ? appName.slice(0, 25) : appName;
      }
    }
  } catch (err) {
    // fallback to default name
  }

  const manifest = {
    name: appName,
    short_name: shortName,
    description: `${appName} - Retail Point of Sale, Sales & Inventory Management System`,
    start_url: '/',
    id: '/',
    scope: '/',
    display: 'standalone',
    display_override: ['window-controls-overlay', 'standalone', 'minimal-ui'],
    background_color: '#020617',
    theme_color: '#1e40af',
    orientation: 'any',
    categories: ['business', 'finance', 'productivity', 'shopping'],
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any maskable',
      },
      {
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any maskable',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any maskable',
      },
    ],
    shortcuts: [
      {
        name: 'POS Terminal',
        short_name: 'POS',
        description: 'Open Cashier Checkout POS Terminal',
        url: '/pos',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Manager Dashboard',
        short_name: 'Dashboard',
        description: 'Open Store Financial Dashboard',
        url: '/dashboard',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Cash Drawer Shifts',
        short_name: 'Cash Shifts',
        description: 'Manage Drawer Opening Float & Closing Blind Counts',
        url: '/cash',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
      {
        name: 'Product Catalog',
        short_name: 'Products',
        description: 'Manage Product SKUs, Barcodes & Pricing',
        url: '/products',
        icons: [{ src: '/icon-192.png', sizes: '192x192' }],
      },
    ],
  };

  return NextResponse.json(manifest, {
    headers: {
      'Content-Type': 'application/manifest+json',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}

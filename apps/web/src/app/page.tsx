'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiRequest } from '@/lib/api';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    async function checkAuth() {
      const res = await apiRequest('/auth/me');
      if (res.success && res.data?.user) {
        router.replace('/pos');
      } else {
        router.replace('/login');
      }
    }
    checkAuth();
  }, [router]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 text-white">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-500 border-r-transparent"></div>
        <p className="mt-4 font-medium text-slate-300">Loading Shop System...</p>
      </div>
    </div>
  );
}

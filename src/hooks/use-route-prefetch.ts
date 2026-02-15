'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

const ROUTES = ['/chat', '/agents', '/settings'];

export function useRoutePrefetch() {
  const router = useRouter();
  useEffect(() => {
    const timer = setTimeout(() => {
      for (const route of ROUTES) {
        router.prefetch(route);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [router]);
}

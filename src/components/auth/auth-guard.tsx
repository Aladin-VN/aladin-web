'use client';

import { useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

// ============================================
// AuthGuard — Wraps admin pages, redirects to /auth/login if not authenticated
// ============================================

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('aladin-access-token');
    const userData = localStorage.getItem('aladin-user');

    if (!token || !userData) {
      router.replace('/auth/login');
      return;
    }

    try {
      const user = JSON.parse(userData);
      if (!user?.userId) {
        router.replace('/auth/login');
        return;
      }
    } catch {
      router.replace('/auth/login');
      return;
    }

    setChecking(false);
  }, [router]);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <>{children}</>;
}
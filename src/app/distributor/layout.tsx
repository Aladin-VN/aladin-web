'use client';

import { AdminSidebar } from '@/components/layout/admin-sidebar';
import { SidebarInset } from '@/components/ui/sidebar';
import { AuthGuard } from '@/components/auth/auth-guard';

export default function DistributorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <div className="flex min-h-screen">
        <AdminSidebar />
        <SidebarInset>
          {children}
        </SidebarInset>
      </div>
    </AuthGuard>
  );
}
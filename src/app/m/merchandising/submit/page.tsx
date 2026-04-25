'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { AuditSubmitForm } from '@/components/mobile/audit-submit-form';
import { useAppStore } from '@/stores/app.store';
import { useRouter } from 'next/navigation';

// ============================================
// Merchandising Audit Submit Page — /m/merchandising/submit
// ============================================

export default function MobileMerchandisingSubmitPage() {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Gửi ảnh trung bay', 'Submit Shelf Photo')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pt-3 pb-8">
        {/* Info banner */}
        <div className="mb-6 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900">
          <p className="text-xs text-blue-700 dark:text-blue-400 leading-relaxed">
            {t(
              'Chụp ảnh rõ kệ hàng trưng bày sản phẩm. Ảnh sẽ được gửi cho quản lý duyệt.',
              'Take a clear photo of the product display shelf. The photo will be sent to managers for review.'
            )}
          </p>
        </div>

        <AuditSubmitForm
          onSubmitted={() => {
            // Optionally navigate back after short delay
            setTimeout(() => router.back(), 1500);
          }}
          onCancel={() => router.back()}
        />
      </main>
    </div>
  );
}

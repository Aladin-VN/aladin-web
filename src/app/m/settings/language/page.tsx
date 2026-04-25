'use client';

import { MobileHeader } from '@/components/mobile/mobile-header';
import { useAppStore } from '@/stores/app.store';
import { Card, CardContent } from '@/components/ui/card';
import { Check } from 'lucide-react';
import { Globe } from 'lucide-react';

// ============================================
// Language Settings Page
// ============================================

const LANGUAGES = [
  {
    code: 'vi' as const,
    label: 'Tiếng Việt',
    sublabel: 'Vietnamese',
    flag: '🇻🇳',
    desc: 'Ngôn ngữ mặc định',
  },
  {
    code: 'en' as const,
    label: 'English',
    sublabel: 'Tiếng Anh',
    flag: '🇬🇧',
    desc: 'English (US)',
  },
] as const;

export default function LanguageSettingsPage() {
  const locale = useAppStore((s) => s.locale);
  const setLocale = useAppStore((s) => s.setLocale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  return (
    <div className="min-h-screen bg-background">
      <MobileHeader
        title={t('Ngôn ngữ', 'Language')}
        showBack
        showNotifications={false}
      />

      <main className="px-4 pb-4 pt-3 space-y-4">
        {/* Description */}
        <div className="flex items-start gap-3 px-1">
          <Globe className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <p className="text-sm font-medium">
              {t('Chọn ngôn ngữ hiển thị', 'Select display language')}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(
                'Ngôn ngữ sẽ thay đổi trên toàn bộ ứng dụng',
                'Language will change across the entire app'
              )}
            </p>
          </div>
        </div>

        {/* Language options */}
        <div className="space-y-2">
          {LANGUAGES.map((lang) => {
            const isSelected = locale === lang.code;
            return (
              <Card
                key={lang.code}
                className={`cursor-pointer transition-all ${
                  isSelected
                    ? 'border-primary ring-1 ring-primary/20'
                    : 'hover:border-muted-foreground/30'
                }`}
                onClick={() => setLocale(lang.code)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    {/* Flag */}
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-2xl">
                      {lang.flag}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold">{lang.label}</p>
                        {isSelected && (
                          <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full font-medium">
                            {t('Đang dùng', 'Active')}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{lang.desc}</p>
                    </div>

                    {/* Selected indicator */}
                    {isSelected && (
                      <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-3.5 w-3.5 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Preview section */}
        <Card className="bg-muted/30">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {t('Xem trước', 'Preview')}
            </p>
            <div className="space-y-2">
              <PreviewRow
                label={t('Trang chủ', 'Home')}
                value={locale === 'vi' ? 'Trang chủ' : 'Home'}
              />
              <PreviewRow
                label={t('Sản phẩm', 'Products')}
                value={locale === 'vi' ? 'Sản phẩm' : 'Products'}
              />
              <PreviewRow
                label={t('Đơn hàng', 'Orders')}
                value={locale === 'vi' ? 'Đơn hàng' : 'Orders'}
              />
              <PreviewRow
                label={t('Công nợ', 'Credit')}
                value={locale === 'vi' ? 'Công nợ' : 'Credit'}
              />
              <PreviewRow
                label={t('Tài khoản', 'Account')}
                value={locale === 'vi' ? 'Tài khoản' : 'Account'}
              />
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

// ============================================
// Preview Row
// ============================================

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

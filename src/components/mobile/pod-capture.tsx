'use client';

import { useState, useRef } from 'react';
import { useAppStore } from '@/stores/app.store';
import { Camera, Upload, X, Check, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// ============================================
// POD Capture Component (Driver use)
// ============================================

interface PodCaptureProps {
  onCapture?: (dataUrl: string) => void;
  photoUrl?: string | null;
  signatureUrl?: string | null;
  otp?: string | null;
  locale?: string;
  className?: string;
}

export function PodCapture({
  onCapture,
  photoUrl,
  signatureUrl,
  otp,
  className,
}: PodCaptureProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => (locale === 'vi' ? vi : en);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(photoUrl || null);
  const [uploading, setUploading] = useState(false);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setPreview(dataUrl);
      setUploading(false);
      onCapture?.(dataUrl);
    };
    reader.onerror = () => setUploading(false);
    reader.readAsDataURL(file);
  };

  const handleCameraCapture = () => {
    // Try native camera on mobile, fallback to file input
    fileInputRef.current?.click();
  };

  const handleRemove = () => {
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className={cn('space-y-3', className)}>
      {/* Photo section */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          {t('Ảnh giao hàng (POD)', 'Delivery Photo (POD)')}
        </p>
        {preview ? (
          <div className="relative rounded-lg overflow-hidden border bg-muted">
            <img src={preview} alt="POD" className="w-full h-48 object-cover" />
            <button
              onClick={handleRemove}
              className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/50 flex items-center justify-center"
            >
              <X className="h-4 w-4 text-white" />
            </button>
            <div className="absolute bottom-2 left-2">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-medium">
                <Check className="h-3 w-3" /> {t('Đã chụp', 'Captured')}
              </span>
            </div>
          </div>
        ) : (
          <button
            onClick={handleCameraCapture}
            className="w-full h-40 rounded-lg border-2 border-dashed border-muted-foreground/30 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            {uploading ? (
              <Loader2 className="h-8 w-8 animate-spin" />
            ) : (
              <>
                <Camera className="h-8 w-8" />
                <span className="text-sm font-medium">
                  {t('Chụp ảnh hoặc tải lên', 'Take photo or upload')}
                </span>
              </>
            )}
          </button>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handleFileSelect}
        />
      </div>

      {/* OTP section */}
      {otp && (
        <div className="bg-muted/50 rounded-lg p-3">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {t('Mã OTP xác nhận', 'Verification OTP')}
          </p>
          <div className="flex items-center gap-2">
            <span className="text-2xl font-mono font-bold tracking-widest text-foreground">
              {otp}
            </span>
            <span className="text-[10px] text-muted-foreground">
              ({t('Cung cấp cho chủ shop', 'Provide to shop owner')})
            </span>
          </div>
        </div>
      )}

      {/* Signature section */}
      {signatureUrl && (
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-1">
            {t('Chữ ký nhận hàng', 'Delivery Signature')}
          </p>
          <img src={signatureUrl} alt="Signature" className="h-20 rounded border bg-white" />
        </div>
      )}
    </div>
  );
}

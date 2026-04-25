'use client';

import { useRef, useState } from 'react';
import { Camera, ImagePlus, X, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/stores/app.store';

// ============================================
// Camera Capture — Camera/file input with preview
// Used for: Merchandising audit photos, POD photos
// ============================================

interface CameraCaptureProps {
  value?: string | null;
  onChange: (dataUrl: string | null) => void;
  label?: string;
  placeholder?: string;
  className?: string;
  aspectRatio?: 'square' | 'landscape' | 'portrait';
  maxSizeKB?: number;
}

export function CameraCapture({
  value,
  onChange,
  label,
  placeholder,
  className,
  aspectRatio = 'landscape',
  maxSizeKB = 2048, // 2MB default
}: CameraCaptureProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size
    if (file.size > maxSizeKB * 1024) {
      setError(t(
        `Kích thước tối đa ${(maxSizeKB / 1024).toFixed(0)}MB`,
        `Max size ${(maxSizeKB / 1024).toFixed(0)}MB`
      ));
      return;
    }

    setError(null);
    setProcessing(true);

    try {
      // Resize image to save bandwidth
      const dataUrl = await resizeImage(file, maxSizeKB);
      onChange(dataUrl);
    } catch {
      setError(t('Không thể xử lý ảnh', 'Failed to process image'));
    } finally {
      setProcessing(false);
      // Reset input so same file can be selected again
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const removeImage = () => {
    onChange(null);
    setError(null);
  };

  const aspectClass = {
    square: 'aspect-square',
    landscape: 'aspect-[4/3]',
    portrait: 'aspect-[3/4]',
  }[aspectRatio];

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <p className="text-xs font-medium text-foreground">{label}</p>
      )}

      {/* Preview */}
      {value ? (
        <div className={cn('relative rounded-lg overflow-hidden border', aspectClass)}>
          <img
            src={value}
            alt={t('Ảnh đã chụp', 'Captured photo')}
            className="w-full h-full object-cover"
          />
          {/* Remove button */}
          <button
            onClick={removeImage}
            className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-black/80 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
          {/* Re-take button */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/60 text-white text-xs font-medium hover:bg-black/80 transition-colors"
          >
            <Camera className="h-3 w-3" />
            {t('Chụp lại', 'Retake')}
          </button>
        </div>
      ) : (
        /* Capture button */
        <button
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'w-full rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-2 transition-colors hover:border-primary/50 hover:bg-muted/50 active:bg-muted',
            aspectClass,
            processing && 'pointer-events-none opacity-60'
          )}
        >
          {processing ? (
            <Loader2 className="h-8 w-8 text-muted-foreground animate-spin" />
          ) : (
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Camera className="h-6 w-6 text-muted-foreground" />
            </div>
          )}
          <span className="text-xs text-muted-foreground text-center px-4">
            {processing
              ? t('Đang xử lý...', 'Processing...')
              : placeholder || t('Chụp ảnh hoặc chọn từ thư viện', 'Take photo or choose from gallery')
            }
          </span>
          {!processing && (
            <span className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
              <ImagePlus className="h-2.5 w-2.5" />
              {t('JPG, PNG tối đa ', 'JPG, PNG up to ')}{(maxSizeKB / 1024).toFixed(0)}MB
            </span>
          )}
        </button>
      )}

      {/* Error */}
      {error && (
        <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p>
      )}

      {/* Hidden file input — camera on mobile, file picker on desktop */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

// ============================================
// Utility: Resize image to fit within maxKB
// ============================================

function resizeImage(file: File, maxKB: number): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Max dimensions for mobile upload
        const MAX_WIDTH = 1280;
        const MAX_HEIGHT = 960;
        let { width, height } = img;

        if (width > MAX_WIDTH) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        }
        if (height > MAX_HEIGHT) {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, width, height);

        // Try JPEG quality levels until under maxKB
        let quality = 0.8;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        while (dataUrl.length > maxKB * 1024 * 1.37 && quality > 0.2) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        resolve(dataUrl);
      };
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

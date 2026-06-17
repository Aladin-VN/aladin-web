'use client';

import { useState, useCallback, useEffect } from 'react';
import { useAppStore } from '@/stores/app.store';
import { api } from '@/lib/mobile/api';
import { CameraCapture } from './camera-capture';
import { Package, Tag, ChevronDown, ChevronUp, Loader2, CheckCircle, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ============================================
// Audit Submit Form — Submit merchandising audit
// ============================================

interface ProductOption {
  id: string;
  name: string;
  sku: string;
}

interface PromotionOption {
  id: string;
  title: string;
  promoType: string;
}

interface AuditSubmitFormProps {
  onSubmitted?: () => void;
  onCancel?: () => void;
}

type FormStep = 'input' | 'confirming' | 'processing' | 'success' | 'error';

export function AuditSubmitForm({ onSubmitted, onCancel }: AuditSubmitFormProps) {
  const locale = useAppStore((s) => s.locale);
  const t = (vi: string, en: string) => locale === 'vi' ? vi : en;

  const [step, setStep] = useState<FormStep>('input');
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [productId, setProductId] = useState('');
  const [promotionId, setPromotionId] = useState('');
  const [notes, setNotes] = useState('');

  // Product search
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<ProductOption[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<ProductOption | null>(null);
  const [searchingProducts, setSearchingProducts] = useState(false);
  const [showProductSearch, setShowProductSearch] = useState(false);

  // Promotion search
  const [promotionSearch, setPromotionSearch] = useState('');
  const [promotionResults, setPromotionResults] = useState<PromotionOption[]>([]);
  const [selectedPromotion, setSelectedPromotion] = useState<PromotionOption | null>(null);
  const [searchingPromotions, setSearchingPromotions] = useState(false);
  const [showPromotionSearch, setShowPromotionSearch] = useState(false);

  const [error, setError] = useState<string | null>(null);

  // Debounced product search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (productSearch.length < 2) {
        setProductResults([]);
        return;
      }
      setSearchingProducts(true);
      try {
        const res = await api.get('/products', { search: productSearch, limit: 10 });
        if (res.success && res.data) {
          const raw = res.data as Record<string, unknown>;
          const list = (raw?.items as { id: string; name: string; sku: string }[]) || [];
          setProductResults(list.map((p) => ({
            id: p.id, name: p.name, sku: p.sku,
          })));
        }
      } catch {
        // silent
      } finally {
        setSearchingProducts(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productSearch]);

  // Debounced promotion search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (promotionSearch.length < 2) {
        setPromotionResults([]);
        return;
      }
      setSearchingPromotions(true);
      try {
        const res = await api.get('/promotions', { search: promotionSearch, status: 'active', limit: 10 });
        if (res.success && res.data) {
          const raw = res.data as Record<string, unknown>;
          const list = (raw?.items as { id: string; title: string; promoType: string }[]) || [];
          setPromotionResults(list.map((p) => ({
            id: p.id, title: p.title, promoType: p.promoType,
          })));
        }
      } catch {
        // silent
      } finally {
        setSearchingPromotions(false);
      }
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promotionSearch]);

  const selectProduct = (p: ProductOption) => {
    setSelectedProduct(p);
    setProductId(p.id);
    setShowProductSearch(false);
    setProductSearch('');
  };

  const selectPromotion = (p: PromotionOption) => {
    setSelectedPromotion(p);
    setPromotionId(p.id);
    setShowPromotionSearch(false);
    setPromotionSearch('');
  };

  const clearProduct = () => {
    setSelectedProduct(null);
    setProductId('');
  };

  const clearPromotion = () => {
    setSelectedPromotion(null);
    setPromotionId('');
  };

  const canSubmit = photoUrl && productId;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setStep('processing');
    setError(null);

    try {
      await api.post('/merchandising', {
        shopId: 'auto', // Backend auto-derives from JWT
        productId,
        promotionId: promotionId || undefined,
        photoUrl,
        notes: notes || undefined,
      });
      setStep('success');
      onSubmitted?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('Gửi thất bại', 'Submit failed');
      setError(message);
      setStep('error');
    }
  }, [canSubmit, productId, promotionId, photoUrl, notes, onSubmitted, t]);

  // Success state
  if (step === 'success') {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
        <div className="h-16 w-16 rounded-full bg-yellow-50 dark:bg-red-900/30 flex items-center justify-center mb-4">
          <CheckCircle className="h-8 w-8 text-red-600" />
        </div>
        <h3 className="text-base font-semibold mb-1">{t('Gửi thành công!', 'Submitted!')}</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {t('Ảnh trung bay đã được gửi để duyệt', 'Shelf photo submitted for review')}
        </p>
        <button
          onClick={() => {
            setStep('input');
            setPhotoUrl(null);
            setProductId('');
            setPromotionId('');
            setNotes('');
            setSelectedProduct(null);
            setSelectedPromotion(null);
          }}
          className="px-6 py-2.5 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 transition-colors"
        >
          {t('Gửi ảnh khác', 'Submit Another')}
        </button>
      </div>
    );
  }

  // Processing state
  if (step === 'processing') {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
        <p className="text-sm text-muted-foreground">{t('Đang gửi...', 'Submitting...')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Cancel button */}
      {onCancel && (
        <div className="flex justify-end">
          <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">
            {t('Hủy', 'Cancel')}
          </button>
        </div>
      )}

      {/* Step 1: Photo capture */}
      <CameraCapture
        value={photoUrl}
        onChange={setPhotoUrl}
        label={t('1. Chụp ảnh kệ hàng', '1. Take shelf photo')}
        placeholder={t('Chụp ảnh trưng bày sản phẩm trên kệ', 'Take a photo of product display on shelf')}
        aspectRatio="landscape"
      />

      {/* Step 2: Product selection */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">
          {t('2. Chọn sản phẩm *', '2. Select product *')}
        </p>

        {selectedProduct ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
            <div className="h-8 w-8 rounded bg-yellow-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <Package className="h-4 w-4 text-red-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedProduct.name}</p>
              <p className="text-[10px] text-muted-foreground">{selectedProduct.sku}</p>
            </div>
            <button onClick={clearProduct} className="p-1 text-muted-foreground hover:text-foreground">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowProductSearch(!showProductSearch)}
            className="w-full flex items-center justify-between p-2.5 rounded-lg border border-dashed hover:border-primary/50 text-sm"
          >
            <span className="text-muted-foreground">{t('Tìm sản phẩm...', 'Search product...')}</span>
            {showProductSearch ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}

        {/* Product search results */}
        {showProductSearch && (
          <div className="space-y-1.5">
            <div className="relative">
              <input
                type="text"
                placeholder={t('Tên hoặc mã sản phẩm...', 'Product name or SKU...')}
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full h-9 text-xs rounded-lg border bg-transparent px-3 outline-none focus:ring-2 focus:ring-primary/20"
              />
              {searchingProducts && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {productResults.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {productResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectProduct(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 border-b last:border-0"
                  >
                    <Package className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{p.name}</span>
                    <span className="text-muted-foreground shrink-0">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 3: Promotion selection (optional) */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">
          {t('3. Khuyến mãi liên quan (tuỳ chọn)', '3. Related promotion (optional)')}
        </p>

        {selectedPromotion ? (
          <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30">
            <div className="h-8 w-8 rounded bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Tag className="h-4 w-4 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{selectedPromotion.title}</p>
              <p className="text-[10px] text-muted-foreground">{selectedPromotion.promoType}</p>
            </div>
            <button onClick={clearPromotion} className="p-1 text-muted-foreground hover:text-foreground">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            onClick={() => setShowPromotionSearch(!showPromotionSearch)}
            className="w-full flex items-center justify-between p-2.5 rounded-lg border border-dashed hover:border-primary/50 text-sm"
          >
            <span className="text-muted-foreground">{t('Tìm chương trình KM...', 'Search promotion...')}</span>
            {showPromotionSearch ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
          </button>
        )}

        {showPromotionSearch && (
          <div className="space-y-1.5">
            <div className="relative">
              <input
                type="text"
                placeholder={t('Tên khuyến mãi...', 'Promotion name...')}
                value={promotionSearch}
                onChange={(e) => setPromotionSearch(e.target.value)}
                className="w-full h-9 text-xs rounded-lg border bg-transparent px-3 outline-none focus:ring-2 focus:ring-primary/20"
              />
              {searchingPromotions && <Loader2 className="absolute right-2 top-2 h-4 w-4 animate-spin text-muted-foreground" />}
            </div>
            {promotionResults.length > 0 && (
              <div className="border rounded-lg max-h-40 overflow-y-auto">
                {promotionResults.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => selectPromotion(p)}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-muted flex items-center gap-2 border-b last:border-0"
                  >
                    <Tag className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate flex-1">{p.title}</span>
                    <span className="text-muted-foreground shrink-0">{p.promoType}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Step 4: Notes (optional) */}
      <div className="space-y-1.5">
        <p className="text-xs font-medium text-foreground">
          {t('4. Ghi chú (tuỳ chọn)', '4. Notes (optional)')}
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t('Ghi chú thêm về trưng bày...', 'Additional notes about the display...')}
          rows={2}
          maxLength={300}
          className="w-full text-xs rounded-lg border bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
        />
        <p className="text-[10px] text-muted-foreground text-right">
          {notes.length}/300
        </p>
      </div>

      {/* Error */}
      {step === 'error' && error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900">
          <XCircle className="h-4 w-4 text-red-600 shrink-0" />
          <p className="text-xs text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Submit button */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit || step === 'confirming'}
        className={cn(
          'w-full py-3 rounded-xl text-sm font-semibold transition-colors',
          canSubmit
            ? 'bg-red-600 text-white hover:bg-red-700 active:bg-red-800'
            : 'bg-muted text-muted-foreground cursor-not-allowed'
        )}
      >
        {t('Gửi ảnh trung bay', 'Submit Shelf Photo')}
      </button>
    </div>
  );
}

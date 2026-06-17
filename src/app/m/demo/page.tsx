'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Store,
  ShoppingCart,
  ClipboardCheck,
  Package,
  Truck,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Clock,
  CreditCard,
  MapPin,
  RotateCcw,
} from 'lucide-react';

// ============================================
// Types
// ============================================

interface OrderItem {
  id: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  totalPrice: number;
}

interface DemoOrder {
  id: string;
  orderNumber: string;
  status: string;
  paymentMethod: string;
  paymentStatus: string;
  subtotalAmount: number;
  discountAmount: number;
  deliveryFee: number;
  totalAmount: number;
  creditUsed: number;
  customerNotes: string;
  confirmedAt: string | null;
  packedAt: string | null;
  deliveredAt: string | null;
  createdAt: string;
  updatedAt: string;
  items: OrderItem[];
  shop: { name: string; district: string | null; province: string };
}

// ============================================
// Pipeline Steps Config
// ============================================

const PIPELINE_STEPS = [
  {
    step: 1,
    icon: '🏪',
    title: 'Chủ Cửa Hàng Duyệt Sản Phẩm',
    desc: 'Mở app, xem danh mục sản phẩm',
    status: 'PENDING',
  },
  {
    step: 2,
    icon: '🛒',
    title: 'Giỏ Hàng & Đặt Hàng',
    desc: 'Thêm sản phẩm, chọn thanh toán',
    status: 'PENDING',
  },
  {
    step: 3,
    icon: '📋',
    title: 'Đơn Hàng Được Xác Nhận',
    desc: 'ALADIN xác nhận và gửi đến kho phân phối',
    status: 'CONFIRMED',
  },
  {
    step: 4,
    icon: '📦',
    title: 'Đóng Gói & Phân Tài Xế',
    desc: 'Kho đóng gói đơn hàng, phân công tài xế giao',
    status: 'PACKED',
  },
  {
    step: 5,
    icon: '🚚',
    title: 'Đang Giao Hàng',
    desc: 'Tài xế giao hàng đến cửa hàng',
    status: 'OUT_FOR_DELIVERY',
  },
  {
    step: 6,
    icon: '✅',
    title: 'Giao Hàng Thành Công',
    desc: 'Cửa hàng xác nhận nhận hàng',
    status: 'DELIVERED',
  },
];

const STATUS_ORDER = ['PENDING', 'CONFIRMED', 'PROCESSING', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];

const STATUS_BADGE: Record<string, { label: string; color: string }> = {
  PENDING: { label: 'Chờ xác nhận', color: 'bg-amber-100 text-amber-700' },
  CONFIRMED: { label: 'Đã xác nhận', color: 'bg-blue-100 text-blue-700' },
  PROCESSING: { label: 'Đang xử lý', color: 'bg-indigo-100 text-indigo-700' },
  PACKED: { label: 'Đã đóng gói', color: 'bg-purple-100 text-purple-700' },
  OUT_FOR_DELIVERY: { label: 'Đang giao hàng', color: 'bg-orange-100 text-orange-700' },
  DELIVERED: { label: 'Đã giao', color: 'bg-yellow-50 text-red-700' },
};

// ============================================
// Helpers
// ============================================

function formatVND(amount: number): string {
  return amount.toLocaleString('vi-VN') + ' ₫';
}

function formatTime(dateStr: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getStepState(stepStatus: string, currentStatus: string): 'completed' | 'current' | 'pending' {
  const currentIndex = STATUS_ORDER.indexOf(currentStatus);
  const stepStatuses = ['PENDING', 'PENDING', 'CONFIRMED', 'PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'];
  const stepIndex = stepStatuses.indexOf(stepStatus);

  // Map current status to step index for comparison
  let currentStepIndex = -1;
  if (currentStatus === 'PENDING') currentStepIndex = 1; // Step 2 (after browsing)
  if (currentStatus === 'CONFIRMED') currentStepIndex = 2;
  if (currentStatus === 'PROCESSING') currentStepIndex = 2;
  if (currentStatus === 'PACKED') currentStepIndex = 3;
  if (currentStatus === 'OUT_FOR_DELIVERY') currentStepIndex = 4;
  if (currentStatus === 'DELIVERED') currentStepIndex = 5;

  if (currentStatus === 'PENDING' && stepIndex <= 1) {
    // First two steps are "active" when PENDING
    if (stepIndex === 0) return 'completed';
    return 'current';
  }

  if (stepIndex < currentStepIndex) return 'completed';
  if (stepIndex === currentStepIndex) return 'current';
  return 'pending';
}

// ============================================
// Demo Page Component
// ============================================

export default function InvestorDemoPage() {
  const [order, setOrder] = useState<DemoOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Create Demo Order ----
  const handleCreateOrder = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    setOrder(null);

    try {
      const res = await fetch('/api/demo/create-order', { method: 'POST' });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Không thể tạo đơn hàng demo');
        return;
      }

      setOrder(data.data.order);
      setMessage('✅ Đơn hàng demo đã được tạo! Nhấn "Chuyển sang Bước Tiếp" để trải nghiệm quy trình.');
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  // ---- Advance Order ----
  const handleAdvance = async () => {
    if (!order) return;
    setAdvancing(true);
    setError(null);
    setMessage(null);

    try {
      const res = await fetch('/api/demo/advance-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id }),
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.error || 'Không thể chuyển trạng thái');
        return;
      }

      setOrder(data.data.order);
      setMessage(data.data.message);

      if (data.data.isComplete) {
        setMessage('🎉 Đơn hàng đã giao thành công! Toàn bộ quy trình B2B hoàn tất.');
      }
    } catch {
      setError('Lỗi kết nối. Vui lòng thử lại.');
    } finally {
      setAdvancing(false);
    }
  };

  // ---- Reset ----
  const handleReset = () => {
    setOrder(null);
    setMessage(null);
    setError(null);
  };

  const isDelivered = order?.status === 'DELIVERED';
  const currentStatus = order?.status || '';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Fixed Top Bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-white/90 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-lg mx-auto flex items-center justify-between px-4 h-12">
          <Link
            href="/m"
            className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </Link>
          <span className="text-xs font-semibold text-red-600 bg-yellow-50 px-2.5 py-1 rounded-full">
            DEMO MODE
          </span>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-lg mx-auto px-4 pt-16 pb-24">
        {/* ========== HEADER ========== */}
        <section className="pt-6 pb-2">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
              Demo Nhà Đầu Tư
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              Trải nghiệm quy trình B2B hoàn chỉnh
            </p>
          </div>
        </section>

        {/* ========== PIPELINE VISUALIZATION ========== */}
        <section className="mt-4 space-y-2">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider px-1">
            Quy Trình Giao Hàng
          </h2>
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {PIPELINE_STEPS.map((step, idx) => {
              const state = currentStatus
                ? getStepState(step.status, currentStatus)
                : 'pending';

              return (
                <div key={step.step} className="flex items-start gap-3 px-4 py-3.5">
                  {/* Step Circle */}
                  <div className="flex-shrink-0 mt-0.5">
                    {state === 'completed' ? (
                      <div className="w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shadow-sm">
                        <CheckCircle2 className="w-5 h-5 text-white" />
                      </div>
                    ) : state === 'current' ? (
                      <div className="relative w-9 h-9 rounded-full bg-red-500 flex items-center justify-center shadow-sm shadow-yellow-100">
                        <span className="text-white text-sm font-bold">{step.step}</span>
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-yellow-500 rounded-full animate-ping opacity-75" />
                        <span className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-yellow-400 rounded-full" />
                      </div>
                    ) : (
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
                        <span className="text-gray-400 text-sm font-medium">{step.step}</span>
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-base">{step.icon}</span>
                      <h3 className={`text-sm font-semibold ${state === 'pending' ? 'text-gray-400' : 'text-gray-900'}`}>
                        {step.title}
                      </h3>
                    </div>
                    <p className={`text-xs mt-0.5 ${state === 'pending' ? 'text-gray-300' : 'text-gray-500'}`}>
                      {step.desc}
                    </p>
                    {/* Status Badge for active steps */}
                    {state === 'current' && currentStatus && (
                      <span className={`inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_BADGE[currentStatus]?.color || 'bg-gray-100 text-gray-500'}`}>
                        {STATUS_BADGE[currentStatus]?.label || currentStatus}
                      </span>
                    )}
                    {state === 'completed' && (
                      <span className="inline-block mt-1.5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-red-700">
                        Hoàn thành
                      </span>
                    )}
                  </div>

                  {/* Connecting Line (except last) */}
                  {idx < PIPELINE_STEPS.length - 1 && (
                    <div className="absolute left-[22px] top-[52px] w-0.5 h-2 bg-gray-100" />
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {/* ========== CREATE ORDER BUTTON ========== */}
        <section className="mt-6">
          {!order && (
            <button
              onClick={handleCreateOrder}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white font-semibold text-base py-3.5 px-6 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <ShoppingCart className="w-5 h-5" />
              )}
              {loading ? 'Đang tạo đơn hàng...' : 'Tạo Đơn Hàng Demo'}
            </button>
          )}
        </section>

        {/* ========== MESSAGE / ERROR BANNER ========== */}
        {message && (
          <div className={`mt-4 px-4 py-3 rounded-xl text-sm font-medium leading-relaxed ${
            isDelivered
              ? 'bg-yellow-50 text-red-800 border border-yellow-100'
              : 'bg-blue-50 text-blue-800 border border-blue-200'
          }`}>
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 px-4 py-3 rounded-xl text-sm font-medium text-red-700 bg-red-50 border border-red-200">
            {error}
          </div>
        )}

        {/* ========== ORDER DETAILS CARD ========== */}
        {order && (
          <section className="mt-6 space-y-4">
            {/* Order Header Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              {/* Green accent bar */}
              <div className="h-1 bg-gradient-to-r from-yellow-500 to-red-600" />

              <div className="px-4 pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                      Chi Tiết Đơn Hàng
                    </p>
                    <p className="text-base font-bold text-gray-900 mt-0.5">
                      {order.orderNumber}
                    </p>
                  </div>
                  <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${STATUS_BADGE[order.status]?.color || 'bg-gray-100 text-gray-500'}`}>
                    {STATUS_BADGE[order.status]?.label || order.status}
                  </span>
                </div>

                {/* Shop info */}
                <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                  <Store className="w-3.5 h-3.5" />
                  <span>{order.shop.name}</span>
                  {order.shop.district && (
                    <>
                      <span className="text-gray-300">·</span>
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{order.shop.district}, {order.shop.province}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Items */}
              <div className="border-t border-gray-50">
                <div className="px-4 py-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2">
                    Sản Phẩm
                  </p>
                  {order.items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                      <div className="flex-1 min-w-0 mr-3">
                        <p className="text-sm font-medium text-gray-900 truncate">{item.productName}</p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {item.quantity} x {formatVND(item.unitPrice)}
                        </p>
                      </div>
                      <p className="text-sm font-semibold text-gray-900 whitespace-nowrap">
                        {formatVND(item.totalPrice)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-gray-100 bg-gray-50/50 px-4 py-3 space-y-1.5">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Tạm tính</span>
                  <span>{formatVND(order.subtotalAmount)}</span>
                </div>
                {order.discountAmount > 0 && (
                  <div className="flex justify-between text-xs text-red-600">
                    <span>Giảm giá</span>
                    <span>-{formatVND(order.discountAmount)}</span>
                  </div>
                )}
                {order.deliveryFee > 0 && (
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Phí giao hàng</span>
                    <span>{formatVND(order.deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-gray-900 pt-1.5 border-t border-gray-200">
                  <span>Tổng cộng</span>
                  <span>{formatVND(order.totalAmount)}</span>
                </div>
              </div>

              {/* Payment & Metadata */}
              <div className="border-t border-gray-100 px-4 py-3 space-y-2">
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Thanh toán: <span className="font-medium text-gray-700">Tín dụng (7 ngày)</span></span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Đặt lúc: {new Date(order.createdAt).toLocaleString('vi-VN')}</span>
                </div>
              </div>
            </div>

            {/* ========== ADVANCE BUTTON ========== */}
            <button
              onClick={handleAdvance}
              disabled={advancing || isDelivered}
              className={`w-full flex items-center justify-center gap-2 font-semibold text-base py-3.5 px-6 rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                isDelivered
                  ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white'
              }`}
            >
              {advancing ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : isDelivered ? (
                <CheckCircle2 className="w-5 h-5" />
              ) : (
                <ChevronRight className="w-5 h-5" />
              )}
              {advancing
                ? 'Đang xử lý...'
                : isDelivered
                  ? 'Đã Hoàn Tất Quy Trình'
                  : 'Chuyển sang Bước Tiếp ▶'}
            </button>

            {/* Reset Button */}
            <button
              onClick={handleReset}
              className="w-full flex items-center justify-center gap-2 text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Tạo đơn hàng mới
            </button>

            {/* ========== FLOW SUMMARY TIMELINE ========== */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 px-4 py-4">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
                Dòng Thời Gian
              </p>
              <div className="space-y-3">
                {/* Placed */}
                <TimelineEntry
                  label="Đặt hàng"
                  time={order.createdAt}
                  done={true}
                />
                {/* Confirmed */}
                <TimelineEntry
                  label="Xác nhận"
                  time={order.confirmedAt}
                  done={!!order.confirmedAt}
                />
                {/* Packed */}
                <TimelineEntry
                  label="Đóng gói"
                  time={order.packedAt}
                  done={!!order.packedAt}
                />
                {/* Delivered */}
                <TimelineEntry
                  label="Giao thành công"
                  time={order.deliveredAt}
                  done={!!order.deliveredAt}
                  isLast={true}
                />
              </div>
            </div>
          </section>
        )}

        {/* ========== EMPTY STATE ========== */}
        {!order && !loading && (
          <section className="mt-8 text-center">
            <div className="w-20 h-20 mx-auto bg-yellow-50 rounded-2xl flex items-center justify-center mb-4">
              <Truck className="w-10 h-10 text-yellow-500" />
            </div>
            <p className="text-sm text-gray-500 max-w-xs mx-auto leading-relaxed">
              Nhấn nút bên trên để tạo một đơn hàng demo và trải nghiệm toàn bộ quy trình B2B từ đặt hàng đến giao hàng.
            </p>
          </section>
        )}
      </main>
    </div>
  );
}

// ============================================
// Timeline Entry Sub-Component
// ============================================

function TimelineEntry({
  label,
  time,
  done,
  isLast = false,
}: {
  label: string;
  time: string | null;
  done: boolean;
  isLast?: boolean;
}) {
  return (
    <div className="flex items-start gap-3">
      {/* Dot / Check */}
      <div className="flex flex-col items-center">
        {done ? (
          <div className="w-6 h-6 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-white" />
          </div>
        ) : (
          <div className="w-6 h-6 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
          </div>
        )}
        {!isLast && (
          <div className={`w-0.5 h-6 mt-1 ${done ? 'bg-yellow-100' : 'bg-gray-100'}`} />
        )}
      </div>

      {/* Text */}
      <div className="pt-0.5">
        <p className={`text-sm font-medium ${done ? 'text-gray-900' : 'text-gray-400'}`}>
          {label}
        </p>
        {done && time && (
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(time).toLocaleString('vi-VN', {
              hour: '2-digit',
              minute: '2-digit',
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
            })}
          </p>
        )}
      </div>
    </div>
  );
}
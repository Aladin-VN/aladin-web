import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// Types
// ============================================

export interface CartItem {
  productId: string;
  productName: string;
  productSku: string;
  unitPrice: number;
  quantity: number;
  imageUrl?: string;
  maxOrderQty?: number;
  minOrderQty?: number;
}

interface CartState {
  items: CartItem[];
  shopId: string | null;

  // Computed
  itemCount: () => number;
  subtotal: () => number;
  isEmpty: () => boolean;

  // Actions
  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setShopId: (shopId: string) => void;
}

// ============================================
// Store
// ============================================

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      shopId: null,

      itemCount: () => get().items.reduce((sum, item) => sum + item.quantity, 0),

      subtotal: () =>
        get().items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),

      isEmpty: () => get().items.length === 0,

      addItem: (newItem) => {
        const items = [...get().items];
        const existingIndex = items.findIndex((i) => i.productId === newItem.productId);

        if (existingIndex >= 0) {
          // Merge quantity
          const newQty = items[existingIndex].quantity + (newItem.quantity || 1);
          const maxQty = items[existingIndex].maxOrderQty || 9999;
          items[existingIndex].quantity = Math.min(newQty, maxQty);
        } else {
          items.push({
            ...newItem,
            quantity: newItem.quantity || newItem.minOrderQty || 1,
          });
        }
        set({ items });
      },

      removeItem: (productId) => {
        set({ items: get().items.filter((i) => i.productId !== productId) });
      },

      updateQuantity: (productId, quantity) => {
        if (quantity <= 0) {
          get().removeItem(productId);
          return;
        }
        const items = get().items.map((item) => {
          if (item.productId === productId) {
            const maxQty = item.maxOrderQty || 9999;
            return { ...item, quantity: Math.min(quantity, maxQty) };
          }
          return item;
        });
        set({ items });
      },

      clearCart: () => set({ items: [], shopId: null }),

      setShopId: (shopId) => set({ shopId }),
    }),
    {
      name: 'aladin-cart',
      partialize: (state) => ({ items: state.items, shopId: state.shopId }),
    }
  )
);

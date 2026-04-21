// ─────────────────────────────────────────────────────────────────────
// ALADIN B2B Mobile — Cart Store (Zustand)
// ─────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';

import { ASYNC_STORAGE_CART_KEY } from '@/src/constants';

// ─── Types ──────────────────────────────────────────────────────────

export interface CartItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  sku: string;
  imageUrl?: string;
}

export interface CartState {
  items: CartItem[];
  shopId: string | null;

  addItem: (item: Omit<CartItem, 'quantity'> & { quantity?: number }) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  setShopId: (shopId: string | null) => void;
  getTotal: () => number;
  getItemCount: () => number;
  hydrate: () => Promise<void>;
}

// ─── Persist helpers ────────────────────────────────────────────────

interface PersistedCart {
  items: CartItem[];
  shopId: string | null;
}

async function persistCart(state: PersistedCart): Promise<void> {
  try {
    await AsyncStorage.setItem(ASYNC_STORAGE_CART_KEY, JSON.stringify(state));
  } catch {
    // Silently ignore
  }
}

async function readPersistedCart(): Promise<PersistedCart> {
  try {
    const raw = await AsyncStorage.getItem(ASYNC_STORAGE_CART_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as PersistedCart;
      return { items: parsed.items ?? [], shopId: parsed.shopId ?? null };
    }
  } catch {
    // Corrupted data — return empty
  }
  return { items: [], shopId: null };
}

// ─── Store ──────────────────────────────────────────────────────────

export const useCartStore = create<CartState>()((set, get) => ({
  items: [],
  shopId: null,

  addItem: (item) => {
    set((state) => {
      const existingIndex = state.items.findIndex(
        (i) => i.productId === item.productId,
      );

      let newItems: CartItem[];

      if (existingIndex >= 0) {
        // Increment quantity
        newItems = state.items.map((i, idx) =>
          idx === existingIndex
            ? { ...i, quantity: i.quantity + (item.quantity ?? 1) }
            : i,
        );
      } else {
        newItems = [
          ...state.items,
          { ...item, quantity: item.quantity ?? 1 },
        ];
      }

      const next = { items: newItems, shopId: state.shopId };
      persistCart(next);
      return next;
    });
  },

  removeItem: (productId) => {
    set((state) => {
      const next = {
        items: state.items.filter((i) => i.productId !== productId),
        shopId: state.shopId,
      };
      persistCart(next);
      return next;
    });
  },

  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }

    set((state) => {
      const next = {
        items: state.items.map((i) =>
          i.productId === productId ? { ...i, quantity } : i,
        ),
        shopId: state.shopId,
      };
      persistCart(next);
      return next;
    });
  },

  clearCart: () => {
    const next = { items: [], shopId: null };
    persistCart(next);
    set(next);
  },

  setShopId: (shopId) => {
    set((state) => {
      const next = { items: state.items, shopId };
      persistCart(next);
      return next;
    });
  },

  getTotal: () => {
    return get().items.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity,
      0,
    );
  },

  getItemCount: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0);
  },

  hydrate: async () => {
    const persisted = await readPersistedCart();
    set(persisted);
  },
}));

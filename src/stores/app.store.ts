import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// App-wide state (locale, notifications, etc.)
// ============================================

interface Notification {
  id: string;
  title: string;
  titleVi?: string;
  body: string;
  bodyVi?: string;
  type: 'order' | 'shipment' | 'credit' | 'promotion' | 'system';
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

interface AppState {
  locale: 'vi' | 'en';
  notifications: Notification[];
  isOnline: boolean;
  showInstallPrompt: boolean;
  deferredPrompt: unknown | null;

  // Actions
  setLocale: (locale: 'vi' | 'en') => void;
  addNotification: (n: Omit<Notification, 'id' | 'read' | 'createdAt'>) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  clearNotifications: () => void;
  unreadCount: () => number;
  setOnline: (online: boolean) => void;
  setInstallPrompt: (prompt: unknown) => void;
  dismissInstallPrompt: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      locale: 'vi',
      notifications: [],
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      showInstallPrompt: false,
      deferredPrompt: null,

      setLocale: (locale) => {
        try {
          localStorage.setItem('aladin-locale', locale);
          document.documentElement.lang = locale;
        } catch {}
        set({ locale });
      },

      addNotification: (n) => {
        const notification: Notification = {
          ...n,
          id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          read: false,
          createdAt: new Date().toISOString(),
        };
        // Keep max 50 notifications
        const notifications = [notification, ...get().notifications].slice(0, 50);
        set({ notifications });
      },

      markNotificationRead: (id) => {
        const notifications = get().notifications.map((n) =>
          n.id === id ? { ...n, read: true } : n
        );
        set({ notifications });
      },

      markAllNotificationsRead: () => {
        const notifications = get().notifications.map((n) => ({ ...n, read: true }));
        set({ notifications });
      },

      clearNotifications: () => set({ notifications: [] }),

      unreadCount: () => get().notifications.filter((n) => !n.read).length,

      setOnline: (online) => set({ isOnline: online }),

      setInstallPrompt: (prompt) =>
        set({ deferredPrompt: prompt, showInstallPrompt: true }),

      dismissInstallPrompt: () => set({ showInstallPrompt: false }),
    }),
    {
      name: 'aladin-app',
      partialize: (state) => ({ locale: state.locale }),
    }
  )
);

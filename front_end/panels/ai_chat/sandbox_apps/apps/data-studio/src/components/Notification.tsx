import { useEffect } from 'react';
import { create } from 'zustand';

interface NotificationData {
  message: string;
  type: 'success' | 'error' | 'info';
}

interface NotificationStore {
  notification: NotificationData | null;
  setNotification: (data: NotificationData | null) => void;
}

export const useNotificationStore = create<NotificationStore>((set) => ({
  notification: null,
  setNotification: (data) => set({ notification: data }),
}));

let timeoutId: number | null = null;

export function showNotification(message: string, type: 'success' | 'error' | 'info' = 'info') {
  if (timeoutId) {
    clearTimeout(timeoutId);
  }

  useNotificationStore.getState().setNotification({ message, type });

  timeoutId = window.setTimeout(() => {
    useNotificationStore.getState().setNotification(null);
    timeoutId = null;
  }, 3000);
}

// Clear timeout on cleanup (prevents memory leak)
export function clearNotificationTimeout() {
  if (timeoutId) {
    clearTimeout(timeoutId);
    timeoutId = null;
  }
}

// Legacy export for backward compatibility
export const notification = { get value() { return useNotificationStore.getState().notification; } };

export function Notification() {
  const data = useNotificationStore(state => state.notification);

  // Cleanup timeout on unmount to prevent memory leak
  useEffect(() => {
    return () => {
      clearNotificationTimeout();
    };
  }, []);

  if (!data) return null;

  const bgColor = data.type === 'success'
    ? 'bg-green-600'
    : data.type === 'error'
      ? 'bg-red-600'
      : 'bg-gray-800';

  return (
    <div className={`fixed bottom-6 left-1/2 -translate-x-1/2 px-6 py-3 rounded-lg text-white font-medium shadow-lg z-50 animate-in fade-in slide-in-from-bottom-4 ${bgColor}`}>
      {data.message}
    </div>
  );
}

import { create } from 'zustand';
import type { Toast, ToastType } from '@/components/shared/Toast';

interface NotificationState {
  toasts: Toast[];
  addToast: (message: string, type?: ToastType) => void;
  dismissToast: (id: string) => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') =>
    set(state => ({ toasts: [...state.toasts, { id: Date.now().toString(), type, message }] })),
  dismissToast: (id) =>
    set(state => ({ toasts: state.toasts.filter(t => t.id !== id) })),
}));
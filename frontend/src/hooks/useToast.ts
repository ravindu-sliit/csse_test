import { useNotificationStore } from '@/stores/notificationStore';

export function useToast() {
  const { addToast } = useNotificationStore();
  return {
    success: (message: string) => addToast(message, 'success'),
    error: (message: string) => addToast(message, 'error'),
    info: (message: string) => addToast(message, 'info'),
  };
}
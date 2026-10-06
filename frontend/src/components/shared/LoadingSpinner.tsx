import { cn } from '@/lib/utils';

export function LoadingSpinner({ fullScreen = false, size = 'md' }: { fullScreen?: boolean; size?: 'sm' | 'md' | 'lg' }) {
  const sizeClass = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }[size];
  const spinner = (
    <div className={cn('animate-spin rounded-full border-2 border-gray-300 border-t-amber-500', sizeClass)} />
  );
  if (fullScreen) {
    return <div className="min-h-screen flex items-center justify-center">{spinner}</div>;
  }
  return <div className="flex items-center justify-center p-8">{spinner}</div>;
}
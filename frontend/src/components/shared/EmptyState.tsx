import { cn } from '@/lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  icon?: string;
  className?: string;
}

export function EmptyState({ title, description, action, icon = '📂', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-12 px-6 text-center', className)}>
      <span className="text-4xl mb-4">{icon}</span>
      <h3 className="font-semibold text-gray-800 mb-2">{title}</h3>
      {description && <p className="text-gray-500 text-sm mb-4 max-w-xs">{description}</p>}
      {action && <div>{action}</div>}
    </div>
  );
}
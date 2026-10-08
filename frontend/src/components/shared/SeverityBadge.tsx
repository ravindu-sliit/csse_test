import { cn } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/lib/constants';
import type { SeverityLevel } from '@/types';

interface SeverityBadgeProps {
  level: SeverityLevel;
  size?: 'sm' | 'md';
}

export function SeverityBadge({ level, size = 'md' }: SeverityBadgeProps) {
  const config = SEVERITY_CONFIG[level];
  return (
    <span className={cn(
      'inline-flex items-center font-semibold rounded-full border',
      size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
      config.bg, config.text, config.border
    )}>
      {config.label}
    </span>
  );
}
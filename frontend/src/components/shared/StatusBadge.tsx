import { cn } from '@/lib/utils';

const STATUS_COLOURS: Record<string, string> = {
  active: 'bg-green-100 text-green-800',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-gray-100 text-gray-500',
  pending_verification: 'bg-yellow-100 text-yellow-800',
  under_review: 'bg-blue-100 text-blue-800',
  verified: 'bg-green-100 text-green-800',
  rejected: 'bg-red-100 text-red-700',
  open: 'bg-green-100 text-green-800',
  full: 'bg-red-100 text-red-700',
  closed: 'bg-gray-100 text-gray-500',
  available: 'bg-green-100 text-green-800',
  dispatched: 'bg-orange-100 text-orange-800',
  en_route: 'bg-blue-100 text-blue-800',
  on_mission: 'bg-purple-100 text-purple-800',
  returning: 'bg-gray-100 text-gray-600',
  in_transit: 'bg-yellow-100 text-yellow-800',
  preparing: 'bg-gray-100 text-gray-600',
  delivered: 'bg-green-100 text-green-800',
};

interface StatusBadgeProps {
  status: string;
  label?: string;
}

export function StatusBadge({ status, label }: StatusBadgeProps) {
  const colourClass = STATUS_COLOURS[status.toLowerCase()] || 'bg-gray-100 text-gray-600';
  const displayLabel = label || status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return (
    <span className={cn('inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium', colourClass)}>
      {displayLabel}
    </span>
  );
}
import { useQuery } from '@tanstack/react-query';
import { fetchWarnings } from '@/api/warnings.api';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { EmptyState } from '@/components/shared/EmptyState';
import { formatDate } from '@/lib/utils';
import type { SeverityLevel } from '@/types';

export function AlertsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['warnings', { status: 'active' }],
    queryFn: () => fetchWarnings({ status: 'active' }),
    refetchInterval: 30000,
  });

  const warnings = data?.data || [];

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-4">
      <h1 className="text-xl font-bold mb-4">Active Alerts</h1>
      {isLoading ? <LoadingSpinner /> : warnings.length === 0 ? (
        <EmptyState title="No active alerts" description="There are no active warnings in your area right now." icon="✅" />
      ) : (
        <div className="space-y-3">
          {warnings.map(w => (
            <div key={w.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between gap-2 mb-2">
                <p className="font-semibold text-sm">{w.hazardType.replace('_', ' ')} Alert</p>
                <SeverityBadge level={w.severityLevel.toLowerCase() as SeverityLevel} size="sm" />
              </div>
              <p className="text-sm text-gray-600 mb-2 line-clamp-3">{w.message}</p>
              <p className="text-xs text-gray-400">Districts: {w.targetDistricts.join(', ')}</p>
              <p className="text-xs text-gray-400">{formatDate(w.issuedTime)}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
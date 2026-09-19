import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchAlertTimeline } from '@/api/analytics.api';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { formatDate } from '@/lib/utils';
import type { SeverityLevel } from '@/types';

export function AlertTimelinePage() {
  const [period, setPeriod] = useState('7d');
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'timeline', period],
    queryFn: () => fetchAlertTimeline(period),
  });

  const warnings = (data || []) as { id: string; warningCode: string; hazardType: string; severityLevel: string; targetDistricts: string[]; issuedTime: string; channels: { channel: string; recipientCount: number; deliveredCount: number; reachRate: number }[] }[];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Historical Alert Timeline Logs</h1>
          <p className="text-gray-500 text-sm mt-1">Chronological warning dissemination audit trail.</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)} className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
              period === p ? 'bg-gray-900 text-white' : 'hover:bg-gray-50'
            }`}>{p === '7d' ? 'Last 7 Days' : 'Last 30 Days'}</button>
          ))}
        </div>
      </div>

      {isLoading ? <LoadingSpinner /> : warnings.length === 0 ? (
        <div className="text-center py-12"><p className="text-gray-400">No warnings in this period.</p></div>
      ) : (
        <div className="space-y-4">
          {warnings.map(w => (
            <div key={w.id} className="bg-white border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <span className="w-3 h-3 rounded-full" style={{ background: w.severityLevel === 'EMERGENCY' ? '#dc2626' : w.severityLevel === 'WARNING' ? '#d97706' : '#16a34a' }} />
                  <span className="font-bold text-sm uppercase">{w.hazardType.replace('_', ' ')} ALERT</span>
                  <SeverityBadge level={w.severityLevel.toLowerCase() as SeverityLevel} size="sm" />
                </div>
                <span className="text-xs text-gray-400">{formatDate(w.issuedTime)}</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">Affected districts: {w.targetDistricts.join(', ')}</p>
              <div className="grid grid-cols-3 gap-4">
                {w.channels.map(ch => (
                  <div key={ch.channel}>
                    <p className="text-xs text-gray-400">{ch.channel.replace('_', ' ')}</p>
                    <p className="font-semibold text-sm">{ch.deliveredCount.toLocaleString()} delivered</p>
                    <div className="bg-gray-200 rounded-full h-1 mt-1">
                      <div className="bg-green-500 h-1 rounded-full" style={{ width: `${ch.reachRate}%` }} />
                    </div>
                    <p className="text-xs text-green-600 mt-0.5">{ch.reachRate}% reached</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
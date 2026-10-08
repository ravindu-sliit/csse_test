import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { fetchWarnings, cancelWarning } from '@/api/warnings.api';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { formatDate } from '@/lib/utils';
import { HAZARD_TYPES } from '@/lib/constants';
import type { SeverityLevel } from '@/types';

export function WarningsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('');
  const [hazardFilter, setHazardFilter] = useState('');
  const [search, setSearch] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['warnings', { status: statusFilter, hazardType: hazardFilter }],
    queryFn: () => fetchWarnings({ status: statusFilter || undefined, hazardType: hazardFilter || undefined }),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: string) => cancelWarning(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['warnings'] }),
  });

  const warnings = (data?.data || []).filter(w =>
    !search || w.warningCode.toLowerCase().includes(search.toLowerCase()) ||
    w.targetDistricts.join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="p-6">
      <PageHeader
        title="Active Warnings Registry"
        subtitle="Full historical and active registry of all early warnings issued."
        action={
          <button onClick={() => navigate('/officer/warnings/create')} className="bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Issue Warning
          </button>
        }
      />

      {/* Filters */}
      <div className="bg-white rounded-xl border p-4 mb-4 flex flex-wrap gap-3 items-center">
        <select value={hazardFilter} onChange={e => setHazardFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All Hazards</option>
          {HAZARD_TYPES.map(h => <option key={h.value} value={h.value.toUpperCase()}>{h.label}</option>)}
        </select>
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <div className="flex items-center gap-2 border rounded-lg px-3 py-1.5 ml-auto">
          <Search className="w-4 h-4 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search warnings..." className="text-sm outline-none w-48" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? <LoadingSpinner /> : warnings.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No warnings found.</p>
            <button onClick={() => navigate('/officer/warnings/create')} className="mt-3 text-sm text-red-600 hover:underline">Issue a new warning →</button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Warning ID', 'Hazard Classification', 'Severity', 'Affected Districts', 'Issued', 'Status', 'Actions'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {warnings.map(w => (
                <tr key={w.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{w.warningCode}</td>
                  <td className="px-4 py-3 text-sm">{w.hazardType.replace('_', ' ')}</td>
                  <td className="px-4 py-3"><SeverityBadge level={w.severityLevel.toLowerCase() as SeverityLevel} size="sm" /></td>
                  <td className="px-4 py-3 text-sm text-gray-600">{w.targetDistricts.join(', ')}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(w.issuedTime)}</td>
                  <td className="px-4 py-3"><StatusBadge status={w.status.toLowerCase()} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button onClick={() => navigate(`/officer/warnings/${w.id}/status`)} className="text-xs text-blue-600 hover:underline">View Log</button>
                      {w.status.toLowerCase() === 'active' && (
                        <button onClick={() => cancelMutation.mutate(w.id)} className="text-xs text-red-600 hover:underline">Cancel</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
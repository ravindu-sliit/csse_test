import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { fetchReports } from '@/api/reports.api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { timeAgo } from '@/lib/utils';
import type { SeverityLevel } from '@/types';

export function ReportsPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({
    queryKey: ['reports', { status: 'PENDING_VERIFICATION,UNDER_REVIEW' }],
    queryFn: () => fetchReports({ status: 'PENDING_VERIFICATION,UNDER_REVIEW' }),
    refetchInterval: 15000,
  });

  const reports = data?.data || [];
  const pending = reports.filter(r => r.status === 'pending_verification').length;
  const critical = reports.filter(r => r.severityEstimate === 'emergency' || r.severityEstimate === 'warning').length;

  return (
    <div className="p-6">
      <PageHeader title="Incoming Hazard Verification Queue" subtitle="Disaster Management Center — Incident Command Verification Queue" />

      {/* Queue metrics */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
          <p className="text-xs text-yellow-600 font-semibold uppercase">Pending Review</p>
          <p className="text-2xl font-bold text-yellow-800 mt-1">{pending} Reports</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-semibold uppercase">Critical Level</p>
          <p className="text-2xl font-bold text-red-800 mt-1">{critical.toString().padStart(2, '0')} Active</p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-sm">Live Submission Logs</h2>
          <span className="bg-blue-100 text-blue-700 text-xs font-semibold px-2 py-1 rounded-full">{reports.length} PENDING</span>
        </div>

        {isLoading ? <LoadingSpinner /> : reports.length === 0 ? (
          <div className="p-12 text-center">
            <p className="text-gray-400 text-sm">No pending reports. All clear!</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b">
                {['Report ID', 'Hazard Type', 'District Zone', 'Time', 'Severity', 'Status', 'Verification Action'].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y">
              {reports.map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{r.reportCode}</td>
                  <td className="px-4 py-3 text-sm">{r.hazardType?.replace('_', ' ')}</td>
                  <td className="px-4 py-3 text-sm">{r.district}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{timeAgo(r.submittedAt)}</td>
                  <td className="px-4 py-3">
                    {r.severityEstimate
                      ? <SeverityBadge level={r.severityEstimate.toLowerCase() as SeverityLevel} size="sm" />
                      : <span className="text-xs text-gray-400">Unknown</span>
                    }
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={r.status.toLowerCase()} /></td>
                  <td className="px-4 py-3">
                    <button onClick={() => navigate(`/officer/reports/${r.id}`)} className="bg-gray-900 text-white text-xs font-semibold px-3 py-1.5 rounded-lg hover:bg-gray-700 mr-2">
                      Verify Report
                    </button>
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
import { useQuery } from '@tanstack/react-query';
import { fetchMyReports } from '@/api/reports.api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { formatDate } from '@/lib/utils';

export function MyReportsPage() {
  const { data: reports, isLoading } = useQuery({
    queryKey: ['my-reports'],
    queryFn: fetchMyReports,
  });

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-4">
      <h1 className="text-xl font-bold mb-4">My Reports</h1>
      {isLoading ? <LoadingSpinner /> : !reports || reports.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">No reports submitted yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((r: { id: string; reportCode: string; hazardType: string; status: string; district: string; submittedAt: string }) => (
            <div key={r.id} className="bg-white border rounded-xl p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-semibold">{r.reportCode}</p>
                  <p className="text-sm text-gray-600">{r.hazardType.replace('_', ' ')} • {r.district}</p>
                  <p className="text-xs text-gray-400 mt-1">{formatDate(r.submittedAt)}</p>
                </div>
                <StatusBadge status={r.status.toLowerCase()} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
import { useQuery } from '@tanstack/react-query';
import { fetchShelterAnalytics } from '@/api/analytics.api';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatusBadge } from '@/components/shared/StatusBadge';

export function ShelterAnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics', 'shelters'], queryFn: () => fetchShelterAnalytics() });
  if (isLoading) return <LoadingSpinner fullScreen />;
  const d = data as { kpis: { totalSheltered: number; activeSheltersCount: number; totalDesignatedShelters: number }; shelterDirectory: { id: string; name: string; district: string; capacity: number; currentOccupancy: number; capacityRate: number; status: string }[] } | undefined;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Shelter Utilization & Capacity Audit</h1>
      <p className="text-gray-500 text-sm mb-6">Real-time occupancy tracking, bed capacities, and resource demands.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Sheltered" value={(d?.kpis.totalSheltered || 0).toLocaleString()} dot="green" />
        <StatCard label="Active Shelters Running" value={d?.kpis.activeSheltersCount || 0} dot="blue" subtext={`Out of ${d?.kpis.totalDesignatedShelters || 0} designated`} />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50"><h2 className="font-semibold text-sm">Designated Safe House Directory</h2></div>
        <table className="w-full">
          <thead><tr className="border-b">{['Safe Camp / Shelter', 'District', 'Capacity Rate', 'Capacity', 'Occupancy', 'Status'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>)}</tr></thead>
          <tbody className="divide-y">
            {(d?.shelterDirectory || []).map((s) => (
              <tr key={s.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-sm">{s.name}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{s.district}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-gray-200 rounded-full h-2 w-20">
                      <div className={`h-2 rounded-full ${s.capacityRate >= 90 ? 'bg-red-500' : s.capacityRate >= 70 ? 'bg-amber-400' : 'bg-green-500'}`} style={{ width: `${Math.min(s.capacityRate, 100)}%` }} />
                    </div>
                    <span className="text-xs">{s.capacityRate}%</span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm">{s.capacity.toLocaleString()}</td>
                <td className="px-4 py-3 text-sm">{s.currentOccupancy.toLocaleString()}</td>
                <td className="px-4 py-3"><StatusBadge status={s.status.toLowerCase()} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
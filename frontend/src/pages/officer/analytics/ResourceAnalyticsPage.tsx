import { useQuery } from '@tanstack/react-query';
import { fetchResourceAnalytics } from '@/api/analytics.api';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function ResourceAnalyticsPage() {
  const { data, isLoading } = useQuery({ queryKey: ['analytics', 'resources'], queryFn: () => fetchResourceAnalytics() });
  if (isLoading) return <LoadingSpinner fullScreen />;
  const d = data as { kpis: { totalDistributions: number; totalUnitsDispatched: number; districtsWithDeliveries: number }; categoryBreakdown: { category: string; percentage: number }[]; supplyInventory: { id: string; name: string; category: string; quantity: number; unit: string; location: string }[] } | undefined;

  const categoryColours: Record<string, string> = { Food: '#3b82f6', Water: '#22c55e', Medicine: '#a855f7', 'Shelter Kit': '#f59e0b', Other: '#6b7280' };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Supply Chain & Resource Metrics</h1>
      <p className="text-gray-500 text-sm mb-6">Analyze emergency distribution volumes, rations coverage, and delivery logistics.</p>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Distributions" value={`${d?.kpis.totalDistributions || 0} Operations`} dot="blue" />
        <StatCard label="Ration Items Dispatched" value={`${(d?.kpis.totalUnitsDispatched || 0).toLocaleString()} units`} dot="green" />
        <StatCard label="Districts with Deliveries" value={d?.kpis.districtsWithDeliveries || 0} dot="orange" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Category breakdown */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Distribution Category Breakdown</h2>
          <div className="grid grid-cols-2 gap-3">
            {(d?.categoryBreakdown || []).map(c => (
              <div key={c.category} className="rounded-xl p-4 text-white" style={{ background: categoryColours[c.category] || '#6b7280' }}>
                <p className="font-bold text-lg">{c.category}</p>
                <p className="text-3xl font-bold mt-1">{c.percentage}%</p>
              </div>
            ))}
          </div>
        </div>

        {/* Inventory */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Current Inventory</h2>
          <div className="space-y-3">
            {(d?.supplyInventory || []).map(s => (
              <div key={s.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.location}</p>
                </div>
                <span className="font-semibold text-sm">{s.quantity.toLocaleString()} {s.unit}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
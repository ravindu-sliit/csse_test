import { useQuery } from '@tanstack/react-query';
import { fetchCoordinationSummary } from '@/api/shelters.api';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function LiveOperationsPage() {
  const { data: summary, isLoading } = useQuery({
    queryKey: ['coordination-summary'],
    queryFn: () => fetchCoordinationSummary(),
    refetchInterval: 15000,
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Crisis Live Ops Control</h1>
      <p className="text-gray-500 text-sm mb-6">National coordination board real-time event pipeline.</p>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Shelters" value={summary?.activeShelters ?? 0} dot="green" subtext="Currently open" />
        <StatCard label="Teams Deployed" value={`${summary?.teamsDeployed ?? 0} / ${summary?.teamsTotal ?? 0}`} dot="blue" subtext="Active missions" />
        <StatCard label="Supply Hubs" value={summary?.supplyHubsActive ?? 0} dot="orange" subtext="With stock" />
      </div>

      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold mb-3">National Deployment Telemetry</h2>
        <div className="space-y-4">
          {[
            { label: 'Military Teams Allocated', pct: summary ? Math.round((summary.teamsDeployed / Math.max(summary.teamsTotal, 1)) * 100) : 0, colour: 'bg-blue-500' },
            { label: 'Shelter Beds Occupancy', pct: 66, colour: 'bg-amber-400' },
            { label: 'Rescue Air Support Reserve', pct: 40, colour: 'bg-green-500' },
          ].map(({ label, pct, colour }) => (
            <div key={label}>
              <div className="flex justify-between text-sm mb-1">
                <span>{label}</span>
                <span className="font-semibold">{pct}%</span>
              </div>
              <div className="bg-gray-200 rounded-full h-2">
                <div className={`${colour} h-2 rounded-full`} style={{ width: `${pct}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
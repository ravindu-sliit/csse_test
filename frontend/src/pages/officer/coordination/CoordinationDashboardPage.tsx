import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Home, Users, Zap } from 'lucide-react';
import { fetchCoordinationSummary } from '@/api/shelters.api';
import { SriLankaMap } from '@/components/shared/SriLankaMap';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function CoordinationDashboardPage() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useQuery({
    queryKey: ['coordination-summary'],
    queryFn: () => fetchCoordinationSummary(),
    refetchInterval: 30000,
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Emergency Resource Command</h1>
      <p className="text-gray-500 text-sm mb-6">National Disaster Management response command board.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border p-4">
          <h2 className="font-semibold mb-3">National Deployment Projection</h2>
          <SriLankaMap height="380px" pins={[]} />
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Operational Command Summary</h2>
            <div className="space-y-3">
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Rescue Teams Deployed</span>
                <span className="font-semibold text-sm">{summary?.teamsDeployed ?? 0} / {summary?.teamsTotal ?? 0} Teams</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Active Safe Shelters</span>
                <span className="font-semibold text-sm">{summary?.activeShelters ?? 0} Open</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-gray-600">Supply Hubs Active</span>
                <span className="font-semibold text-sm">{summary?.supplyHubsActive ?? 0} Centers</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold mb-3">Immediate Command Actions</h2>
            <div className="space-y-2">
              <button onClick={() => navigate('/officer/shelters')} className="w-full bg-gray-900 text-white py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2">
                <Home className="w-4 h-4" /> Open New Shelter
              </button>
              <button onClick={() => navigate('/officer/coordination/rescue')} className="w-full border py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50">
                <Users className="w-4 h-4" /> Dispatch Rescue Unit
              </button>
              <button onClick={() => navigate('/officer/coordination/supply')} className="w-full border py-2.5 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 hover:bg-gray-50">
                <Zap className="w-4 h-4" /> Initiate Supply Flight
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
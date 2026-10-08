import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Home, Users, Zap } from 'lucide-react';
import { fetchCoordinationSummary, fetchShelters } from '@/api/shelters.api';
import { SriLankaMap } from '@/components/shared/SriLankaMap';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

export function CoordinationDashboardPage() {
  const navigate = useNavigate();
  const { data: summary, isLoading } = useQuery({
    queryKey: ['coordination-summary'],
    queryFn: () => fetchCoordinationSummary(),
    refetchInterval: 30000,
  });
  const { data: sheltersData } = useQuery({
    queryKey: ['shelters'],
    queryFn: () => fetchShelters(),
    refetchInterval: 30000,
  });
  const districtCenters: Record<string, [number, number]> = {
    Colombo: [6.9271, 79.8612], Gampaha: [7.0873, 79.9993], Kalutara: [6.5854, 80.0006],
    Kandy: [7.2906, 80.6337], Matale: [7.4675, 80.6234], 'Nuwara Eliya': [6.9497, 80.7891],
    Galle: [6.0535, 80.221], Matara: [5.9549, 80.555], Hambantota: [6.1241, 81.1185],
    Jaffna: [9.6615, 80.0255], Kilinochchi: [9.3803, 80.377], Mannar: [8.981, 79.9044],
    Vavuniya: [8.7514, 80.4971], Mullaitivu: [9.2671, 80.8142], Trincomalee: [8.5874, 81.2152],
    Batticaloa: [7.731, 81.6747], Ampara: [7.2975, 81.682], Kurunegala: [7.4863, 80.3623],
    Puttalam: [8.0362, 79.8283], Anuradhapura: [8.3114, 80.4037], Polonnaruwa: [7.9403, 81.0188],
    Badulla: [6.9934, 81.055], Monaragala: [6.8728, 81.3507], Ratnapura: [6.6828, 80.3992], Kegalle: [7.2513, 80.3464],
  };
  const shelterPins = (sheltersData?.data ?? []).map((shelter) => {
    const fallback = districtCenters[shelter.district] ?? [7.8731, 80.7718];
    const hasExactLocation = shelter.latitude != null && shelter.longitude != null;
    return {
      id: shelter.id,
      lat: hasExactLocation ? shelter.latitude! : fallback[0],
      lng: hasExactLocation ? shelter.longitude! : fallback[1],
      label: `${shelter.name} — ${shelter.district}${hasExactLocation ? '' : ' (district location)'} (${shelter.currentOccupancy}/${shelter.capacity})`,
    };
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-1">Emergency Resource Command</h1>
      <p className="text-gray-500 text-sm mb-6">National Disaster Management response command board.</p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border p-4">
          <h2 className="font-semibold mb-3">National Deployment Projection</h2>
          <SriLankaMap height="380px" pins={shelterPins} />
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

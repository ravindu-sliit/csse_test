import { useQuery } from '@tanstack/react-query';
import { fetchShelters } from '@/api/shelters.api';
import { SriLankaMap } from '@/components/shared/SriLankaMap';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Shelter } from '@/types';

const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Colombo': [6.9271, 79.8612], 'Gampaha': [7.0873, 79.9993], 'Kalutara': [6.5854, 80.0006],
  'Kandy': [7.2906, 80.6337], 'Ratnapura': [6.6828, 80.3992], 'Galle': [6.0535, 80.2210],
  'Matara': [5.9549, 80.5550], 'Hambantota': [6.1241, 81.1185],
};

export function SheltersMapPage() {
  const { data, isLoading } = useQuery({ queryKey: ['shelters'], queryFn: () => fetchShelters() });
  const shelters: Shelter[] = data?.data || [];

  const pins = shelters.map(s => ({
    id: s.id,
    lat: DISTRICT_COORDS[s.district]?.[0] || 7.8731,
    lng: DISTRICT_COORDS[s.district]?.[1] || 80.7718,
    label: `${s.name} (${s.currentOccupancy}/${s.capacity})`,
  }));

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold mb-3">Shelter Locations</h1>
      {isLoading ? <LoadingSpinner /> : <SriLankaMap pins={pins} height="300px" />}
      <div className="mt-4 space-y-2">
        {shelters.map(s => (
          <div key={s.id} className="bg-white border rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{s.name}</p>
              <p className="text-xs text-gray-400">{s.district} • {s.capacity - s.currentOccupancy} spots available</p>
            </div>
            <StatusBadge status={s.status.toLowerCase()} />
          </div>
        ))}
      </div>
    </div>
  );
}
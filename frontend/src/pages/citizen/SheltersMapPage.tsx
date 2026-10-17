import { useQuery } from '@tanstack/react-query';
import { fetchShelters } from '@/api/shelters.api';
import { SriLankaMap } from '@/components/shared/SriLankaMap';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { Shelter } from '@/types';

export function SheltersMapPage() {
  const { data, isLoading } = useQuery({ queryKey: ['shelters'], queryFn: () => fetchShelters() });
  const shelters: Shelter[] = data?.data || [];

  const pins = shelters.map(s => ({
    id: s.id,
    lat: s.latitude || 7.8731,  // fallback to Sri Lanka center
    lng: s.longitude || 80.7718,
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
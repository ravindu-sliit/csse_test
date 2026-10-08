import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchShelters } from '@/api/shelters.api';
import { fetchWarnings } from '@/api/warnings.api';
import { SriLankaMap, MapPin } from '@/components/shared/SriLankaMap';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { cn } from '@/lib/utils';
import type { Shelter } from '@/types';

// District center coordinates for hazard pins when no GPS is available
const DISTRICT_COORDS: Record<string, [number, number]> = {
  'Colombo': [6.9271, 79.8612], 'Gampaha': [7.0873, 79.9993], 'Kalutara': [6.5854, 80.0006],
  'Kandy': [7.2906, 80.6337], 'Ratnapura': [6.6828, 80.3992], 'Kegalle': [7.2514, 80.3464],
  'Galle': [6.0535, 80.2210], 'Matara': [5.9549, 80.5550], 'Hambantota': [6.1241, 81.1185],
  'Jaffna': [9.6615, 80.0255], 'Trincomalee': [8.5874, 81.2152], 'Batticaloa': [7.7310, 81.6747],
  'Kurunegala': [7.4818, 80.3609], 'Anuradhapura': [8.3114, 80.4037], 'Badulla': [6.9934, 81.0550],
  'Ampara': [7.2832, 81.6742], 'Puttalam': [8.0362, 79.8283], 'Polonnaruwa': [7.9403, 81.0188],
  'Matale': [7.4675, 80.6234], 'Monaragala': [6.8728, 81.3506], 'Nuwara Eliya': [6.9497, 80.7891],
};

export function SheltersMapPage() {
  const [viewMode, setViewMode] = useState<'shelters' | 'hazards' | 'both'>('both');

  const { data: sheltersData, isLoading: sheltersLoading } = useQuery({
    queryKey: ['shelters'],
    queryFn: () => fetchShelters(),
  });

  const { data: warningsData, isLoading: warningsLoading } = useQuery({
    queryKey: ['warnings', { status: 'active' }],
    queryFn: () => fetchWarnings({ status: 'active' }),
  });

  const shelters: Shelter[] = sheltersData?.data || [];
  const warnings = warningsData?.data || [];

  // Shelter pins — only those with real GPS coordinates (GREEN)
  const shelterPins: MapPin[] = shelters
    .filter(s => s.latitude != null && s.longitude != null && s.status !== 'closed')
    .map(s => ({
      id: s.id,
      lat: s.latitude!,
      lng: s.longitude!,
      label: `🏠 ${s.name} (${s.capacity - s.currentOccupancy} spots)`,
      color: 'green' as const,
    }));

  // Hazard pins from active warnings (RED)
  // Use exact GPS if available, otherwise fall back to district centre coords
  const hazardPins: MapPin[] = warnings.flatMap(w => {
    if (w.latitude != null && w.longitude != null) {
      return [{
        id: w.id,
        lat: w.latitude,
        lng: w.longitude,
        label: `⚠️ ${w.hazardType.replace('_', ' ')} - ${w.severityLevel}`,
        color: 'red' as const,
      }];
    }
    return w.targetDistricts.map(d => ({
      id: `${w.id}-${d}`,
      lat: DISTRICT_COORDS[d]?.[0] ?? 7.8731,
      lng: DISTRICT_COORDS[d]?.[1] ?? 80.7718,
      label: `⚠️ ${d} - ${w.hazardType.replace('_', ' ')}`,
      color: 'red' as const,
    }));
  });

  // Combine pins based on view mode
  const pins =
    viewMode === 'shelters' ? shelterPins
    : viewMode === 'hazards' ? hazardPins
    : [...hazardPins, ...shelterPins];

  const isLoading = sheltersLoading || warningsLoading;

  return (
    <div className="px-4 py-4">
      <h1 className="text-xl font-bold mb-2">Shelter Locations</h1>

      {/* View toggle */}
      <div className="flex gap-2 mb-3">
        {(['both', 'shelters', 'hazards'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
              viewMode === mode
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200',
            )}
          >
            {mode === 'both' ? '🗺️ All' : mode === 'shelters' ? '🏠 Shelters' : '⚠️ Hazards'}
          </button>
        ))}
      </div>

      {/* Legend */}
      <div className="flex gap-4 mb-3 text-xs text-gray-500">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-green-500 rounded-full inline-block" />
          Safe Shelters
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 bg-red-500 rounded-full inline-block" />
          Active Hazards
        </span>
      </div>

      {isLoading ? <LoadingSpinner /> : <SriLankaMap pins={pins} height="300px" />}

      {/* Shelter list */}
      <h2 className="font-semibold mt-4 mb-2">Nearby Shelters</h2>
      <div className="space-y-2">
        {shelters.filter(s => s.status !== 'closed').map(s => (
          <div key={s.id} className="bg-white border rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{s.name}</p>
              <p className="text-xs text-gray-400">
                {s.district} • {s.capacity - s.currentOccupancy} spots available
              </p>
            </div>
            <StatusBadge status={s.status.toLowerCase()} />
          </div>
        ))}
      </div>

      {/* Active warnings */}
      {warnings.length > 0 && (
        <>
          <h2 className="font-semibold mt-4 mb-2 text-red-600">⚠️ Active Hazard Warnings</h2>
          <div className="space-y-2">
            {warnings.map(w => (
              <div key={w.id} className="bg-red-50 border border-red-200 rounded-xl p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="font-medium text-sm text-red-800">
                    {w.hazardType.replace('_', ' ')}
                  </p>
                  <span
                    className={cn(
                      'text-xs font-semibold px-2 py-0.5 rounded',
                      w.severityLevel === 'emergency' ? 'bg-red-600 text-white' :
                      w.severityLevel === 'warning'   ? 'bg-amber-500 text-white' :
                                                        'bg-blue-500 text-white',
                    )}
                  >
                    {w.severityLevel.toUpperCase()}
                  </span>
                </div>
                <p className="text-xs text-red-700">{w.message}</p>
                <p className="text-xs text-red-500 mt-1">
                  Affected: {w.targetDistricts.join(', ')}
                </p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

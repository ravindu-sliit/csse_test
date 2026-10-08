import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, Bell, Home } from 'lucide-react';
import { fetchDashboardSummary, fetchWarnings } from '@/api/warnings.api';
import { fetchShelters } from '@/api/shelters.api';
import { StatCard } from '@/components/shared/StatCard';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { SriLankaMap } from '@/components/shared/SriLankaMap';
import { cn } from '@/lib/utils';
import type { SeverityLevel } from '@/types';

export function DashboardPage() {
  const navigate = useNavigate();
  const [mapLayer, setMapLayer] = useState<'hazards' | 'shelters' | 'teams'>('hazards');

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ['dashboard-summary'],
    queryFn: fetchDashboardSummary,
    refetchInterval: 30000,
  });

  const { data: warningsData, isLoading: warningsLoading } = useQuery({
    queryKey: ['warnings', { status: 'active' }],
    queryFn: () => fetchWarnings({ status: 'active' }),
  });

  const activeWarnings = warningsData?.data || [];

  const { data: sheltersData } = useQuery({
    queryKey: ['shelters'],
    queryFn: () => fetchShelters(),
  });
  const shelters = sheltersData?.data || [];

  // Create map pins from active warnings
  const districtCoords: Record<string, [number, number]> = {
    'Colombo': [6.9271, 79.8612], 'Gampaha': [7.0873, 79.9993], 'Kalutara': [6.5854, 80.0006],
    'Kandy': [7.2906, 80.6337], 'Ratnapura': [6.6828, 80.3992], 'Kegalle': [7.2514, 80.3464],
    'Galle': [6.0535, 80.2210], 'Matara': [5.9549, 80.5550], 'Hambantota': [6.1241, 81.1185],
    'Jaffna': [9.6615, 80.0255], 'Trincomalee': [8.5874, 81.2152], 'Batticaloa': [7.7310, 81.6747],
    'Kurunegala': [7.4818, 80.3609], 'Anuradhapura': [8.3114, 80.4037], 'Badulla': [6.9934, 81.0550],
    'Ampara': [7.2832, 81.6742], 'Puttalam': [8.0362, 79.8283], 'Polonnaruwa': [7.9403, 81.0188],
    'Matale': [7.4675, 80.6234], 'Monaragala': [6.8728, 81.3506], 'Vavuniya': [8.7514, 80.4971],
    'Mannar': [8.9810, 79.9044], 'Nuwara Eliya': [6.9497, 80.7891],
  };

  const getMapPins = () => {
    if (mapLayer === 'shelters') {
      // Only show shelters with real GPS coordinates - GREEN markers
      return shelters
        .filter(s => s.latitude != null && s.longitude != null)
        .map(s => ({
          id: s.id,
          lat: s.latitude!,
          lng: s.longitude!,
          label: `${s.name} (${s.currentOccupancy}/${s.capacity})`,
          color: 'green' as const,
        }));
    }
    if (mapLayer === 'teams') {
      // For teams, we'd need team coordinates - for now return empty
      return [];
    }
    // Default: hazards from active warnings - RED markers
    return activeWarnings.flatMap(w => {
      // If warning has GPS coordinates, show a single pin at that location
      if (w.latitude != null && w.longitude != null) {
        return [{
          id: w.id,
          lat: w.latitude,
          lng: w.longitude,
          label: `${w.locationLabel || w.hazardType.replace('_', ' ')} - ${w.severityLevel}`,
          color: 'red' as const,
        }];
      }
      // Otherwise show pins for each target district
      return w.targetDistricts.map(d => ({
        id: `${w.id}-${d}`,
        lat: districtCoords[d]?.[0] || 7.8731,
        lng: districtCoords[d]?.[1] || 80.7718,
        label: `${d} - ${w.hazardType.replace('_', ' ')} (${w.severityLevel})`,
        color: 'red' as const,
      }));
    });
  };

  if (summaryLoading) return <LoadingSpinner fullScreen />;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Emergency Command Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Real-time warning dispatch & monitoring center.</p>
        </div>
        <button
          onClick={() => navigate('/officer/warnings/create')}
          className="bg-red-600 hover:bg-red-700 text-white font-semibold px-5 py-2.5 rounded-lg text-sm flex items-center gap-2 transition-colors"
        >
          <AlertTriangle className="w-4 h-4" />
          Issue New Hazard Warning →
        </button>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard label="Active Warnings" value={summary?.activeWarnings ?? '—'} dot="red" />
        <StatCard label="Pending Reports" value={summary?.pendingReports ?? '—'} dot="orange" />
        <StatCard label="Shelters Open" value={summary?.openShelters ?? '—'} dot="green" />
        <StatCard label="Teams Deployed" value={summary?.deployedTeams ?? '—'} dot="blue" />
      </div>

      {/* Map + Severity Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl border p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-semibold text-gray-800">
                {mapLayer === 'hazards' ? 'District Hazard Map' : mapLayer === 'shelters' ? 'Shelter Locations' : 'Rescue Teams'}
              </h2>
              <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setMapLayer('hazards')}
                  className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors', mapLayer === 'hazards' ? 'bg-white shadow text-red-600' : 'text-gray-500 hover:text-gray-700')}
                >
                  Hazards
                </button>
                <button
                  onClick={() => setMapLayer('shelters')}
                  className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors', mapLayer === 'shelters' ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700')}
                >
                  Shelters
                </button>
                <button
                  onClick={() => setMapLayer('teams')}
                  className={cn('px-3 py-1 text-xs font-medium rounded-md transition-colors', mapLayer === 'teams' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700')}
                >
                  Teams
                </button>
              </div>
            </div>
            <SriLankaMap pins={getMapPins()} height="380px" />
          </div>
        </div>

        <div className="space-y-4">
          {/* Live Severity Monitor */}
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Live Severity Monitoring</h2>
            {warningsLoading ? (
              <LoadingSpinner size="sm" />
            ) : activeWarnings.length === 0 ? (
              <p className="text-gray-400 text-sm">No active warnings.</p>
            ) : (
              <div className="space-y-3">
                {activeWarnings.slice(0, 5).map(w => (
                  <div key={w.id} className="border rounded-lg p-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-semibold text-gray-600 uppercase">
                        {w.hazardType.replace('_', ' ')}
                      </span>
                      <SeverityBadge level={w.severityLevel.toLowerCase() as SeverityLevel} size="sm" />
                    </div>
                    <p className="text-xs text-gray-600 line-clamp-2">{w.message}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Affected: {w.targetDistricts.join(', ')}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick actions */}
          <div className="bg-white rounded-xl border p-4">
            <h2 className="font-semibold text-gray-800 mb-3">Quick Actions</h2>
            <div className="space-y-2">
              <button onClick={() => navigate('/officer/warnings/create')} className="w-full flex items-center gap-2 text-sm text-left px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg transition-colors">
                <Bell className="w-4 h-4" /> Issue Warning
              </button>
              <button onClick={() => navigate('/officer/shelters')} className="w-full flex items-center gap-2 text-sm text-left px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg transition-colors">
                <Home className="w-4 h-4" /> Manage Shelters
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
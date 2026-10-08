import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, Clock, AlertTriangle, CheckCircle, Truck, Users } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { apiClient } from '@/api/client';
import { cn } from '@/lib/utils';

interface Mission {
  id: string;
  targetDistrict: string;
  missionDetails: string | null;
  criticality: 'HIGH' | 'MEDIUM' | 'ROUTINE';
  gearChecklist: string[];
  status: string;
  dispatchedAt: string;
  returnedAt: string | null;
}

interface Team {
  id: string;
  teamCode: string;
  teamName: string;
  teamType: string;
  status: string;
  memberCount: number;
}

const STATUS_OPTIONS = [
  { value: 'dispatched', label: 'Dispatched', color: 'bg-blue-100 text-blue-700' },
  { value: 'en_route', label: 'En Route', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'on_mission', label: 'On Mission', color: 'bg-orange-100 text-orange-700' },
  { value: 'returning', label: 'Returning', color: 'bg-purple-100 text-purple-700' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100 text-green-700' },
];

const CRITICALITY_CONFIG = {
  HIGH: { bg: 'bg-red-100', text: 'text-red-700', label: 'High Priority' },
  MEDIUM: { bg: 'bg-amber-100', text: 'text-amber-700', label: 'Medium' },
  ROUTINE: { bg: 'bg-gray-100', text: 'text-gray-700', label: 'Routine' },
};

export function MyMissionsPage() {
  const queryClient = useQueryClient();
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['my-missions'],
    queryFn: async () => {
      const res = await apiClient.get<{ success: boolean; data: { team: Team | null; missions: Mission[] } }>('/my-missions');
      return res.data.data;
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      await apiClient.patch(`/dispatches/${id}/status`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['my-missions'] });
      setUpdatingId(null);
    },
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  const team = data?.team;
  const missions = data?.missions || [];
  const activeMissions = missions.filter(m => m.status !== 'completed');
  const completedMissions = missions.filter(m => m.status === 'completed');

  return (
    <div className="p-6">
      <PageHeader
        title="My Missions"
        subtitle="View assigned rescue missions and update status"
      />

      {/* Team Info Card */}
      {team && (
        <div className="bg-white rounded-xl border p-5 mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h2 className="font-bold text-lg">{team.teamName}</h2>
                <p className="text-sm text-gray-500">{team.teamCode} • {team.teamType} • {team.memberCount} members</p>
              </div>
            </div>
            <div className={cn(
              'px-3 py-1 rounded-full text-sm font-semibold',
              team.status === 'AVAILABLE' ? 'bg-green-100 text-green-700' :
              team.status === 'ON_MISSION' ? 'bg-orange-100 text-orange-700' :
              'bg-blue-100 text-blue-700'
            )}>
              {team.status.replace('_', ' ')}
            </div>
          </div>
        </div>
      )}

      {!team && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5 mb-6">
          <p className="text-yellow-800">No rescue team assigned to your account. Contact DMC administration.</p>
        </div>
      )}

      {/* Active Missions */}
      <div className="mb-8">
        <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Active Missions ({activeMissions.length})
        </h3>
        
        {activeMissions.length === 0 ? (
          <div className="bg-gray-50 rounded-xl p-8 text-center">
            <CheckCircle className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-500">No active missions. Standing by for dispatch.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeMissions.map(mission => (
              <MissionCard
                key={mission.id}
                mission={mission}
                isUpdating={updatingId === mission.id}
                onUpdateStatus={(status) => {
                  setUpdatingId(mission.id);
                  updateMutation.mutate({ id: mission.id, status });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Completed Missions */}
      {completedMissions.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-800 mb-4 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            Completed Missions ({completedMissions.length})
          </h3>
          <div className="space-y-3 opacity-70">
            {completedMissions.slice(0, 5).map(mission => (
              <div key={mission.id} className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{mission.targetDistrict} District</p>
                    <p className="text-sm text-gray-500">{mission.missionDetails || 'No details'}</p>
                  </div>
                  <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-semibold">Completed</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function MissionCard({ mission, isUpdating, onUpdateStatus }: { mission: Mission; isUpdating: boolean; onUpdateStatus: (status: string) => void }) {
  const critConfig = CRITICALITY_CONFIG[mission.criticality] || CRITICALITY_CONFIG.ROUTINE;
  const currentStatus = STATUS_OPTIONS.find(s => s.value === mission.status.toLowerCase()) || STATUS_OPTIONS[0];
  
  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-start justify-between mb-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4 text-red-500" />
            <span className="font-bold text-lg">{mission.targetDistrict} District</span>
            <span className={cn('px-2 py-0.5 rounded text-xs font-semibold', critConfig.bg, critConfig.text)}>
              {critConfig.label}
            </span>
          </div>
          <p className="text-gray-600">{mission.missionDetails || 'Rescue and relief operations'}</p>
        </div>
        <span className={cn('px-3 py-1 rounded-full text-sm font-semibold', currentStatus.color)}>
          {currentStatus.label}
        </span>
      </div>

      {/* Gear Checklist */}
      {mission.gearChecklist.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-gray-400 uppercase mb-2">Gear Checklist</p>
          <div className="flex flex-wrap gap-2">
            {mission.gearChecklist.map((item, i) => (
              <span key={i} className="bg-gray-100 px-2 py-1 rounded text-xs">{item}</span>
            ))}
          </div>
        </div>
      )}

      {/* Timestamp */}
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-4">
        <Clock className="w-4 h-4" />
        Dispatched: {new Date(mission.dispatchedAt).toLocaleString()}
      </div>

      {/* Status Update Buttons */}
      <div className="border-t pt-4">
        <p className="text-xs text-gray-400 uppercase mb-2">Update Status</p>
        <div className="flex flex-wrap gap-2">
          {STATUS_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => onUpdateStatus(opt.value)}
              disabled={isUpdating || opt.value === mission.status.toLowerCase()}
              className={cn(
                'px-3 py-1.5 rounded-lg text-sm font-medium transition-all',
                opt.value === mission.status.toLowerCase()
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
                isUpdating && 'opacity-50 cursor-not-allowed'
              )}
            >
              {opt.value === mission.status.toLowerCase() && <Truck className="w-3 h-3 inline mr-1" />}
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

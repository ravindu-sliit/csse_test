import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchRescueTeams, dispatchTeamApi } from '@/api/shelters.api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { DISTRICTS } from '@/lib/constants';
import type { RescueTeam } from '@/types';

const GEAR_OPTIONS = [
  'Inflatable Assault Boats', 'Emergency Paramedic Trauma Kits', 'Chainsaw Heavy Rescue Kit',
  'Rope and Harness Equipment', 'Radio Communication Units', 'Water Purification Units',
];

export function RescueDispatchPage() {
  const queryClient = useQueryClient();
  const [selectedTeam, setSelectedTeam] = useState<RescueTeam | null>(null);
  const [targetDistrict, setTargetDistrict] = useState('');
  const [criticality, setCriticality] = useState('ROUTINE');
  const [gear, setGear] = useState<string[]>([]);
  const [dispatchError, setDispatchError] = useState('');

  const { data: teams, isLoading } = useQuery({
    queryKey: ['rescue-teams'],
    queryFn: () => fetchRescueTeams(),
    refetchInterval: 15000,
  });

  const dispatchMutation = useMutation({
    mutationFn: dispatchTeamApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rescue-teams'] });
      setSelectedTeam(null); setDispatchError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setDispatchError(msg || 'Dispatch failed');
    },
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  return (
    <div className="p-6">
      <PageHeader title="Rescue Team Deployment Command" subtitle="Mobilize military units, civilian crisis squads and first responders." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Team list */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-3">Operational Emergency Units</h2>
          <div className="space-y-2">
            {(teams || []).map(t => (
              <div
                key={t.id}
                onClick={() => setSelectedTeam(t)}
                className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-colors ${
                  selectedTeam?.id === t.id ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-gray-50'
                }`}
              >
                <div>
                  <p className="font-semibold text-sm">{t.teamCode} — {t.teamName}</p>
                  <p className={`text-xs ${selectedTeam?.id === t.id ? 'text-gray-300' : 'text-gray-500'}`}>{t.memberCount} Men • {t.district}</p>
                </div>
                <StatusBadge status={t.status.toLowerCase()} />
              </div>
            ))}
          </div>
        </div>

        {/* Dispatch form */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">New Mission Deployment Form</h2>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">Select Rescue Team</label>
              <div className="border rounded-lg px-3 py-2 text-sm bg-gray-50">{selectedTeam ? `${selectedTeam.teamCode} — ${selectedTeam.teamName}` : 'Click a team to select'}</div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">Target Crisis District</label>
              <select value={targetDistrict} onChange={e => setTargetDistrict(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select district</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">Mission Criticality</label>
              <div className="flex gap-2">
                {['HIGH', 'MEDIUM', 'ROUTINE'].map(c => (
                  <button key={c} type="button" onClick={() => setCriticality(c)}
                    className={`flex-1 border rounded-lg py-2 text-sm font-semibold transition-colors ${
                      criticality === c ? (c === 'HIGH' ? 'bg-red-100 text-red-700 border-red-300' : c === 'MEDIUM' ? 'bg-amber-100 text-amber-700 border-amber-300' : 'bg-gray-100 text-gray-700') : 'hover:bg-gray-50'
                    }`}
                  >{c}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-400 uppercase mb-1 block">Mandatory Gear Checklist</label>
              <div className="space-y-1">
                {GEAR_OPTIONS.map(g => (
                  <label key={g} className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={gear.includes(g)} onChange={e => setGear(e.target.checked ? [...gear, g] : gear.filter(x => x !== g))} className="w-4 h-4" />
                    {g}
                  </label>
                ))}
              </div>
            </div>

            {dispatchError && <p className="text-red-500 text-sm">{dispatchError}</p>}

            <button
              onClick={() => {
                if (!selectedTeam || !targetDistrict) { setDispatchError('Select a team and district'); return; }
                dispatchMutation.mutate({ teamId: selectedTeam.id, targetDistrict, criticality, gearChecklist: gear });
              }}
              disabled={dispatchMutation.isPending}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg text-sm disabled:opacity-50"
            >
              {dispatchMutation.isPending ? 'Dispatching...' : '📡 DISPATCH COMMAND NOW'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
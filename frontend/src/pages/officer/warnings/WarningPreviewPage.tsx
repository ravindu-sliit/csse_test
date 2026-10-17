import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createWarning } from '@/api/warnings.api';
import { PageHeader } from '@/components/shared/PageHeader';
import { BROADCAST_CHANNELS, SEVERITY_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function WarningPreviewPage() {
  const { state } = useLocation() as { state: { hazardType: string; severityLevel: string; targetDistricts: string[]; targetRiverBasin?: string; message: string; broadcastChannels?: string[]; latitude?: number; longitude?: number; locationLabel?: string; sourceReportId?: string } };
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedChannels, setSelectedChannels] = useState<string[]>(
    state?.broadcastChannels || ['SMS_BLAST', 'PUSH_NOTIFICATION', 'TV_RADIO']
  );

  const mutation = useMutation({
    mutationFn: createWarning,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['warnings'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard-summary'] });
      navigate(`/officer/warnings/${(data as unknown as { id: string }).id}/status`);
    },
  });

  if (!state) return <div className="p-6"><p className="text-gray-500">No warning data. <button onClick={() => navigate('/officer/warnings/create')} className="text-red-600 hover:underline">Go back</button></p></div>;

  const severityKey = state.severityLevel?.toLowerCase() as keyof typeof SEVERITY_CONFIG;
  const severityCfg = SEVERITY_CONFIG[severityKey] || SEVERITY_CONFIG.watch;

  const totalReach = selectedChannels.reduce((sum, ch) => {
    const reaches: Record<string, number> = { SMS_BLAST: 8200000, PUSH_NOTIFICATION: 1400000, TV_RADIO: 12000000, COASTAL_SIREN: 500000 };
    return sum + (reaches[ch] || 0);
  }, 0);

  const handleBroadcast = () => {
    mutation.mutate({
      hazardType: state.hazardType.toUpperCase(),
      severityLevel: state.severityLevel.toUpperCase(),
      targetDistricts: state.targetDistricts,
      targetRiverBasin: state.targetRiverBasin,
      message: state.message,
      broadcastChannels: selectedChannels.map(ch => ch.toUpperCase()),
      latitude: state.latitude,
      longitude: state.longitude,
      locationLabel: state.locationLabel,
      ...(state.sourceReportId ? { sourceReportId: state.sourceReportId } : {}),
    });
  };

  return (
    <div className="p-6">
      <PageHeader title="Broadcast Preview & Verification" subtitle="Final verification checklist before dispatching live signals." />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Citizen simulation */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-4">Citizen Mobile Display Simulation</h2>
          <div className="bg-gray-900 rounded-2xl p-4 max-w-xs mx-auto">
            <div className="text-gray-400 text-xs mb-3 text-right">12:00 PM</div>
            <div className="bg-red-50 border border-red-200 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-red-500 text-sm">⚠</span>
                <span className="text-red-600 font-bold text-sm">DMC EMERGENCY WARNING</span>
              </div>
              <p className="text-gray-800 text-sm">{state.message}</p>
              <button className="mt-3 w-full bg-red-600 text-white text-sm font-semibold py-2 rounded-lg">LOCATE NEAREST SHELTER</button>
            </div>
          </div>
        </div>

        {/* Channels + Broadcast */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-4">Target Broadcast Channels</h2>
          <div className="space-y-3 mb-6">
            {BROADCAST_CHANNELS.map(ch => (
              <label key={ch.value} className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-gray-50">
                <div>
                  <p className="text-sm font-medium">{ch.label}</p>
                  <p className="text-xs text-gray-400">{ch.description}</p>
                </div>
                <input
                  type="checkbox"
                  checked={selectedChannels.includes(ch.value)}
                  onChange={e => {
                    setSelectedChannels(e.target.checked
                      ? [...selectedChannels, ch.value]
                      : selectedChannels.filter(x => x !== ch.value)
                    );
                  }}
                  className="w-4 h-4 accent-red-600"
                />
              </label>
            ))}
          </div>

          {/* Reach estimate */}
          <div className="bg-blue-50 rounded-lg p-4 mb-6">
            <p className="text-xs text-blue-600 font-semibold uppercase mb-2">Estimated Immediate Reach</p>
            <div className="flex gap-8">
              <div>
                <p className="text-2xl font-bold">{(totalReach / 1e6).toFixed(1)}M</p>
                <p className="text-xs text-gray-500">Potential citizens targeted</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-green-600">{totalReach > 0 ? '99.4%' : '0%'}</p>
                <p className="text-xs text-gray-500">DMC Coverage Area</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button onClick={() => navigate(-1)} className="flex-1 border rounded-lg py-2.5 text-sm font-medium hover:bg-gray-50">
              ← Back & Edit warning
            </button>
            <button
              onClick={handleBroadcast}
              disabled={mutation.isPending || selectedChannels.length === 0}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50"
            >
              {mutation.isPending ? 'Broadcasting...' : '⚡ AUTHORIZE & BROADCAST NOW'}
            </button>
          </div>
          {mutation.isError && <p className="text-red-500 text-xs mt-2">Broadcast failed. Please try again.</p>}
        </div>
      </div>
    </div>
  );
}
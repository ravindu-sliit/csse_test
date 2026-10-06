import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchBroadcastStatus, cancelWarning } from '@/api/warnings.api';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

interface ChannelStatus { channel: string; progressPercent: number; confirmedReach: number | null; failedCount: number | null; status: string; }
interface BroadcastData { warningCode: string; status: string; channels: ChannelStatus[]; totalTargetCitizens: number; totalConfirmedDeliveries: number; totalFailed: number; }

export function BroadcastStatusPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery({
    queryKey: ['broadcast-status', id],
    queryFn: () => fetchBroadcastStatus(id!),
    refetchInterval: 5000,
    enabled: !!id,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelWarning(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['warnings'] });
      navigate('/officer/warnings');
    },
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  const data = status as BroadcastData | undefined;

  return (
    <div className="p-6">
      <div className="bg-gray-900 text-white rounded-xl p-5 mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs text-yellow-400 font-semibold uppercase mb-1">Dispatched Warning ID: {data?.warningCode}</p>
          <p className="text-xl font-bold">{data?.warningCode}</p>
        </div>
        <span className="bg-yellow-400 text-gray-900 text-xs font-bold px-3 py-1 rounded-full">BROADCAST IN PROGRESS</span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Channel progress */}
        <div className="lg:col-span-2 bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-4">Channel Delivery Progress</h2>
          <div className="space-y-4">
            {data?.channels?.map((ch: ChannelStatus) => (
              <div key={ch.channel}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{ch.channel.replace('_', ' ')}</span>
                  <span className="font-semibold">{ch.progressPercent ?? 'ACTIVE'}%</span>
                </div>
                <div className="bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-red-500 h-2 rounded-full transition-all"
                    style={{ width: `${ch.progressPercent || 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Aggregates */}
        <div className="bg-white rounded-xl border p-6">
          <h2 className="font-semibold mb-4">Delivery Aggregates</h2>
          <div className="space-y-3">
            <div>
              <p className="text-xs text-gray-400 uppercase">Total Target Citizens</p>
              <p className="text-2xl font-bold">{(data?.totalTargetCitizens || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Confirmed Deliveries</p>
              <p className="text-2xl font-bold text-green-600">{(data?.totalConfirmedDeliveries || 0).toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase">Failed / No Acknowledgement</p>
              <p className="text-2xl font-bold text-red-600">{(data?.totalFailed || 0).toLocaleString()}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-2 gap-4 mt-6">
        <button
          onClick={() => cancelMutation.mutate()}
          disabled={cancelMutation.isPending}
          className="bg-gray-900 text-white font-semibold py-3 rounded-lg text-sm hover:bg-gray-800 disabled:opacity-50"
        >
          CEASE & RETRACT WARNING
        </button>
        <button className="bg-red-600 text-white font-semibold py-3 rounded-lg text-sm hover:bg-red-700">
          ESCALATE TO MILITARY MOBILIZATION
        </button>
      </div>
    </div>
  );
}
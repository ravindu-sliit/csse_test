import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchSupplies, fetchSupplyDispatches, createSupplyDispatchApi } from '@/api/shelters.api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import type { ReliefSupply } from '@/types';

export function SupplyChainPage() {
  const queryClient = useQueryClient();
  const [showDispatch, setShowDispatch] = useState(false);
  const [dispatchForm, setDispatchForm] = useState({ supplyId: '', destinationLabel: '', quantity: '' });
  const [dispatchError, setDispatchError] = useState('');

  const { data: supplies, isLoading: suppliesLoading } = useQuery({ queryKey: ['supplies'], queryFn: () => fetchSupplies() });
  const { data: dispatchData } = useQuery({ queryKey: ['supply-dispatches'], queryFn: () => fetchSupplyDispatches() });

  const dispatchMutation = useMutation({
    mutationFn: createSupplyDispatchApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supply-dispatches'] });
      queryClient.invalidateQueries({ queryKey: ['supplies'] });
      setShowDispatch(false);
      setDispatchError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setDispatchError(msg || 'Dispatch failed');
    },
  });

  const supplyList: ReliefSupply[] = supplies || [];
  const dispatches = dispatchData?.data || [];

  return (
    <div className="p-6">
      <PageHeader
        title="Relief Supply Chain Command"
        subtitle="Coordinate emergency provisions dispatch and transit status."
        action={
          <button onClick={() => setShowDispatch(!showDispatch)} className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg">Create Dispatch Bill</button>
        }
      />

      {/* Inventory */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {suppliesLoading ? <LoadingSpinner size="sm" /> : supplyList.map(s => (
          <div key={s.id} className="bg-white border rounded-xl p-3">
            <p className="text-xs text-gray-400 mb-1">{s.name}</p>
            <p className="font-bold text-lg">{s.quantity.toLocaleString()}</p>
            <p className="text-xs text-gray-500">{s.unit}</p>
            <div className="mt-2 bg-gray-200 rounded-full h-1">
              <div className="bg-green-500 h-1 rounded-full" style={{ width: `${Math.min((s.quantity / 3000) * 100, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>

      {/* Dispatch form */}
      {showDispatch && (
        <div className="bg-white border rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-4">Create Supply Dispatch Bill</h2>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Supply Item</label>
              <select value={dispatchForm.supplyId} onChange={e => setDispatchForm(p => ({ ...p, supplyId: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select supply</option>
                {supplyList.map(s => <option key={s.id} value={s.id}>{s.name} ({s.quantity} {s.unit})</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Destination</label>
              <input value={dispatchForm.destinationLabel} onChange={e => setDispatchForm(p => ({ ...p, destinationLabel: e.target.value }))} placeholder="Shelter name or district" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Quantity</label>
              <input type="number" value={dispatchForm.quantity} onChange={e => setDispatchForm(p => ({ ...p, quantity: e.target.value }))} placeholder="e.g. 400" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          {dispatchError && <p className="text-red-500 text-sm mt-2">{dispatchError}</p>}
          <button
            onClick={() => {
              const supply = supplyList.find(s => s.id === dispatchForm.supplyId);
              if (!supply || !dispatchForm.destinationLabel || !dispatchForm.quantity) { setDispatchError('Fill all fields'); return; }
              dispatchMutation.mutate({ supplyId: dispatchForm.supplyId, destinationLabel: dispatchForm.destinationLabel, quantity: parseFloat(dispatchForm.quantity), unit: supply.unit });
            }}
            disabled={dispatchMutation.isPending}
            className="mt-4 bg-gray-900 text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {dispatchMutation.isPending ? 'Dispatching...' : 'Create Dispatch'}
          </button>
        </div>
      )}

      {/* Dispatch log */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50">
          <h2 className="font-semibold text-sm">Active Relief Supply Log</h2>
        </div>
        {dispatches.length === 0 ? (
          <div className="p-8 text-center"><p className="text-gray-400 text-sm">No dispatches yet.</p></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b">{['Dispatched ID', 'Destination Shelter', 'Supplies Class', 'Quantity', 'Transit Status'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {dispatches.map((d: { id: string; dispatchCode: string; destinationLabel: string; supply?: { category?: string }; quantity: number; unit: string; transitStatus: string }) => (
                <tr key={d.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-sm font-semibold">{d.dispatchCode}</td>
                  <td className="px-4 py-3 text-sm">{d.destinationLabel}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{d.supply?.category || '—'}</td>
                  <td className="px-4 py-3 text-sm">{d.quantity} {d.unit}</td>
                  <td className="px-4 py-3"><StatusBadge status={d.transitStatus.toLowerCase()} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
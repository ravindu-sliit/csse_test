import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { fetchShelters, fetchSheltersSummary, createShelterApi, updateOccupancyApi, deleteShelterApi } from '@/api/shelters.api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatCard } from '@/components/shared/StatCard';
import { DISTRICTS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Shelter } from '@/types';

function OccupancyBar({ current, capacity }: { current: number; capacity: number }) {
  const pct = capacity > 0 ? Math.round((current / capacity) * 100) : 0;
  const colour = pct >= 100 ? 'bg-red-500' : pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-green-500';
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span>{current} / {capacity} pax</span>
        <span>{pct}%</span>
      </div>
      <div className="bg-gray-200 rounded-full h-2">
        <div className={cn('h-2 rounded-full', colour)} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

export function SheltersPage() {
  const queryClient = useQueryClient();
  const [showRegister, setShowRegister] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [newOccupancy, setNewOccupancy] = useState('');
  const [registerForm, setRegisterForm] = useState({ name: '', address: '', district: '', capacity: '' });
  const [occupancyError, setOccupancyError] = useState('');
  const [deleteError, setDeleteError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['shelters'], queryFn: () => fetchShelters() });
  const { data: summary } = useQuery({ queryKey: ['shelters-summary'], queryFn: fetchSheltersSummary });

  const createMutation = useMutation({
    mutationFn: createShelterApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelters'] });
      queryClient.invalidateQueries({ queryKey: ['shelters-summary'] });
      setShowRegister(false);
    },
  });

  const occupancyMutation = useMutation({
    mutationFn: ({ id, count }: { id: string; count: number }) => updateOccupancyApi(id, count),
    onSuccess: () => {
      // Refresh both the shelter rows and aggregate capacity cards.
      queryClient.invalidateQueries({ queryKey: ['shelters'] });
      queryClient.invalidateQueries({ queryKey: ['shelters-summary'] });
      setUpdatingId(null);
      setNewOccupancy('');
      setOccupancyError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setOccupancyError(msg || 'Failed to update occupancy');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteShelterApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelters'] });
      queryClient.invalidateQueries({ queryKey: ['shelters-summary'] });
      queryClient.invalidateQueries({ queryKey: ['coordination-summary'] });
      setDeleteError('');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setDeleteError(msg || 'Failed to delete shelter');
    },
  });

  const shelters: Shelter[] = data?.data || [];

  return (
    <div className="p-6">
      <PageHeader
        title="Safe Shelter Registry & Monitoring"
        subtitle="Real-time capacity utilization, relief camps status."
        action={
          <button onClick={() => setShowRegister(!showRegister)} className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2">
            <Plus className="w-4 h-4" /> Register Shelter
          </button>
        }
      />

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <StatCard label="Total Shelter Capacity" value={(summary?.totalCapacity || 0).toLocaleString()} />
        <StatCard label="Current Occupancy" value={(summary?.totalOccupancy || 0).toLocaleString()} dot="orange" />
        <StatCard label="Available Spots" value={(summary?.availableSpots || 0).toLocaleString()} dot="green" />
      </div>

      {/* Register form */}
      {showRegister && (
        <div className="bg-white border rounded-xl p-5 mb-6">
          <h2 className="font-semibold mb-4">Register Emergency Shelter</h2>
          <div className="grid grid-cols-2 gap-4">
            {[{ key: 'name', label: 'Shelter Name', placeholder: 'e.g. Colombo Town Hall' },
              { key: 'address', label: 'Location / Address', placeholder: 'Full address' }].map(f => (
              <div key={f.key}>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{f.label}</label>
                <input value={registerForm[f.key as keyof typeof registerForm]} onChange={e => setRegisterForm(prev => ({ ...prev, [f.key]: e.target.value }))} placeholder={f.placeholder} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">District</label>
              <select value={registerForm.district} onChange={e => setRegisterForm(prev => ({ ...prev, district: e.target.value }))} className="w-full border rounded-lg px-3 py-2 text-sm">
                <option value="">Select district</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Capacity (Pax)</label>
              <input type="number" value={registerForm.capacity} onChange={e => setRegisterForm(prev => ({ ...prev, capacity: e.target.value }))} placeholder="500" className="w-full border rounded-lg px-3 py-2 text-sm" />
            </div>
          </div>
          <button
            onClick={() => createMutation.mutate({ name: registerForm.name, address: registerForm.address, district: registerForm.district, capacity: parseInt(registerForm.capacity), amenities: [] })}
            disabled={createMutation.isPending}
            className="mt-4 bg-gray-900 text-white font-semibold px-5 py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {createMutation.isPending ? 'Registering...' : 'Register Shelter'}
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        {isLoading ? <LoadingSpinner /> : shelters.length === 0 ? (
          <div className="p-12 text-center"><p className="text-gray-400 text-sm">No shelters registered.</p></div>
        ) : (
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>{['Shelter Name', 'District', 'Capacity', 'Occupancy', 'Status', 'Actions'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>)}</tr>
            </thead>
            <tbody className="divide-y">
              {shelters.map(s => (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-sm">{s.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{s.district}</td>
                  <td className="px-4 py-3 text-sm">{s.capacity} Pax</td>
                  <td className="px-4 py-3 w-40"><OccupancyBar current={s.currentOccupancy} capacity={s.capacity} /></td>
                  <td className="px-4 py-3"><StatusBadge status={s.status.toLowerCase()} /></td>
                  <td className="px-4 py-3">
                    {updatingId === s.id ? (
                      <div className="flex gap-2 items-center">
                        <input type="number" value={newOccupancy} onChange={e => { setNewOccupancy(e.target.value); setOccupancyError(''); }} className="border rounded px-2 py-1 text-sm w-20" placeholder="Count" />
                        <button disabled={occupancyMutation.isPending || newOccupancy === ''} onClick={() => occupancyMutation.mutate({ id: s.id, count: Number(newOccupancy) })} className="bg-gray-900 text-white text-xs font-medium px-3 py-1.5 rounded-md hover:bg-gray-700 disabled:opacity-50">{occupancyMutation.isPending ? 'Saving…' : 'Save'}</button>
                        <button disabled={occupancyMutation.isPending} onClick={() => { setUpdatingId(null); setOccupancyError(''); }} className="border border-gray-300 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <button onClick={() => { setUpdatingId(s.id); setNewOccupancy(String(s.currentOccupancy)); setDeleteError(''); }} className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100">
                          <Pencil className="h-3.5 w-3.5" /> Update Occupancy
                        </button>
                        <button
                          disabled={deleteMutation.isPending}
                          onClick={() => {
                            if (window.confirm(`Delete shelter “${s.name}”? This action cannot be undone.`)) deleteMutation.mutate(s.id);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" /> Delete
                        </button>
                      </div>
                    )}
                    {updatingId === s.id && occupancyError && <p className="text-red-500 text-xs mt-1">{occupancyError}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {deleteError && <p role="alert" className="mt-3 text-sm text-red-600">{deleteError}</p>}
    </div>
  );
}

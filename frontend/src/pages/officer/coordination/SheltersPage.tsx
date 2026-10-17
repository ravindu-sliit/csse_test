import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { fetchShelters, fetchSheltersSummary, createShelterApi, updateOccupancyApi } from '@/api/shelters.api';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { StatCard } from '@/components/shared/StatCard';
import { DISTRICTS, DISTRICT_CENTERS } from '@/lib/constants';
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
  const [registerForm, setRegisterForm] = useState({
    name: '', address: '', district: '', capacity: '',
    latitude: '', longitude: '',
  });
  const [occupancyError, setOccupancyError] = useState('');
  const [formError, setFormError] = useState('');

  const { data, isLoading } = useQuery({ queryKey: ['shelters'], queryFn: () => fetchShelters() });
  const { data: summary } = useQuery({ queryKey: ['shelters-summary'], queryFn: fetchSheltersSummary });

  const createMutation = useMutation({
    mutationFn: createShelterApi,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelters'] });
      setShowRegister(false);
      setRegisterForm({ name: '', address: '', district: '', capacity: '', latitude: '', longitude: '' });
      setFormError('');
    },
  });

  const occupancyMutation = useMutation({
    mutationFn: ({ id, count }: { id: string; count: number }) => updateOccupancyApi(id, count),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shelters'] }); setUpdatingId(null); setOccupancyError(''); },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setOccupancyError(msg || 'Failed to update occupancy');
    },
  });

  const shelters: Shelter[] = data?.data || [];

  const handleUseDistrictCenter = () => {
    const center = DISTRICT_CENTERS[registerForm.district];
    if (!center) return;
    setRegisterForm(prev => ({
      ...prev,
      latitude: String(center.lat),
      longitude: String(center.lng),
    }));
  };

  const handleSubmitRegister = () => {
    setFormError('');

    // Validate required fields
    if (!registerForm.name.trim()) {
      setFormError('Shelter name is required');
      return;
    }
    if (!registerForm.address.trim()) {
      setFormError('Address is required');
      return;
    }
    if (!registerForm.district) {
      setFormError('District is required');
      return;
    }
    const capacityNum = parseInt(registerForm.capacity);
    if (!registerForm.capacity || isNaN(capacityNum) || capacityNum <= 0) {
      setFormError('Capacity must be a positive number');
      return;
    }

    const lat = registerForm.latitude ? parseFloat(registerForm.latitude) : undefined;
    const lng = registerForm.longitude ? parseFloat(registerForm.longitude) : undefined;
    createMutation.mutate({
      name: registerForm.name.trim(),
      address: registerForm.address.trim(),
      district: registerForm.district,
      capacity: capacityNum,
      amenities: [],
      latitude: lat !== undefined && !isNaN(lat) ? lat : undefined,
      longitude: lng !== undefined && !isNaN(lng) ? lng : undefined,
    });
  };

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
            {formError && (
              <div className="col-span-2 bg-red-50 border border-red-200 text-red-600 px-3 py-2 rounded-lg text-sm">
                {formError}
              </div>
            )}
            {[{ key: 'name', label: 'Shelter Name', placeholder: 'e.g. Colombo Town Hall' },
              { key: 'address', label: 'Location / Address', placeholder: 'Full address' }].map(f => (
              <div key={f.key}>
                <label className="text-sm font-medium text-gray-700 mb-1 block">{f.label}</label>
                <input
                  value={registerForm[f.key as keyof typeof registerForm]}
                  onChange={e => setRegisterForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  placeholder={f.placeholder}
                  className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
            ))}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">District</label>
              <select
                value={registerForm.district}
                onChange={e => setRegisterForm(prev => ({ ...prev, district: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Select district</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Capacity (Pax)</label>
              <input
                type="number"
                value={registerForm.capacity}
                onChange={e => setRegisterForm(prev => ({ ...prev, capacity: e.target.value }))}
                placeholder="500"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Latitude */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Latitude <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                step="any"
                value={registerForm.latitude}
                onChange={e => setRegisterForm(prev => ({ ...prev, latitude: e.target.value }))}
                placeholder="e.g. 6.9271"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {/* Longitude */}
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Longitude <span className="text-gray-400 font-normal">(optional)</span>
              </label>
              <input
                type="number"
                step="any"
                value={registerForm.longitude}
                onChange={e => setRegisterForm(prev => ({ ...prev, longitude: e.target.value }))}
                placeholder="e.g. 79.8612"
                className="w-full border rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {/* Use District Center button */}
          <div className="mt-3 flex items-center gap-3">
            <button
              type="button"
              onClick={handleUseDistrictCenter}
              disabled={!registerForm.district}
              className={cn(
                'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                registerForm.district
                  ? 'border-gray-300 hover:bg-gray-100 text-gray-700'
                  : 'border-gray-200 text-gray-400 cursor-not-allowed'
              )}
              title={registerForm.district ? `Use center coordinates for ${registerForm.district}` : 'Select a district first'}
            >
              📌 Use District Center
              {registerForm.district && (
                <span className="ml-1 text-gray-400">({registerForm.district})</span>
              )}
            </button>
            {registerForm.latitude && registerForm.longitude && (
              <span className="text-xs text-green-600 font-medium">
                📍 {parseFloat(registerForm.latitude).toFixed(5)}, {parseFloat(registerForm.longitude).toFixed(5)}
              </span>
            )}
          </div>

          <button
            onClick={handleSubmitRegister}
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
                        <button onClick={() => occupancyMutation.mutate({ id: s.id, count: parseInt(newOccupancy) })} className="bg-gray-900 text-white text-xs px-2 py-1 rounded">Save</button>
                        <button onClick={() => { setUpdatingId(null); setOccupancyError(''); }} className="text-xs text-gray-500">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => { setUpdatingId(s.id); setNewOccupancy(String(s.currentOccupancy)); }} className="text-xs text-blue-600 hover:underline">Update Occupancy</button>
                    )}
                    {updatingId === s.id && occupancyError && <p className="text-red-500 text-xs mt-1">{occupancyError}</p>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

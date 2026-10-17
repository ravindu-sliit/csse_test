import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/shared/PageHeader';
import { HAZARD_TYPES, DISTRICTS, RIVER_BASINS, BROADCAST_CHANNELS, SEVERITY_CONFIG, DISTRICT_CENTERS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const schema = z.object({
  hazardType: z.string().min(1, 'Select a hazard type'),
  targetDistricts: z.array(z.string()).min(1, 'Select at least one district'),
  targetRiverBasin: z.string().optional(),
  severityLevel: z.string().min(1, 'Select severity level'),
  message: z.string().min(10).max(300),
  broadcastChannels: z.array(z.string()).min(1, 'Select at least one channel'),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  locationLabel: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function CreateWarningPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [charCount, setCharCount] = useState(0);
  const [locationExpanded, setLocationExpanded] = useState(false);
  const [latInput, setLatInput] = useState('');
  const [lngInput, setLngInput] = useState('');

  const { register, handleSubmit, control, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { targetDistricts: [], broadcastChannels: ['SMS_BLAST', 'PUSH_NOTIFICATION', 'TV_RADIO'] },
  });

  // Pre-fill form when navigated from a verified report
  useEffect(() => {
    const state = location.state as {
      fromReport?: boolean;
      reportId?: string;
      reportCode?: string;
      hazardType?: string;
      targetDistricts?: string[];
      latitude?: number;
      longitude?: number;
      locationLabel?: string;
      severityLevel?: string;
    } | null;

    if (!state?.fromReport) return;

    if (state.hazardType)       setValue('hazardType', state.hazardType);
    if (state.targetDistricts)  setValue('targetDistricts', state.targetDistricts);
    if (state.severityLevel)    setValue('severityLevel', state.severityLevel);
    if (state.locationLabel)    setValue('locationLabel', state.locationLabel);

    if (state.latitude !== undefined && state.longitude !== undefined) {
      setValue('latitude', state.latitude);
      setValue('longitude', state.longitude);
      setLatInput(String(state.latitude));
      setLngInput(String(state.longitude));
      setLocationExpanded(true);
    }
  }, [location.state, setValue]);

  const watchedDistricts = watch('targetDistricts');
  const watchedLat = watch('latitude');
  const watchedLng = watch('longitude');

  const hasValidCoords =
    watchedLat !== undefined &&
    watchedLng !== undefined &&
    !isNaN(watchedLat) &&
    !isNaN(watchedLng);

  const mapPreviewUrl = hasValidCoords
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${watchedLng - 0.1},${watchedLat - 0.1},${watchedLng + 0.1},${watchedLat + 0.1}&layer=mapnik&marker=${watchedLat},${watchedLng}`
    : null;

  const handleUseDistrictCenter = () => {
    const firstDistrict = (watchedDistricts || [])[0];
    if (!firstDistrict) return;
    const center = DISTRICT_CENTERS[firstDistrict];
    if (!center) return;
    setValue('latitude', center.lat);
    setValue('longitude', center.lng);
    setLatInput(String(center.lat));
    setLngInput(String(center.lng));
    if (!watch('locationLabel')) {
      setValue('locationLabel', `${firstDistrict} District Center`);
    }
  };

  const handleClearLocation = () => {
    setValue('latitude', undefined);
    setValue('longitude', undefined);
    setValue('locationLabel', '');
    setLatInput('');
    setLngInput('');
  };

  const onSubmit = (data: FormData) => {
    navigate('/officer/warnings/preview', {
      state: {
        ...data,
        latitude: data.latitude,
        longitude: data.longitude,
        locationLabel: data.locationLabel,
      },
    });
  };

  return (
    <div className="p-6">
      <PageHeader title="Create Hazard Warning" subtitle="Configure parameters for emergency broadcast distribution." />

      {/* Banner shown when pre-filled from a verified report */}
      {(location.state as { fromReport?: boolean } | null)?.fromReport && (
        <div className="mb-4 max-w-4xl flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <span className="text-amber-500 text-lg leading-none mt-0.5">⚠️</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">
              Pre-filled from Report{' '}
              {(location.state as { reportCode?: string } | null)?.reportCode && (
                <span className="font-mono">
                  #{(location.state as { reportCode: string }).reportCode}
                </span>
              )}
            </p>
            <p className="text-xs text-amber-600 mt-0.5">
              Hazard type, district, severity, and GPS coordinates have been imported. Review and adjust before proceeding.
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-xl border p-6 space-y-8 max-w-4xl">

        {/* Step 1: Hazard Classification */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs">1</span>
            Hazard Classification
          </h2>
          <Controller
            name="hazardType"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                {HAZARD_TYPES.map(h => (
                  <button
                    key={h.value}
                    type="button"
                    onClick={() => field.onChange(h.value.toUpperCase())}
                    className={cn(
                      'border rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                      field.value === h.value.toUpperCase()
                        ? 'bg-red-50 border-red-400 text-red-700'
                        : 'hover:bg-gray-50'
                    )}
                  >
                    {h.label}
                  </button>
                ))}
              </div>
            )}
          />
          {errors.hazardType && <p className="text-red-500 text-xs mt-1">{errors.hazardType.message}</p>}
        </div>

        {/* Step 2: Target Geography */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs">2</span>
            Target Geography
          </h2>
          <Controller
            name="targetDistricts"
            control={control}
            render={({ field }) => (
              <div className="flex flex-wrap gap-2 mb-3">
                {DISTRICTS.map(d => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => {
                      const current = field.value || [];
                      field.onChange(current.includes(d) ? current.filter(x => x !== d) : [...current, d]);
                    }}
                    className={cn(
                      'border rounded-full px-3 py-1 text-xs font-medium transition-colors',
                      (field.value || []).includes(d)
                        ? 'bg-gray-900 text-white border-gray-900'
                        : 'hover:bg-gray-100'
                    )}
                  >
                    {d} {(field.value || []).includes(d) ? '✓' : ''}
                  </button>
                ))}
              </div>
            )}
          />
          {errors.targetDistricts && <p className="text-red-500 text-xs mt-1">{errors.targetDistricts.message}</p>}
          <div>
            <label className="text-sm text-gray-500 mb-1 block">River Basin Focus (optional)</label>
            <select {...register('targetRiverBasin')} className="border rounded-lg px-3 py-2 text-sm w-full max-w-sm">
              <option value="">Select river basin...</option>
              {RIVER_BASINS.map(rb => <option key={rb} value={rb}>{rb}</option>)}
            </select>
          </div>
        </div>

        {/* Step 2.5: Specific Location (Optional) */}
        <div className="border rounded-xl overflow-hidden">
          {/* Collapsible header */}
          <button
            type="button"
            onClick={() => setLocationExpanded(prev => !prev)}
            className="w-full flex items-center justify-between px-5 py-3 bg-gray-50 hover:bg-gray-100 transition-colors"
          >
            <span className="text-base font-semibold flex items-center gap-2">
              <span className="w-6 h-6 bg-gray-300 text-gray-700 rounded-full flex items-center justify-center text-xs font-bold">
                ⊕
              </span>
              Specific Location
              <span className="text-xs font-normal text-gray-400 ml-1">(Optional)</span>
              {hasValidCoords && (
                <span className="text-xs font-normal text-green-600 bg-green-50 border border-green-200 rounded-full px-2 py-0.5 ml-1">
                  📍 Set
                </span>
              )}
            </span>
            <svg
              className={cn('w-4 h-4 text-gray-500 transition-transform', locationExpanded ? 'rotate-180' : '')}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {locationExpanded && (
            <div className="p-5 space-y-4">
              <p className="text-xs text-gray-500">
                Pinpoint a specific incident location within the targeted districts. This helps field teams and responders
                identify the exact area of concern.
              </p>

              {/* Location label */}
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">Location Description</label>
                <input
                  {...register('locationLabel')}
                  type="text"
                  placeholder="e.g. Near Ratnapura Bridge, Kelani River bank overflowing..."
                  className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-300"
                />
              </div>

              {/* Latitude / Longitude inputs */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Latitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 6.6828"
                    value={latInput}
                    onChange={e => {
                      setLatInput(e.target.value);
                      const parsed = parseFloat(e.target.value);
                      setValue('latitude', isNaN(parsed) ? undefined : parsed);
                    }}
                    className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Longitude</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="e.g. 80.3992"
                    value={lngInput}
                    onChange={e => {
                      setLngInput(e.target.value);
                      const parsed = parseFloat(e.target.value);
                      setValue('longitude', isNaN(parsed) ? undefined : parsed);
                    }}
                    className="border rounded-lg px-3 py-2 text-sm w-full focus:outline-none focus:ring-2 focus:ring-gray-300"
                  />
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleUseDistrictCenter}
                  disabled={!watchedDistricts?.length}
                  className={cn(
                    'text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors',
                    watchedDistricts?.length
                      ? 'border-gray-300 hover:bg-gray-100 text-gray-700'
                      : 'border-gray-200 text-gray-400 cursor-not-allowed'
                  )}
                  title={watchedDistricts?.length ? `Use center of ${watchedDistricts[0]}` : 'Select a district first'}
                >
                  📌 Use District Center
                  {watchedDistricts?.length > 0 && (
                    <span className="ml-1 text-gray-400">({watchedDistricts[0]})</span>
                  )}
                </button>
                {hasValidCoords && (
                  <button
                    type="button"
                    onClick={handleClearLocation}
                    className="text-xs text-red-500 hover:text-red-700 underline"
                  >
                    Clear location
                  </button>
                )}
              </div>

              {/* Map preview */}
              {hasValidCoords && mapPreviewUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border">
                  <div className="bg-gray-50 px-3 py-1.5 border-b flex items-center justify-between">
                    <span className="text-xs text-gray-500 font-medium">Map Preview</span>
                    <span className="text-xs text-gray-400 font-mono">
                      {watchedLat?.toFixed(5)}, {watchedLng?.toFixed(5)}
                    </span>
                  </div>
                  <iframe
                    title="Location preview"
                    src={mapPreviewUrl}
                    className="w-full h-48 border-0"
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin"
                  />
                </div>
              )}

              {/* No-map fallback when coords entered but map not loaded yet */}
              {hasValidCoords && !mapPreviewUrl && (
                <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border">
                  📍 Location set: {watchedLat?.toFixed(5)}, {watchedLng?.toFixed(5)}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Step 3: Severity */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs">3</span>
            Severity & Alert Protocol
          </h2>
          <Controller
            name="severityLevel"
            control={control}
            render={({ field }) => (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => field.onChange(key.toUpperCase())}
                    className={cn(
                      'border-2 rounded-lg px-4 py-3 text-sm font-semibold transition-all',
                      field.value === key.toUpperCase() ? cfg.bg + ' ' + cfg.text + ' ' + cfg.border : 'hover:bg-gray-50'
                    )}
                  >
                    {cfg.label}
                  </button>
                ))}
              </div>
            )}
          />
          {errors.severityLevel && <p className="text-red-500 text-xs mt-1">{errors.severityLevel.message}</p>}
        </div>

        {/* Step 4: Message */}
        <div>
          <h2 className="text-base font-semibold mb-3 flex items-center gap-2">
            <span className="w-6 h-6 bg-gray-900 text-white rounded-full flex items-center justify-center text-xs">4</span>
            Broadcast Notification Copy
          </h2>
          <textarea
            {...register('message', { onChange: e => setCharCount(e.target.value.length) })}
            rows={4}
            placeholder="EMERGENCY RED ALERT: ..."
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-300 resize-none"
          />
          <div className="flex justify-between mt-1">
            {errors.message && <p className="text-red-500 text-xs">{errors.message.message}</p>}
            <p className="text-xs text-gray-400 ml-auto">{charCount} / 300 Characters</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <button type="button" onClick={() => navigate('/officer/warnings')} className="text-sm text-gray-500 hover:text-gray-700">
            Cancel & Reset
          </button>
          <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-lg text-sm">
            Proceed to Warning Preview →
          </button>
        </div>
      </form>
    </div>
  );
}

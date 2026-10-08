import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/shared/PageHeader';
import { HAZARD_TYPES, DISTRICTS, RIVER_BASINS, BROADCAST_CHANNELS, SEVERITY_CONFIG } from '@/lib/constants';
import { cn } from '@/lib/utils';

const schema = z.object({
  hazardType: z.string().min(1, 'Select a hazard type'),
  targetDistricts: z.array(z.string()).min(1, 'Select at least one district'),
  targetRiverBasin: z.string().optional(),
  severityLevel: z.string().min(1, 'Select severity level'),
  message: z.string().min(10).max(300),
  broadcastChannels: z.array(z.string()).min(1, 'Select at least one channel'),
});
type FormData = z.infer<typeof schema>;

export function CreateWarningPage() {
  const navigate = useNavigate();
  const [charCount, setCharCount] = useState(0);

  const { register, handleSubmit, control, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { targetDistricts: [], broadcastChannels: ['SMS_BLAST', 'PUSH_NOTIFICATION', 'TV_RADIO'] },
  });

  const onSubmit = (data: FormData) => {
    navigate('/officer/warnings/preview', { state: data });
  };

  return (
    <div className="p-6">
      <PageHeader title="Create Hazard Warning" subtitle="Configure parameters for emergency broadcast distribution." />

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
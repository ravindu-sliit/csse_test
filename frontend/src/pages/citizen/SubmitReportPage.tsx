import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { MapPin, Camera, X } from 'lucide-react';
import { submitReportApi, uploadPhotosApi } from '@/api/reports.api';
import { useGeolocation } from '@/hooks/useGeolocation';
import { HAZARD_TYPES, DISTRICTS } from '@/lib/constants';
import { cn } from '@/lib/utils';

const schema = z.object({
  hazardType: z.string().min(1, 'Select hazard type'),
  description: z.string().min(20, 'Description must be at least 20 characters'),
  district: z.string().min(1, 'District is required'),
  locationLabel: z.string().optional(),
});
type FormData = z.infer<typeof schema>;

export function SubmitReportPage() {
  const navigate = useNavigate();
  const { location, error: gpsError, isLoading: gpsLoading, requestLocation } = useGeolocation();
  const [selectedType, setSelectedType] = useState('');
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { register, handleSubmit, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const valid = files.filter(f => f.size <= 5 * 1024 * 1024);
    const newPhotos = [...photos, ...valid].slice(0, 3);
    setPhotos(newPhotos);
    setPhotoPreviews(newPhotos.map(f => URL.createObjectURL(f)));
  };

  const removePhoto = (index: number) => {
    setPhotos(p => p.filter((_, i) => i !== index));
    setPhotoPreviews(p => p.filter((_, i) => i !== index));
  };

  const onSubmit = async (data: FormData) => {
    if (!selectedType) { setError('Please select a hazard type'); return; }
    const lat = location?.lat ?? 6.9271;
    const lng = location?.lng ?? 79.8612;

    setIsSubmitting(true);
    setError('');
    try {
      let photoUrls: string[] = [];
      if (photos.length > 0) {
        photoUrls = await uploadPhotosApi(photos);
      }

      const report = await submitReportApi({
        hazardType: selectedType,
        description: data.description,
        photoUrls,
        gpsLatitude: lat,
        gpsLongitude: lng,
        district: data.district,
        locationLabel: data.locationLabel,
      });

      navigate('/citizen/report/submitted', { state: { report } });
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message;
      setError(msg || 'Failed to submit report. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-4">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs text-gray-400 uppercase">Submit Hazard Report</span>
        <span className="text-xs text-amber-500 font-medium">Step 2 of 3</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-1 mb-4">
        <div className="bg-amber-500 h-1 rounded-full" style={{ width: '66%' }} />
      </div>

      <h1 className="text-xl font-bold mb-1">Identify & Position Incident</h1>
      <p className="text-gray-500 text-sm mb-5">Please provide accurate field observations for real-time triage.</p>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg p-3 mb-4">{error}</div>}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Hazard Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Hazard Classification</label>
          <div className="flex flex-wrap gap-2">
            {HAZARD_TYPES.map(h => (
              <button
                key={h.value}
                type="button"
                onClick={() => { setSelectedType(h.value.toUpperCase()); setValue('hazardType', h.value.toUpperCase()); }}
                className={cn(
                  'border rounded-full px-3 py-1.5 text-sm transition-colors min-w-fit',
                  selectedType === h.value.toUpperCase() ? 'bg-amber-500 text-white border-amber-500' : 'hover:bg-gray-100'
                )}
              >
                {h.label}
              </button>
            ))}
          </div>
          {errors.hazardType && <p className="text-red-500 text-xs mt-1">{errors.hazardType.message}</p>}
        </div>

        {/* District */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
          <select {...register('district')} className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400">
            <option value="">Select district...</option>
            {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
          {errors.district && <p className="text-red-500 text-xs mt-1">{errors.district.message}</p>}
        </div>

        {/* GPS */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label className="text-sm font-medium text-gray-700">GPS Location (Auto-detected)</label>
            <button type="button" onClick={requestLocation} className="text-xs text-blue-600 hover:underline">Refresh GPS</button>
          </div>
          {gpsLoading ? (
            <div className="border rounded-lg p-3 bg-gray-50 text-sm text-gray-500">Detecting location...</div>
          ) : location ? (
            <div className="border rounded-lg p-3 bg-gray-50">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-green-600" />
                <span className="text-sm font-mono text-gray-700">Lat: {location.lat.toFixed(4)}, Lon: {location.lng.toFixed(4)}</span>
              </div>
            </div>
          ) : (
            <div className="border rounded-lg p-3 bg-amber-50 text-sm text-amber-700">
              {gpsError || 'GPS unavailable. Location will use district centre.'}
            </div>
          )}
        </div>

        {/* Photos */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Add Photos (Up to 3)</label>
          <div className="flex gap-2 flex-wrap">
            {photoPreviews.map((src, i) => (
              <div key={i} className="relative w-20 h-20">
                <img src={src} alt={`Photo ${i + 1}`} className="w-20 h-20 object-cover rounded-lg border" />
                <button type="button" onClick={() => removePhoto(i)} className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {photos.length < 3 && (
              <button type="button" onClick={() => fileInputRef.current?.click()} className="w-20 h-20 border-2 border-dashed rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-gray-50">
                <Camera className="w-5 h-5 text-gray-400" />
                <span className="text-xs text-gray-400">Capture</span>
              </button>
            )}
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" multiple onChange={handlePhotoSelect} className="hidden" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Observation Notes</label>
          <textarea
            {...register('description')}
            rows={4}
            className="w-full border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none min-h-24"
            placeholder="Describe what you observed..."
          />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
        </div>

        <button type="submit" disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-4 rounded-xl text-base disabled:opacity-50">
          {isSubmitting ? 'Transmitting...' : 'Transmit Verified Report to DMC'}
        </button>
      </form>
    </div>
  );
}
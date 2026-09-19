import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { generateReportApi, fetchReportHistory } from '@/api/analytics.api';
import { PageHeader } from '@/components/shared/PageHeader';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { DISTRICTS } from '@/lib/constants';
import { formatDate } from '@/lib/utils';

const TEMPLATES = [
  { id: 'incident_summary', label: 'Incident Summary Report', desc: 'Brief of warning dispatch and reach' },
  { id: 'resource_allocation', label: 'Resource Allocation Audit', desc: 'Warehouses dispatched and inventory logs' },
  { id: 'shelter_occupancy', label: 'Safe Camps Occupancy', desc: 'Detailed capacity ratios per Safe House' },
  { id: 'full_national_log', label: 'Full National Disaster Log', desc: 'Combined analytical report for ministerial audit' },
];

export function ReportBuilderPage() {
  const queryClient = useQueryClient();
  const [selectedTemplate, setSelectedTemplate] = useState('incident_summary');
  const [selectedDistricts, setSelectedDistricts] = useState<string[]>([]);
  const [format] = useState('CSV');

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['report-history'],
    queryFn: fetchReportHistory,
  });

  const generateMutation = useMutation({
    mutationFn: generateReportApi,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['report-history'] }),
  });

  return (
    <div className="p-6">
      <PageHeader title="Automated Report Builder" subtitle="Configure custom disaster logs, audit exports, and schedule recurrent briefings." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        {/* Template selection */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-3">1. Choose Template</h2>
          <div className="space-y-2">
            {TEMPLATES.map(t => (
              <div
                key={t.id}
                onClick={() => setSelectedTemplate(t.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-colors ${
                  selectedTemplate === t.id ? 'bg-blue-50 border-blue-400' : 'hover:bg-gray-50'
                }`}
              >
                <p className={`font-medium text-sm ${selectedTemplate === t.id ? 'text-blue-700' : ''}`}>{t.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{t.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Scope config */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-3">2. Configure Scope</h2>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Districts to include</p>
          <div className="grid grid-cols-2 gap-1 mb-4">
            {DISTRICTS.slice(0, 8).map(d => (
              <label key={d} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input type="checkbox" checked={selectedDistricts.includes(d)} onChange={e => setSelectedDistricts(e.target.checked ? [...selectedDistricts, d] : selectedDistricts.filter(x => x !== d))} className="w-3 h-3" />
                {d}
              </label>
            ))}
          </div>
          <p className="text-xs font-semibold text-gray-400 uppercase mb-2">Output format</p>
          <div className="flex gap-2 mb-4">
            <span className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">CSV (.csv)</span>
            <span className="border px-3 py-1.5 rounded-lg text-xs font-medium text-gray-400">PDF (coming soon)</span>
          </div>
          {generateMutation.isError && <p className="text-red-500 text-xs mb-2">Generation failed. Try again.</p>}
          {generateMutation.isSuccess && <p className="text-green-600 text-xs mb-2">Report generated! Check export logs below.</p>}
          <button
            onClick={() => generateMutation.mutate({ templateId: selectedTemplate, title: TEMPLATES.find(t => t.id === selectedTemplate)?.label || 'Report', districts: selectedDistricts, format })}
            disabled={generateMutation.isPending}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Generating...' : 'Generate Document'}
          </button>
        </div>

        {/* Preview placeholder */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-3">Document Preview</h2>
          <div className="space-y-2">
            <div className="h-3 bg-amber-300 rounded w-3/4" />
            <div className="h-2 bg-gray-200 rounded" />
            <div className="h-2 bg-gray-200 rounded w-5/6" />
            <div className="h-2 bg-gray-200 rounded w-4/6" />
            <div className="h-16 bg-gray-100 rounded mt-4" />
            <div className="h-2 bg-gray-200 rounded" />
            <div className="h-2 bg-gray-200 rounded w-3/4" />
          </div>
          <p className="text-xs text-gray-400 text-center mt-4">{TEMPLATES.find(t => t.id === selectedTemplate)?.label}</p>
        </div>
      </div>

      {/* Export logs */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50"><h2 className="font-semibold text-sm">Recent Export Logs</h2></div>
        {historyLoading ? <LoadingSpinner size="sm" /> : !history || (history as unknown[]).length === 0 ? (
          <div className="p-8 text-center"><p className="text-gray-400 text-sm">No reports generated yet.</p></div>
        ) : (
          <table className="w-full">
            <thead><tr className="border-b">{['Document File Name', 'Format', 'Generated Date', 'Actions'].map(h => <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase px-4 py-3">{h}</th>)}</tr></thead>
            <tbody className="divide-y">
              {(history as { id: string; reportTitle: string; exportFormat: string; generatedAt: string; fileUrl: string }[]).map(r => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium">{r.reportTitle}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{r.exportFormat} Document</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(r.generatedAt)}</td>
                  <td className="px-4 py-3">
                    <a href={r.fileUrl} download target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline font-medium">Download</a>
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
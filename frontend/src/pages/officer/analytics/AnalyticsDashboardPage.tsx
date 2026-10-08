import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { Download, FileText, Loader2, Trash2, X } from 'lucide-react';
import { fetchAnalyticsOverview, fetchCompletedReportEvents, fetchReportHistory, previewAnalyticsReport, generateAnalyticsReport, downloadAnalyticsReport, deleteAnalyticsReport, type AnalyticsReportFilters } from '@/api/analytics.api';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAuthStore } from '@/stores/authStore';
import { useNotificationStore } from '@/stores/notificationStore';

const DONUT_COLOURS = ['#16a34a', '#dc2626', '#d97706'];
const DISTRICTS = ['Ampara', 'Anuradhapura', 'Badulla', 'Batticaloa', 'Colombo', 'Galle', 'Gampaha', 'Hambantota', 'Jaffna', 'Kalutara', 'Kandy', 'Kegalle', 'Kilinochchi', 'Kurunegala', 'Mannar', 'Matale', 'Matara', 'Monaragala', 'Mullaitivu', 'Nuwara Eliya', 'Polonnaruwa', 'Puttalam', 'Ratnapura', 'Trincomalee', 'Vavuniya'];
const CATEGORIES = ['Alerts', 'Citizens Reached', 'Shelter Occupancy', 'Resource Distribution'];
type Preview = { event: { description: string; type: string }; filters: AnalyticsReportFilters; kpis: { totalWarnings: number; citizensReached: number; peopleSheltered: number; resourcesDispatched: number }; categories: { category: string; rows: { category: string; metric: string; value: string }[] }[]; hasData: boolean };

function dateInput(value: string) {
  return value ? new Date(value).toISOString().slice(0, 10) : '';
}

function ReportModal({ onClose, onGenerated }: { onClose: () => void; onGenerated: () => void }) {
  const { addToast } = useNotificationStore();
  const { data: events = [] } = useQuery({ queryKey: ['analytics-report-events'], queryFn: fetchCompletedReportEvents });
  const [step, setStep] = useState<1 | 2>(1);
  const [format, setFormat] = useState<'CSV' | 'PDF'>('CSV');
  const [eventId, setEventId] = useState('');
  const [districts, setDistricts] = useState<string[]>([]);
  const [categories, setCategories] = useState<string[]>(CATEGORIES);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const selectedEvent = events.find(event => event.id === eventId);
  const valid = Boolean(eventId && districts.length && startDate && endDate && new Date(endDate) > new Date(startDate));

  const selectEvent = (id: string) => {
    setEventId(id);
    const event = events.find(item => item.id === id);
    if (event) {
      setStartDate(dateInput(event.startTime));
      setEndDate(dateInput(event.endTime));
    }
  };
  const reset = () => { setEventId(''); setDistricts([]); setCategories(CATEGORIES); setStartDate(''); setEndDate(''); setPreview(null); setStep(1); };
  const toggleDistrict = (district: string) => setDistricts(current => current.includes(district) ? current.filter(item => item !== district) : [...current, district]);
  const toggleCategory = (category: string) => setCategories(current => current.includes(category) ? current.filter(item => item !== category) : [...current, category]);
  const filters: AnalyticsReportFilters = { eventId, districts, startDate, endDate, categories };

  const showPreview = async () => {
    if (!valid) return;
    setLoading(true);
    try { setPreview(await previewAnalyticsReport(filters)); setStep(2); } catch { addToast('Unable to load report preview.', 'error'); } finally { setLoading(false); }
  };
  const generate = async () => {
    setLoading(true);
    try {
      const result = await generateAnalyticsReport(filters, format);
      const generatedAt = new Date();
      const download = async () => {
        const url = await downloadAnalyticsReport(result.reportId);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = `disaster-analysis-${generatedAt.toISOString().replace(/[:.]/g, '-')}.${format.toLowerCase()}`;
        anchor.click();
        URL.revokeObjectURL(url);
      };
      addToast(`Report generated successfully at ${generatedAt.toLocaleString()}.`, 'success', { label: 'Download', onClick: () => { void download(); } });
      onGenerated();
      onClose();
    } catch { addToast('Unable to generate the report.', 'error'); } finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-6 py-4">
          <div><h2 className="text-lg font-semibold">Generate Disaster Analysis Report</h2><p className="text-xs text-gray-500">1. Filters <span className="mx-2">→</span> 2. Preview</p></div>
          <button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        {step === 1 ? (
          <div className="space-y-5 p-6">
            <label className="block text-sm font-medium">Disaster event
              <select value={eventId} onChange={event => selectEvent(event.target.value)} className="mt-1 w-full rounded-lg border p-2">
                <option value="">Select a completed hazard event</option>
                {events.map(event => <option key={event.id} value={event.id}>{event.description} · {event.type} · {dateInput(event.startTime)}</option>)}
              </select>
            </label>
            <div><p className="mb-2 text-sm font-medium">Districts</p><label className="mb-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={districts.length === DISTRICTS.length} onChange={event => setDistricts(event.target.checked ? [...DISTRICTS] : [])} /> Select all</label><div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{DISTRICTS.map(district => <label key={district} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={districts.includes(district)} onChange={() => toggleDistrict(district)} /> {district}</label>)}</div></div>
            <div className="grid gap-4 sm:grid-cols-2"><label className="text-sm font-medium">Start date<input type="date" value={startDate} onChange={event => setStartDate(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label><label className="text-sm font-medium">End date<input type="date" value={endDate} onChange={event => setEndDate(event.target.value)} className="mt-1 block w-full rounded-lg border p-2" /></label></div>
            <div><p className="mb-2 text-sm font-medium">Categories</p><div className="grid grid-cols-2 gap-2">{CATEGORIES.map(category => <label key={category} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={categories.includes(category)} onChange={() => toggleCategory(category)} /> {category}</label>)}</div></div>
            <div><p className="mb-2 text-sm font-medium">Output format</p><div className="flex gap-4 text-sm">{(['CSV', 'PDF'] as const).map(item => <label key={item} className="flex items-center gap-2"><input type="radio" checked={format === item} onChange={() => setFormat(item)} /> {item}</label>)}</div></div>
            {!valid && <p className="text-xs text-red-600">Select an event and at least one district. The end date must be after the start date.</p>}
            <div className="flex justify-end gap-2 border-t pt-4"><button onClick={reset} className="rounded-lg border px-4 py-2 text-sm">Reset</button><button onClick={onClose} className="rounded-lg border px-4 py-2 text-sm">Cancel</button><button disabled={!valid || loading} onClick={() => void showPreview()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Preview Report'}</button></div>
          </div>
        ) : (
          <div className="space-y-5 p-6">
            <div className="rounded-lg bg-gray-50 p-4 text-sm"><p><b>Event:</b> {selectedEvent?.description} ({selectedEvent?.type})</p><p><b>Districts:</b> {districts.join(', ')}</p><p><b>Date range:</b> {startDate} to {endDate}</p><p><b>Categories:</b> {categories.join(', ')} · <b>Format:</b> {format}</p></div>
            {!preview?.hasData ? <div className="rounded-lg border border-amber-200 bg-amber-50 p-6 text-center text-sm">Insufficient data for selected filters</div> : <><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{[['Warnings', preview?.kpis.totalWarnings], ['Citizens reached', preview?.kpis.citizensReached], ['People sheltered', preview?.kpis.peopleSheltered], ['Resources dispatched', preview?.kpis.resourcesDispatched]].map(([label, value]) => <div key={String(label)} className="rounded-lg border p-3"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold">{Number(value).toLocaleString()}</p></div>)}</div>{preview?.categories.map(category => category.rows.length > 0 && <div key={category.category}><h3 className="mb-2 font-semibold">{category.category}</h3><div className="overflow-x-auto rounded-lg border"><table className="w-full text-left text-sm"><tbody>{category.rows.map(row => <tr key={`${row.category}-${row.metric}`} className="border-b last:border-0"><td className="p-2">{row.metric}</td><td className="p-2">{row.value}</td></tr>)}</tbody></table></div></div>)}</>}
            <div className="flex justify-between border-t pt-4"><button onClick={() => setStep(1)} className="rounded-lg border px-4 py-2 text-sm">Back to Filters</button><button disabled={!preview?.hasData || loading} onClick={() => void generate()} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Generate Report'}</button></div>
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalyticsDashboardPage() {
  const [period, setPeriod] = useState('30d');
  const [reportOpen, setReportOpen] = useState(false);
  const { user } = useAuthStore();
  const reportHistory = useQuery({ queryKey: ['analytics-reports'], queryFn: fetchReportHistory });
  const { data, isLoading } = useQuery({ queryKey: ['analytics', 'overview', period], queryFn: () => fetchAnalyticsOverview(period) });
  if (isLoading) return <LoadingSpinner fullScreen />;
  const removeReport = async (id: string) => {
    if (!window.confirm('Delete this generated report and its downloaded file?')) return;
    try {
      await deleteAnalyticsReport(id);
      await reportHistory.refetch();
    } catch {
      window.alert('Unable to delete the report. Please try again.');
    }
  };
  const d = data as { kpis: { totalWarningsIssued: number; warningsThisMonth: number; citizenReportsReceived: number; verificationRate: number; peopleEvacuated: number; activeShelters: number; shelterCapacityPercent: number; avgResponseTimeMinutes: number }; warningsByHazardType: { type: string; label: string; count: number }[]; verificationBreakdown: { approved: number; rejected: number; pending: number }; citizenReportsTrend: { date: string; count: number }[] } | undefined;
  const donutData = d ? [{ name: 'Approved', value: d.verificationBreakdown.approved }, { name: 'Rejected', value: d.verificationBreakdown.rejected }, { name: 'Pending', value: d.verificationBreakdown.pending }] : [];
  return (
    <div className="p-6">
      <div className="mb-6 flex items-center justify-between"><div><h1 className="text-2xl font-bold">Disaster Analytics Dashboard</h1><p className="mt-1 text-sm text-gray-500">National crisis intelligence, historical warnings, and operational telemetry logs.</p></div><div className="flex gap-2">{['7d', '30d', '90d'].map(p => <button key={p} onClick={() => setPeriod(p)} className={`rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${period === p ? 'border-gray-900 bg-gray-900 text-white' : 'hover:bg-gray-50'}`}>{p}</button>)}{user?.role === 'DMC_OFFICER' && <button onClick={() => setReportOpen(true)} className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"><FileText className="h-4 w-4" /> Generate Report</button>}</div></div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5"><StatCard label="Total Warnings Issued" value={d?.kpis.totalWarningsIssued ?? 0} dot="red" subtext={`+${d?.kpis.warningsThisMonth ?? 0} This Month`} /><StatCard label="Citizen Reports Received" value={d?.kpis.citizenReportsReceived ?? 0} dot="orange" subtext={`${Math.round((d?.kpis.verificationRate || 0) * 100)}% Verified`} /><StatCard label="People Evacuated" value={(d?.kpis.peopleEvacuated ?? 0).toLocaleString()} dot="green" /><StatCard label="Avg. Response Time" value={`${d?.kpis.avgResponseTimeMinutes ?? 0} min`} dot="blue" /><StatCard label="Active Shelters" value={d?.kpis.activeShelters ?? 0} dot="purple" subtext={`Capacity: ${d?.kpis.shelterCapacityPercent ?? 0}%`} /></div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3"><div className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Warnings by Hazard Type</h2><ResponsiveContainer width="100%" height={180}><BarChart layout="vertical" data={d?.warningsByHazardType || []}><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11 }} /><Tooltip /><Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} /></BarChart></ResponsiveContainer></div><div className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Verification Rate</h2><ResponsiveContainer width="100%" height={180}><PieChart><Pie data={donutData} innerRadius={50} outerRadius={75} dataKey="value">{donutData.map((_, index) => <Cell key={index} fill={DONUT_COLOURS[index]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div className="mt-2 flex justify-center gap-3">{donutData.map((item, i) => <div key={item.name} className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: DONUT_COLOURS[i] }} /><span className="text-xs text-gray-600">{item.name} ({item.value})</span></div>)}</div></div><div className="rounded-xl border bg-white p-5"><h2 className="mb-4 font-semibold">Citizen Reports Trend</h2><ResponsiveContainer width="100%" height={180}><BarChart data={d?.citizenReportsTrend || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} /><YAxis tick={{ fontSize: 10 }} /><Tooltip /><Bar dataKey="count" fill="#93c5fd" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
      {user?.role === 'DMC_OFFICER' && <div className="mt-6 rounded-xl border bg-white p-5"><h2 className="mb-3 font-semibold">Recent Export Logs</h2><div className="overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr className="border-b text-gray-500"><th className="p-2">Report</th><th className="p-2">Event</th><th className="p-2">Districts</th><th className="p-2">Format</th><th className="p-2">Generated</th><th className="p-2">Actions</th></tr></thead><tbody>{(reportHistory.data || []).map(report => <tr key={report.id} className="border-b last:border-0"><td className="p-2">{report.reportTitle}</td><td className="p-2">{report.hazard?.description || '—'}</td><td className="p-2">{report.district}</td><td className="p-2">{report.exportFormat}</td><td className="p-2">{new Date(report.generatedAt).toLocaleString()}</td><td className="p-2"><div className="flex items-center gap-3"><button onClick={() => void downloadAnalyticsReport(report.id).then(url => { const a = document.createElement('a'); a.href = url; a.download = `${report.reportTitle}-${new Date(report.generatedAt).toISOString().replace(/[:.]/g, '-')}.${report.exportFormat.toLowerCase()}`; a.click(); URL.revokeObjectURL(url); })} className="flex items-center gap-1 text-blue-600 hover:underline"><Download className="h-4 w-4" /> Download</button><button onClick={() => void removeReport(report.id)} className="flex items-center gap-1 text-red-600 hover:text-red-700 hover:underline"><Trash2 className="h-4 w-4" /> Delete</button></div></td></tr>)}</tbody></table></div></div>}
      {reportOpen && <ReportModal onClose={() => setReportOpen(false)} onGenerated={() => { void reportHistory.refetch(); }} />}
    </div>
  );
}

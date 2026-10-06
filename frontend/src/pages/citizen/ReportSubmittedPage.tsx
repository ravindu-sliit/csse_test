import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { StatusBadge } from '@/components/shared/StatusBadge';

export function ReportSubmittedPage() {
  const { state } = useLocation() as { state: { report?: { reportCode?: string; district?: string } } };
  const navigate = useNavigate();
  const report = state?.report;

  return (
    <div className="p-6 flex flex-col items-center text-center">
      <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mb-5 mt-4">
        <CheckCircle className="w-10 h-10 text-green-600" />
      </div>

      <h1 className="text-xl font-bold mb-2">Report Successfully Logged</h1>
      <p className="text-gray-500 text-sm mb-6">Your field report has been routed to the emergency verification queue.</p>

      <div className="w-full bg-white border rounded-xl p-4 mb-4 space-y-3 text-left">
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">Report Reference ID</span>
          <span className="text-sm font-semibold font-mono">{report?.reportCode || 'RPT-PENDING'}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-500">Live Review Status</span>
          <StatusBadge status="pending_verification" />
        </div>
        <div className="flex justify-between">
          <span className="text-sm text-gray-500">District Zone</span>
          <span className="text-sm font-medium">{report?.district || '—'}</span>
        </div>
      </div>

      <div className="w-full bg-blue-50 border border-blue-100 rounded-xl p-3 mb-6 flex items-center gap-3">
        <span className="text-blue-500 text-lg">📡</span>
        <p className="text-sm text-blue-700">Report stored and synced with main DMC servers.</p>
      </div>

      <button onClick={() => navigate('/citizen/my-reports')} className="w-full bg-gray-900 text-white font-semibold py-3 rounded-xl text-sm mb-3">
        Track Report Status
      </button>
      <button onClick={() => navigate('/citizen/report')} className="w-full border font-semibold py-3 rounded-xl text-sm">
        Submit Another Observation
      </button>
    </div>
  );
}
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, FileText, Phone, Home, ChevronRight } from 'lucide-react';
import { fetchWarnings } from '@/api/warnings.api';
import { fetchMyReports } from '@/api/reports.api';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { useAuth } from '@/hooks/useAuth';
import { timeAgo } from '@/lib/utils';
import type { SeverityLevel } from '@/types';

export function CitizenHomePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const { data: warningsData } = useQuery({
    queryKey: ['warnings', { status: 'active', district: user?.district }],
    queryFn: () => fetchWarnings({ status: 'active' }),
  });

  const activeWarnings = (warningsData?.data || []).filter(w =>
    !user?.district || w.targetDistricts.includes(user.district || '')
  );

  const topWarning = activeWarnings[0];

  return (
    <div className="max-w-screen-sm mx-auto px-4 py-4 space-y-4">
      {/* Active Warning Banner */}
      {topWarning && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div className="min-w-0 flex-1">
              <p className="text-red-700 font-semibold text-sm break-words">
                {topWarning.hazardType.replace('_', ' ')} WARNING: {topWarning.targetDistricts.join(', ')}
              </p>
              <p className="text-red-600 text-xs mt-1 line-clamp-2 break-words">{topWarning.message}</p>
            </div>
          </div>
        </div>
      )}

      {/* Emergency Dispatch Tools */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Emergency Dispatch Tools</h2>
        <button
          onClick={() => navigate('/citizen/report')}
          className="w-full bg-gray-900 text-white rounded-xl p-4 flex items-center justify-between"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 bg-amber-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xl">+</span>
            </div>
            <div className="text-left min-w-0">
              <p className="font-semibold">Report Hazard</p>
              <p className="text-gray-400 text-xs">Submit photos & GPS coordinates directly to DMC</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </button>

        <div className="grid grid-cols-3 gap-2 mt-3">
          {[
            { icon: FileText, label: 'My Reports', path: '/citizen/my-reports' },
            { icon: Phone, label: 'Contacts', path: '/citizen/alerts' },
            { icon: Home, label: 'Shelters', path: '/citizen/map' },
          ].map(({ icon: Icon, label, path }) => (
            <button key={label} onClick={() => navigate(path)} className="bg-white border rounded-xl p-3 flex flex-col items-center gap-2 hover:bg-gray-50">
              <Icon className="w-5 h-5 text-gray-600" />
              <span className="text-xs text-gray-700">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Recent Alerts near you</h2>
          <button onClick={() => navigate('/citizen/alerts')} className="text-xs text-amber-600">See All</button>
        </div>
        {activeWarnings.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No active alerts in your area.</p>
        ) : (
          <div className="space-y-2">
            {activeWarnings.slice(0, 5).map(w => (
              <div key={w.id} className="bg-white border rounded-xl p-3 flex items-center gap-3 overflow-hidden">
                <SeverityBadge level={w.severityLevel.toLowerCase() as SeverityLevel} size="sm" />
                <div className="flex-1 min-w-0 overflow-hidden">
                  <p className="text-sm font-medium truncate">{w.hazardType.replace('_', ' ')} Alert</p>
                  <p className="text-xs text-gray-400 truncate">{w.targetDistricts.join(', ')} • {timeAgo(w.issuedTime)}</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
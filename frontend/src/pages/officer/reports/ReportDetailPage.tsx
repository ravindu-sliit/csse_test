import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { fetchReport, verifyReportApi, rejectReportApi } from '@/api/reports.api';
import { SeverityBadge } from '@/components/shared/SeverityBadge';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';
import { PageHeader } from '@/components/shared/PageHeader';
import { formatDate } from '@/lib/utils';
import { SEVERITY_CONFIG } from '@/lib/constants';
import type { SeverityLevel } from '@/types';

export function ReportDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedSeverity, setSelectedSeverity] = useState('');
  const [officerNotes, setOfficerNotes] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { data: report, isLoading } = useQuery({
    queryKey: ['reports', id],
    queryFn: () => fetchReport(id!),
    enabled: !!id,
  });

  const verifyMutation = useMutation({
    mutationFn: () => verifyReportApi(id!, { severityEstimate: selectedSeverity, officerNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate('/officer/reports');
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectReportApi(id!, rejectReason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reports'] });
      navigate('/officer/reports');
    },
  });

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (!report) return <div className="p-6"><p className="text-gray-500">Report not found.</p></div>;

  const citizen = report.citizen as { user?: { name?: string; phoneNumber?: string } } | undefined;

  return (
    <div className="p-6">
      <PageHeader
        title={`Verify Field Report: ${report.reportCode}`}
        subtitle="Disaster Management Center — Incident Command Verification Queue"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Report Details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold">Citizen Submission Details</h2>
              <StatusBadge status={report.status.toLowerCase()} label="UNVERIFIED HIGH SEVERITY" />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">Reporter Profile</p>
                <p className="font-medium">{citizen?.user?.name || 'Unknown'}</p>
                <p className="text-sm text-gray-500">{citizen?.user?.phoneNumber || 'N/A'} • Registered Citizen</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase mb-1">GPS Location</p>
                <p className="font-mono text-sm">{report.gpsLatitude.toFixed(4)} N, {report.gpsLongitude.toFixed(4)} E</p>
                <p className="text-sm text-gray-500">{report.locationLabel || report.district}</p>
              </div>
            </div>

            <div className="mb-4">
              <p className="text-xs text-gray-400 uppercase mb-1">User Description</p>
              <p className="text-sm text-gray-700">&quot;{report.description}&quot;</p>
            </div>

            {report.photoUrls && report.photoUrls.length > 0 && (
              <div>
                <p className="text-xs text-gray-400 uppercase mb-2">Submitted Photo Proof</p>
                <div className="flex gap-3 flex-wrap">
                  {report.photoUrls.map((url: string, i: number) => (
                    <img key={i} src={url} alt={`Evidence ${i + 1}`} className="w-32 h-24 object-cover rounded-lg border" />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* History trail */}
          <div className="bg-white border rounded-xl p-5">
            <h2 className="font-semibold mb-3">Verification History Trail</h2>
            <div className="space-y-2">
              <div className="flex gap-3">
                <span className="w-2 h-2 bg-yellow-400 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">{formatDate(report.submittedAt)} — Reported via Citizen Mobile Client</p>
              </div>
              <div className="flex gap-3">
                <span className="w-2 h-2 bg-blue-400 rounded-full mt-1.5 flex-shrink-0" />
                <p className="text-sm text-gray-600">Routed to DMC Verification Desk</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Command Actions */}
        <div className="bg-white border rounded-xl p-5 h-fit">
          <h2 className="font-semibold mb-4">DMC Command Actions</h2>

          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase mb-2">Confirm Severity Level</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(SEVERITY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setSelectedSeverity(key.toUpperCase())}
                  className={`border rounded-lg px-2 py-1.5 text-xs font-semibold transition-colors ${
                    selectedSeverity === key.toUpperCase() ? cfg.bg + ' ' + cfg.text : 'hover:bg-gray-50'
                  }`}
                >
                  {cfg.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-xs text-gray-400 uppercase mb-2">Officer Assessment Notes</p>
            <textarea
              value={officerNotes}
              onChange={e => setOfficerNotes(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-gray-300"
              placeholder="Enter your assessment..."
            />
          </div>

          {!showRejectDialog ? (
            <>
              <button
                onClick={() => verifyMutation.mutate()}
                disabled={verifyMutation.isPending}
                className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 rounded-lg text-sm mb-2 disabled:opacity-50"
              >
                {verifyMutation.isPending ? 'Approving...' : 'Approve & Create National Warning'}
              </button>
              <button
                onClick={() => setShowRejectDialog(true)}
                className="w-full border font-semibold py-2.5 rounded-lg text-sm hover:bg-gray-50"
              >
                Decline / Flag as Spurious
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <textarea
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                rows={2}
                className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                placeholder="Reason for rejection (optional)..."
              />
              <button onClick={() => rejectMutation.mutate()} disabled={rejectMutation.isPending} className="w-full bg-gray-900 text-white font-semibold py-2.5 rounded-lg text-sm disabled:opacity-50">
                {rejectMutation.isPending ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
              <button onClick={() => setShowRejectDialog(false)} className="w-full border py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50">Cancel</button>
            </div>
          )}

          {/* Create Warning from verified report */}
          {report.status === 'verified' && (
            <div className="mt-4 pt-4 border-t">
              <p className="text-xs text-gray-400 uppercase mb-2">Quick Actions</p>
              <button
                type="button"
                onClick={() =>
                  navigate('/officer/warnings/create', {
                    state: {
                      fromReport: true,
                      reportId: report.id,
                      reportCode: report.reportCode,
                      hazardType: report.hazardType.toUpperCase(),
                      targetDistricts: [report.district],
                      latitude: report.gpsLatitude,
                      longitude: report.gpsLongitude,
                      locationLabel: report.locationLabel || `Near ${report.district}`,
                      severityLevel: report.severityEstimate?.toUpperCase() || 'WARNING',
                    },
                  })
                }
                className="w-full bg-amber-500 hover:bg-amber-600 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
              >
                <span>⚠️</span>
                Create Warning from Report
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
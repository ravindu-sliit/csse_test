import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from '@/pages/auth/LoginPage';
import { RegisterPage } from '@/pages/auth/RegisterPage';
import { ProtectedRoute } from '@/router/ProtectedRoute';
import { OfficerLayout } from '@/components/layout/OfficerLayout';
import { CitizenLayout } from '@/components/layout/CitizenLayout';

// UC01 - Warning pages
import { DashboardPage } from '@/pages/officer/DashboardPage';
import { WarningsPage } from '@/pages/officer/warnings/WarningsPage';
import { CreateWarningPage } from '@/pages/officer/warnings/CreateWarningPage';
import { WarningPreviewPage } from '@/pages/officer/warnings/WarningPreviewPage';
import { BroadcastStatusPage } from '@/pages/officer/warnings/BroadcastStatusPage';

// UC02 - Report pages
import { CitizenHomePage } from '@/pages/citizen/CitizenHomePage';
import { SubmitReportPage } from '@/pages/citizen/SubmitReportPage';
import { ReportSubmittedPage } from '@/pages/citizen/ReportSubmittedPage';
import { MyReportsPage } from '@/pages/citizen/MyReportsPage';
import { ReportsPage } from '@/pages/officer/reports/ReportsPage';
import { ReportDetailPage } from '@/pages/officer/reports/ReportDetailPage';

// UC03 - Coordination pages
import { CoordinationDashboardPage } from '@/pages/officer/coordination/CoordinationDashboardPage';
import { SheltersPage } from '@/pages/officer/coordination/SheltersPage';
import { RescueDispatchPage } from '@/pages/officer/coordination/RescueDispatchPage';
import { SupplyChainPage } from '@/pages/officer/coordination/SupplyChainPage';
import { LiveOperationsPage } from '@/pages/officer/coordination/LiveOperationsPage';

// UC04 - Analytics pages
import { AnalyticsDashboardPage } from '@/pages/officer/analytics/AnalyticsDashboardPage';
import { ShelterAnalyticsPage } from '@/pages/officer/analytics/ShelterAnalyticsPage';
import { ResourceAnalyticsPage } from '@/pages/officer/analytics/ResourceAnalyticsPage';
import { AlertTimelinePage } from '@/pages/officer/analytics/AlertTimelinePage';
import { ReportBuilderPage } from '@/pages/officer/analytics/ReportBuilderPage';

// Citizen pages
import { AlertsPage } from '@/pages/citizen/AlertsPage';
import { SheltersMapPage } from '@/pages/citizen/SheltersMapPage';
import { ProfilePage } from '@/pages/citizen/ProfilePage';

// Shared components
import { EmptyState } from '@/components/shared/EmptyState';
import { ToastContainer } from '@/components/shared/Toast';
import { useNotificationStore } from '@/stores/notificationStore';

export default function App() {
  const { toasts, dismissToast } = useNotificationStore();

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/unauthorized" element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-2xl font-bold text-gray-800">Access Denied</h1>
                <p className="text-gray-500 mt-2">You don't have permission to view this page.</p>
              </div>
            </div>
          } />

          {/* Officer Portal */}
          <Route element={
            <ProtectedRoute allowedRoles={['DMC_OFFICER', 'DMC_DUTY_OFFICER', 'DISTRICT_OFFICER', 'RESCUE_TEAM']} />
          }>
            <Route path="/officer" element={<OfficerLayout />}>
              <Route index element={<Navigate to="/officer/dashboard" replace />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="warnings" element={<WarningsPage />} />
              <Route path="warnings/create" element={<CreateWarningPage />} />
              <Route path="warnings/preview" element={<WarningPreviewPage />} />
              <Route path="warnings/:id/status" element={<BroadcastStatusPage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="coordination" element={<CoordinationDashboardPage />} />
              <Route path="shelters" element={<SheltersPage />} />
              <Route path="coordination/rescue" element={<RescueDispatchPage />} />
              <Route path="coordination/supply" element={<SupplyChainPage />} />
              <Route path="coordination/live-ops" element={<LiveOperationsPage />} />
              <Route path="analytics" element={<AnalyticsDashboardPage />} />
              <Route path="analytics/shelters" element={<ShelterAnalyticsPage />} />
              <Route path="analytics/resources" element={<ResourceAnalyticsPage />} />
              <Route path="analytics/timeline" element={<AlertTimelinePage />} />
              <Route path="analytics/report-builder" element={<ReportBuilderPage />} />
              <Route path="settings" element={<EmptyState title="Settings" description="Settings coming soon." icon="⚙️" />} />
            </Route>
          </Route>

          {/* Citizen Portal */}
          <Route element={<ProtectedRoute allowedRoles={['CITIZEN', 'VOLUNTEER']} />}>
            <Route path="/citizen" element={<CitizenLayout />}>
              <Route index element={<Navigate to="/citizen/home" replace />} />
              <Route path="home" element={<CitizenHomePage />} />
              <Route path="alerts" element={<AlertsPage />} />
              <Route path="report" element={<SubmitReportPage />} />
              <Route path="report/submitted" element={<ReportSubmittedPage />} />
              <Route path="my-reports" element={<MyReportsPage />} />
              <Route path="map" element={<SheltersMapPage />} />
              <Route path="profile" element={<ProfilePage />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
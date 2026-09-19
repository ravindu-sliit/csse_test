import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { fetchAnalyticsOverview } from '@/api/analytics.api';
import { StatCard } from '@/components/shared/StatCard';
import { LoadingSpinner } from '@/components/shared/LoadingSpinner';

const DONUT_COLOURS = ['#16a34a', '#dc2626', '#d97706'];

export function AnalyticsDashboardPage() {
  const [period, setPeriod] = useState('30d');
  const { data, isLoading } = useQuery({
    queryKey: ['analytics', 'overview', period],
    queryFn: () => fetchAnalyticsOverview(period),
  });

  if (isLoading) return <LoadingSpinner fullScreen />;

  const d = data as {
    kpis: { totalWarningsIssued: number; warningsThisMonth: number; citizenReportsReceived: number; verificationRate: number; peopleEvacuated: number; activeShelters: number; shelterCapacityPercent: number; avgResponseTimeMinutes: number };
    warningsByHazardType: { type: string; label: string; count: number }[];
    verificationBreakdown: { approved: number; rejected: number; pending: number };
    citizenReportsTrend: { date: string; count: number }[];
  } | undefined;

  const donutData = d ? [
    { name: 'Approved', value: d.verificationBreakdown.approved },
    { name: 'Rejected', value: d.verificationBreakdown.rejected },
    { name: 'Pending', value: d.verificationBreakdown.pending },
  ] : [];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Disaster Analytics Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">National crisis intelligence, historical warnings, and operational telemetry logs.</p>
        </div>
        <div className="flex gap-2">
          {['7d', '30d', '90d'].map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                period === p ? 'bg-gray-900 text-white border-gray-900' : 'hover:bg-gray-50'
              }`}>{p}
            </button>
          ))}
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <StatCard label="Total Warnings Issued" value={d?.kpis.totalWarningsIssued ?? 0} dot="red" subtext={`+${d?.kpis.warningsThisMonth ?? 0} This Month`} />
        <StatCard label="Citizen Reports Received" value={d?.kpis.citizenReportsReceived ?? 0} dot="orange" subtext={`${Math.round((d?.kpis.verificationRate || 0) * 100)}% Verified`} />
        <StatCard label="People Evacuated" value={(d?.kpis.peopleEvacuated ?? 0).toLocaleString()} dot="green" />
        <StatCard label="Avg. Response Time" value={`${d?.kpis.avgResponseTimeMinutes ?? 0} min`} dot="blue" />
        <StatCard label="Active Shelters" value={d?.kpis.activeShelters ?? 0} dot="purple" subtext={`Capacity: ${d?.kpis.shelterCapacityPercent ?? 0}%`} />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Warnings by type */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Warnings by Hazard Type</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart layout="vertical" data={d?.warningsByHazardType || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" />
              <YAxis dataKey="label" type="category" width={80} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#2563eb" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Verification donut */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Verification Rate</h2>
          <ResponsiveContainer width="100%" height={180}>
            <PieChart>
              <Pie data={donutData} innerRadius={50} outerRadius={75} dataKey="value">
                {donutData.map((_: unknown, index: number) => <Cell key={index} fill={DONUT_COLOURS[index]} />)}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-3 justify-center mt-2">
            {donutData.map((item: { name: string; value: number }, i: number) => (
              <div key={item.name} className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full" style={{ background: DONUT_COLOURS[i] }} />
                <span className="text-xs text-gray-600">{item.name} ({item.value})</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trend */}
        <div className="bg-white rounded-xl border p-5">
          <h2 className="font-semibold mb-4">Citizen Reports Trend</h2>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={d?.citizenReportsTrend || []}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" tick={{ fontSize: 9 }} tickFormatter={v => v.slice(5)} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="count" fill="#93c5fd" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
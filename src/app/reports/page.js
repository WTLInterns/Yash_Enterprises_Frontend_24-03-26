'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, FileText, Download } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { backendApi } from '@/services/api';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState('attendance');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [teamId, setTeamId] = useState('');
  const [month, setMonth] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleExportAttendance() {
    if (!from || !to) {
      alert('Please select From and To dates');
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ from, to, teamId: teamId || '', format: 'csv' });
      const url = `http://localhost:8080/api/reports/attendance?${params}`;
      window.open(url, '_blank');
    } catch (err) {
      console.error('Failed to export attendance', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleExportSalary() {
    if (!month) {
      alert('Please select a month');
      return;
    }
    try {
      setLoading(true);
      const params = new URLSearchParams({ month, teamId: teamId || '' });
      const url = `http://localhost:8080/api/reports/salary?${params}`;
      const res = await fetch(url);
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `salary-report-${month}.csv`;
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error('Failed to export salary', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout>
      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 px-6 pt-4">
        <Tab active={activeTab === 'attendance'} icon={<CalendarDays size={16} />} label="Attendance Report" onClick={() => setActiveTab('attendance')} />
        <Tab active={activeTab === 'salary'} icon={<FileText size={16} />} label="Salary Report" onClick={() => setActiveTab('salary')} />
      </div>

      {/* Content */}
      <div className="bg-gray-100 min-h-screen p-6">
        {activeTab === 'attendance' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Attendance Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team (optional)</label>
                <input
                  type="text"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="Team ID"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleExportAttendance}
                  disabled={loading}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Download size={16} />
                  {loading ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'salary' && (
          <div className="bg-white rounded-xl shadow-sm p-6 space-y-6">
            <h2 className="text-lg font-semibold text-gray-900">Salary Report</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Month</label>
                <input
                  type="text"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  placeholder="e.g. 2025-12"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Team (optional)</label>
                <input
                  type="text"
                  value={teamId}
                  onChange={(e) => setTeamId(e.target.value)}
                  placeholder="Team ID"
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={handleExportSalary}
                  disabled={loading}
                  className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                  <Download size={16} />
                  {loading ? 'Exporting...' : 'Export CSV'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function Tab({ label, icon, active = false, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 pb-3 text-sm font-medium ${
        active
          ? 'border-b-2 border-blue-600 text-blue-600'
          : 'text-gray-600 hover:text-gray-900'
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

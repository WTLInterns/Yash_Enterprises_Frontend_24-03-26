'use client';

import { useState, useEffect } from 'react';
import { CalendarDays, FileText, ClipboardList, Plus, Check, X, Eye } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { backendApi } from '@/services/api';
import { getTabSafeItem } from '@/utils/tabSafeStorage';

export default function LeaveOverviewPage() {
  const [activeTab, setActiveTab] = useState('requests');
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(false);

  function getRoleBasedLeavesPath() {
    console.log('=== LEAVE DEBUG START ===');

    const roleFromSession = sessionStorage.getItem('user_role');
    const roleFromLocal = localStorage.getItem('user_role');

    console.log('Role (sessionStorage):', roleFromSession);
    console.log('Role (localStorage):', roleFromLocal);

    const roleFromTabSafe = typeof getTabSafeItem === 'function' ? getTabSafeItem('user_role') : null;
    console.log('Role (tab-safe):', roleFromTabSafe);

    const role = (roleFromTabSafe || roleFromSession || roleFromLocal || '').toUpperCase();

    console.log('Final Role Used:', role);

    if (!role) {
      console.warn('⚠️ Role is EMPTY → defaulting to /leaves/my');
    }

    let endpoint = '';
    if (role === 'ADMIN') endpoint = '/leaves/all';
    else if (role === 'MANAGER') endpoint = '/leaves/manager';
    else if (role === 'TL') endpoint = '/leaves/tl';
    else endpoint = '/leaves/my';

    console.log('Calling API:', endpoint);
    return endpoint;
  }

  async function loadLeaves() {
    try {
      setLoading(true);
      const path = getRoleBasedLeavesPath();
      const data = await backendApi.get(path);
      setLeaves(data || []);
    } catch (err) {
      console.error('Failed to load leaves', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'requests') {
      let isMounted = true;

      (async () => {
        try {
          setLoading(true);
          const path = getRoleBasedLeavesPath();
          const res = await backendApi.get(path);
          const payload = res && typeof res === 'object' && 'data' in res ? res.data : res;
          console.log('API RESPONSE:', payload);
          if (!isMounted) return;
          setLeaves(payload || []);
          console.log('=== LEAVE DEBUG END ===');
        } catch (err) {
          console.error('Failed to load leaves', err);
        } finally {
          if (isMounted) setLoading(false);
        }
      })();

      return () => { isMounted = false; };
    }
  }, [activeTab]);

  async function handleApprove(id) {
    try {
      await backendApi.put(`/leaves/${id}/approve`);
      await loadLeaves();
    } catch (err) {
      console.error('Failed to approve', err);
    }
  }

  async function handleReject(id) {
    try {
      await backendApi.put(`/leaves/${id}/reject`);
      await loadLeaves();
    } catch (err) {
      console.error('Failed to reject', err);
    }
  }

  return (
    <DashboardLayout>
      {/* Tabs */}
      <div className="flex gap-6 border-b border-gray-200 px-6 pt-4">
        <Tab active={activeTab === 'requests'} icon={<FileText size={16} />} label="Leaves Requests" onClick={() => setActiveTab('requests')} />
        
      </div>

      {/* Content */}
      <div className="bg-gray-100 min-h-screen p-6">
        {/* Leave Requests Tab */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Leave Requests</h2>
            {loading ? (
              <p className="text-sm text-gray-500">Loading...</p>
            ) : leaves.length === 0 ? (
              <p className="text-sm text-gray-500">No leave requests found.</p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="p-3 text-left">Employee</th>
                    <th className="p-3 text-left">Type</th>
                    <th className="p-3 text-left">From</th>
                    <th className="p-3 text-left">To</th>
                    <th className="p-3 text-left">Reason</th>
                    <th className="p-3 text-left">Status</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map(l => (
                    <tr key={l.id} className="border-b hover:bg-gray-50">
                      <td className="p-3">{l.employeeName || '-'}</td>
                      <td className="p-3">{l.leaveType || '-'}</td>
                      <td className="p-3">{l.fromDate || '-'}</td>
                      <td className="p-3">{l.toDate || '-'}</td>
                      <td className="p-3">{l.reason || '-'}</td>
                      <td className="p-3">
                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                          l.status === 'APPROVED' ? 'bg-green-100 text-green-700' :
                          l.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                          'bg-yellow-100 text-yellow-700'
                        }`}>
                          {l.status}
                        </span>
                      </td>
                      <td className="p-3">
                        <div className="flex justify-end gap-2">
                          {l.status === 'PENDING' && (
                            <>
                              <button onClick={() => handleApprove(l.id)} className="p-1 rounded bg-green-100 text-green-600 hover:bg-green-200">
                                <Check size={16} />
                              </button>
                              <button onClick={() => handleReject(l.id)} className="p-1 rounded bg-red-100 text-red-600 hover:bg-red-200">
                                <X size={16} />
                              </button>
                            </>
                          )}
                          <button className="p-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200">
                            <Eye size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

/* ------------------ Components ------------------ */

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

function Card({ title, filterLabel, filterValue }) {
  return (
    <div className="bg-white rounded-xl shadow-sm p-6 min-h-[420px] relative">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <h2 className="text-sm font-semibold text-gray-900">
          {title}
        </h2>

        <div className="flex flex-col text-xs text-gray-500">
          <span className="mb-1">{filterLabel}</span>
          <button className="flex items-center justify-between gap-2 border rounded-lg px-3 py-2 text-sm text-gray-700 bg-white">
            {filterValue}
            <CalendarDays size={16} className="text-gray-500" />
          </button>
        </div>
      </div>

      {/* Empty State */}
      <div className="flex items-center justify-center h-[300px]">
        <p className="text-sm text-gray-400 font-medium">
          No Data Available
        </p>
      </div>

    </div>
  );
}
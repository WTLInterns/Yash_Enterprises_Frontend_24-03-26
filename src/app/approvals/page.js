"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { backendApi } from "@/services/api";
import { getAuthUser } from "@/utils/authUser";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function LeadApprovalsPage() {
  const user = getAuthUser();
  const router = useRouter();

  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });
  const addToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };

  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState({});

  // ── Format date safely (uses requestedAt, not createdAt) ──────────────────
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // ── Fetch approvals (no extra deal/client calls — backend already has all data) ──
  const fetchApprovals = async () => {
    try {
      setLoading(true);
      const data = await backendApi.get("/approvals/pending");
      setApprovals(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
      addToast("Failed to fetch approvals", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchApprovals();
    // Auto-refresh every 60s (not 30s to avoid hammering)
    const interval = setInterval(fetchApprovals, 60000);
    return () => clearInterval(interval);
  }, []);

  // ── Approve ──────────────────────────────────────────────────────────────
  const handleApprove = async (approvalId, dealName) => {
    if (!confirm(`Approve transfer of deal "${dealName}" to Accounts?`)) return;
    try {
      setProcessing(prev => ({ ...prev, [approvalId]: 'approve' }));
      const response = await backendApi.post(`/approvals/${approvalId}/approve`, {});
      addToast(response?.message || `Deal "${dealName}" approved!`, 'success');
      await fetchApprovals();

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('crm-updates');
        bc.postMessage({ type: 'DEAL_APPROVAL_COMPLETED', approvalId, status: 'APPROVED' });
        bc.close();
      }
    } catch (error) {
      console.error("Failed to approve:", error);
      addToast("Failed to approve request", "error");
    } finally {
      setProcessing(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  // ── Reject ───────────────────────────────────────────────────────────────
  const handleReject = async (approvalId, dealName) => {
    const reason = prompt("Please provide reason for rejection:");
    if (!reason?.trim()) return;
    try {
      setProcessing(prev => ({ ...prev, [approvalId]: 'reject' }));
      const response = await backendApi.post(`/approvals/${approvalId}/reject`, { reason });
      addToast(response?.message || `Deal "${dealName}" rejected.`, 'info');
      await fetchApprovals();

      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel('crm-updates');
        bc.postMessage({ type: 'DEAL_APPROVAL_COMPLETED', approvalId, status: 'REJECTED' });
        bc.close();
      }
    } catch (error) {
      console.error("Failed to reject:", error);
      addToast("Failed to reject request", "error");
    } finally {
      setProcessing(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  // ── Role guard ───────────────────────────────────────────────────────────
  if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h1>
            <p className="text-slate-600">Only MANAGER and ADMIN can access this page.</p>
            <p className="text-sm text-slate-500 mt-2">Your role: {user?.role || 'Unknown'}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-slate-50">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center py-6">
              <div>
                <h1 className="text-2xl font-bold text-slate-900">Lead Approvals</h1>
                <p className="text-sm text-slate-600 mt-1">
                  Manage deal transfer requests to Accounts department
                </p>
              </div>
              <button
                onClick={fetchApprovals}
                disabled={loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
              <p className="mt-2 text-slate-600">Loading approvals...</p>
            </div>
          ) : approvals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">📋</div>
              <h3 className="text-lg font-medium text-slate-900 mb-2">No Pending Approvals</h3>
              <p className="text-slate-600">All closure requests have been processed.</p>
            </div>
          ) : (
            <div className="bg-white shadow-sm rounded-lg overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200">
                  <thead className="bg-slate-50">
                    <tr>
                      {["Deal ID", "Deal", "Client", "From Dept", "Current Stage", "Value", "Requested By", "Requested At", "Actions"].map((h, i) => (
                        <th
                          key={h}
                          className={`px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider ${
                            i < 3 ? 'sticky bg-slate-50 z-10' : ''
                          } ${i === 0 ? 'left-0' : i === 1 ? 'left-[80px]' : i === 2 ? 'left-[200px]' : ''}`}
                          style={i < 3 ? { position: 'sticky', backgroundColor: 'rgb(248 250 252)' } : {}}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {approvals.map((approval) => (
                      <tr key={approval.id} className="hover:bg-slate-50">
                        {/* Deal ID - frozen */}
                        <td className="px-6 py-4 whitespace-nowrap sticky left-0 bg-white z-10" style={{ position: 'sticky', left: 0, backgroundColor: 'white' }}>
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                            {approval.dealCode || approval.fromDepartment && approval.dealId ? `${approval.fromDepartment}${approval.dealId}` : `#${approval.dealId}`}
                          </span>
                        </td>

                        {/* Deal - frozen */}
                        <td className="px-6 py-4 whitespace-nowrap sticky bg-white z-10" style={{ position: 'sticky', left: '80px', backgroundColor: 'white' }}>
                          <div className="text-sm font-medium text-slate-900">
                            {approval.dealName || `Deal #${approval.dealId}`}
                          </div>
                        </td>

                        {/* Client - frozen + clickable */}
                        <td className="px-6 py-4 whitespace-nowrap sticky bg-white z-10 border-r border-slate-200" style={{ position: 'sticky', left: '200px', backgroundColor: 'white' }}>
                          <div
                            className="text-sm font-medium text-indigo-600 cursor-pointer hover:underline"
                            onClick={() => approval.clientId && router.push(`/customers/${approval.clientId}`)}
                          >
                            {approval.clientName || (approval.clientId ? `Client #${approval.clientId}` : "—")}
                          </div>
                        </td>

                        {/* From Dept */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                            {approval.fromDepartment || approval.currentDepartment || "—"}
                          </span>
                        </td>

                        {/* Current Stage */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-slate-100 text-slate-700">
                            {approval.currentStage || "—"}
                          </span>
                        </td>

                        {/* Value */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-slate-900">
                          {approval.valueAmount
                            ? `₹${Number(approval.valueAmount).toLocaleString("en-IN")}` 
                            : "—"}
                        </td>

                        {/* Requested By — dynamic from backend */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {approval.requestedByName || `User #${approval.requestedByUserId}` || "—"}
                          </div>
                        </td>

                        {/* Requested At — uses requestedAt (not createdAt!) */}
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {formatDate(approval.requestedAt)}
                        </td>

                        {/* Actions */}
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-2">
                            <button
                              onClick={() => handleApprove(approval.id, approval.dealName)}
                              disabled={!!processing[approval.id]}
                              className="px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              {processing[approval.id] === 'approve' ? "..." : "✅ Approve"}
                            </button>
                            <button
                              onClick={() => handleReject(approval.id, approval.dealName)}
                              disabled={!!processing[approval.id]}
                              className="px-3 py-1.5 bg-rose-600 text-white text-xs font-semibold rounded-lg hover:bg-rose-700 disabled:opacity-50 transition-colors"
                            >
                              {processing[approval.id] === 'reject' ? "..." : "❌ Reject"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 ${
          toast.type === 'success' ? 'bg-emerald-500' :
          toast.type === 'error'   ? 'bg-rose-500'    :
          toast.type === 'warning' ? 'bg-amber-500'   : 'bg-blue-500'
        }`}>
          {toast.message}
        </div>
      )}
    </DashboardLayout>
  );
}

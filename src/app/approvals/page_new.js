"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { backendApi } from "@/services/api";
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";
import {
  CheckCircle2, XCircle, Clock, Building, User, DollarSign,
  MapPin, Calendar, ChevronRight, RefreshCw, AlertCircle,
  TrendingUp, Filter, Eye, X
} from "lucide-react";

export default function ApprovalsPage() {
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();

  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending"); // pending | all
  const [selectedApproval, setSelectedApproval] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const addToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: "", type: "info" }), 4000);
  };

  const fetchApprovals = async () => {
    setLoading(true);
    try {
      const endpoint = activeTab === "pending" ? "/approvals/pending" : "/approvals/all";
      const data = await backendApi.get(endpoint);
      setApprovals(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to fetch approvals:", err);
      addToast("Failed to load approvals", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchApprovals(); }, [activeTab]);

  // Stats
  const stats = useMemo(() => {
    const all = approvals;
    return {
      pending:  all.filter(a => a.status === "PENDING").length,
      approved: all.filter(a => a.status === "APPROVED").length,
      rejected: all.filter(a => a.status === "REJECTED").length,
    };
  }, [approvals]);

  const handleApprove = async (approval) => {
    if (!confirm(`Approve transfer of deal "${approval.dealName}" to Accounts?`)) return;
    setActionLoading(true);
    try {
      await backendApi.post(`/approvals/${approval.id}/approve`, {});
      addToast(`✅ Deal "${approval.dealName}" approved and transferred to Accounts!`, "success");
      setShowDetailModal(false);
      setSelectedApproval(null);
      fetchApprovals();
      // Broadcast to other tabs
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("crm-updates");
        ch.postMessage({ type: "DEAL_APPROVAL_COMPLETED", approvalId: approval.id, status: "APPROVED" });
        ch.close();
      }
    } catch (err) {
      console.error("Approve failed:", err);
      const msg = err?.data?.message || err?.message || "Failed to approve";
      addToast(`Failed: ${msg}`, "error");
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (approval) => {
    if (!rejectReason.trim()) {
      addToast("Please enter a rejection reason", "warning");
      return;
    }
    setActionLoading(true);
    try {
      await backendApi.post(`/approvals/${approval.id}/reject`, { reason: rejectReason });
      addToast(`Deal "${approval.dealName}" request rejected.`, "info");
      setShowDetailModal(false);
      setShowRejectInput(false);
      setRejectReason("");
      setSelectedApproval(null);
      fetchApprovals();
      if (typeof BroadcastChannel !== "undefined") {
        const ch = new BroadcastChannel("crm-updates");
        ch.postMessage({ type: "DEAL_APPROVAL_COMPLETED", approvalId: approval.id, status: "REJECTED" });
        ch.close();
      }
    } catch (err) {
      console.error("Reject failed:", err);
      addToast("Failed to reject", "error");
    } finally {
      setActionLoading(false);
    }
  };

  const openDetail = (approval) => {
    setSelectedApproval(approval);
    setShowRejectInput(false);
    setRejectReason("");
    setShowDetailModal(true);
  };

  const statusBadge = (status) => {
    switch (status) {
      case "PENDING":  return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200"><Clock className="h-3 w-3" /> Pending</span>;
      case "APPROVED": return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200"><CheckCircle2 className="h-3 w-3" /> Approved</span>;
      case "REJECTED": return <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-50 text-rose-700 border border-rose-200"><XCircle className="h-3 w-3" /> Rejected</span>;
      default: return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit"
    });
  };

  const formatCurrency = (val) => {
    if (!val) return "-";
    return "₹" + Number(val).toLocaleString("en-IN");
  };

  return (
    <DashboardLayout
      header={{
        project: "Approvals",
        user: { name: userName, role: userRole },
        notifications: [],
      }}
    >
      {/* Toast */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-[200] px-5 py-3 rounded-xl shadow-xl text-white text-sm font-medium transition-all ${
          toast.type === "success" ? "bg-emerald-600" :
          toast.type === "error"   ? "bg-rose-600"    :
          toast.type === "warning" ? "bg-amber-500"   : "bg-blue-600"
        }`}>
          {toast.message}
        </div>
      )}

      <div className="space-y-5 p-1">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Deal Transfer Approvals</h1>
            <p className="text-sm text-slate-500 mt-0.5">Review and approve deal transfers to Accounts department</p>
          </div>
          <button onClick={fetchApprovals}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors shadow-sm">
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: "Pending",  count: stats.pending,  color: "bg-amber-50 border-amber-200 text-amber-700",   icon: <Clock className="h-5 w-5" /> },
            { label: "Approved", count: stats.approved, color: "bg-emerald-50 border-emerald-200 text-emerald-700", icon: <CheckCircle2 className="h-5 w-5" /> },
            { label: "Rejected", count: stats.rejected, color: "bg-rose-50 border-rose-200 text-rose-700",      icon: <XCircle className="h-5 w-5" /> },
          ].map(s => (
            <div key={s.label} className={`rounded-2xl border p-4 flex items-center gap-4 ${s.color}`}>
              <div className="opacity-70">{s.icon}</div>
              <div>
                <div className="text-2xl font-bold">{s.count}</div>
                <div className="text-xs font-medium opacity-75">{s.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-slate-200 pb-0">
          {[
            { key: "pending", label: "Pending Approvals" },
            { key: "all",     label: "All Requests" },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors ${
                activeTab === t.key
                  ? "bg-white border border-b-white border-slate-200 text-slate-900 -mb-px"
                  : "text-slate-500 hover:text-slate-700"
              }`}>
              {t.label}
              {t.key === "pending" && stats.pending > 0 && (
                <span className="ml-2 inline-flex items-center justify-center h-5 w-5 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                  {stats.pending}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Table */}
        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading approvals...</div>
        ) : approvals.length === 0 ? (
          <div className="text-center py-20 rounded-2xl border border-dashed border-slate-200 bg-slate-50">
            <CheckCircle2 className="h-12 w-12 text-slate-300 mx-auto mb-3" />
            <div className="text-slate-600 font-medium">
              {activeTab === "pending" ? "No pending approvals" : "No requests found"}
            </div>
            <p className="text-slate-400 text-sm mt-1">All clear! No deal transfers waiting for review.</p>
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <table className="min-w-full divide-y divide-slate-100">
              <thead className="bg-slate-50">
                <tr>
                  {["Deal Name", "Requested By", "From Dept", "Value", "Requested At", "Status", "Action"].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {approvals.map(approval => (
                  <tr key={approval.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-4">
                      <div className="font-medium text-slate-900 text-sm">{approval.dealName || `Deal #${approval.dealId}`}</div>
                      <div className="text-xs text-slate-400">ID: {approval.dealId}</div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-7 w-7 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 flex items-center justify-center text-white text-[10px] font-bold shrink-0">
                          {(approval.requestedByName || "?").slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <div className="text-sm font-medium text-slate-900">{approval.requestedByName || "-"}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                        {approval.fromDepartment || approval.currentDepartment || "-"}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm font-semibold text-slate-900">
                      {formatCurrency(approval.valueAmount)}
                    </td>
                    <td className="px-4 py-4 text-xs text-slate-500">
                      {formatDate(approval.requestedAt)}
                    </td>
                    <td className="px-4 py-4">
                      {statusBadge(approval.status)}
                    </td>
                    <td className="px-4 py-4">
                      <button onClick={() => openDetail(approval)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:border-indigo-300 hover:text-indigo-700 transition-colors">
                        <Eye className="h-3.5 w-3.5" /> View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedApproval && (
        <>
          <div className="fixed inset-0 z-[100] bg-black/50 backdrop-blur-sm"
            onClick={() => { setShowDetailModal(false); setShowRejectInput(false); setRejectReason(""); }} />
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>

              {/* Modal Header */}
              <div className={`px-6 py-4 flex items-center justify-between ${
                selectedApproval.status === "PENDING"  ? "bg-amber-50 border-b border-amber-200"  :
                selectedApproval.status === "APPROVED" ? "bg-emerald-50 border-b border-emerald-200" :
                "bg-rose-50 border-b border-rose-200"
              }`}>
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Deal Transfer Request</h2>
                  <p className="text-sm text-slate-500">Review details before approving or rejecting</p>
                </div>
                <div className="flex items-center gap-3">
                  {statusBadge(selectedApproval.status)}
                  <button onClick={() => { setShowDetailModal(false); setShowRejectInput(false); setRejectReason(""); }}
                    className="p-2 rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto max-h-[70vh] space-y-5">

                {/* Deal Info */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Deal Information</div>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={<Building className="h-4 w-4 text-indigo-500" />} label="Deal Name" value={selectedApproval.dealName || `Deal #${selectedApproval.dealId}`} />
                    <InfoRow icon={<DollarSign className="h-4 w-4 text-emerald-500" />} label="Deal Value" value={formatCurrency(selectedApproval.valueAmount)} />
                    <InfoRow icon={<TrendingUp className="h-4 w-4 text-blue-500" />} label="From Department" value={selectedApproval.fromDepartment || selectedApproval.currentDepartment || "-"} />
                    <InfoRow icon={<TrendingUp className="h-4 w-4 text-purple-500" />} label="Current Stage" value={selectedApproval.currentStage || "-"} />
                    <InfoRow icon={<ChevronRight className="h-4 w-4 text-orange-500" />} label="Transfer To" value="ACCOUNT / INVENTORY" />
                    <InfoRow icon={<Building className="h-4 w-4 text-slate-400" />} label="Deal ID" value={`#${selectedApproval.dealId}`} />
                  </div>
                </div>

                {/* Requester Info */}
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                  <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">Requested By</div>
                  <div className="grid grid-cols-2 gap-3">
                    <InfoRow icon={<User className="h-4 w-4 text-slate-500" />} label="Name" value={selectedApproval.requestedByName || "-"} />
                    <InfoRow icon={<Calendar className="h-4 w-4 text-slate-500" />} label="Requested At" value={formatDate(selectedApproval.requestedAt)} />
                  </div>
                </div>

                {/* Review Info (if reviewed) */}
                {selectedApproval.status !== "PENDING" && (
                  <div className={`rounded-xl border p-4 space-y-3 ${
                    selectedApproval.status === "APPROVED" ? "bg-emerald-50 border-emerald-200" : "bg-rose-50 border-rose-200"
                  }`}>
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
                      {selectedApproval.status === "APPROVED" ? "Approved By" : "Rejected By"}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <InfoRow icon={<User className="h-4 w-4 text-slate-500" />} label="Name" value={selectedApproval.reviewedByName || "-"} />
                      <InfoRow icon={<Calendar className="h-4 w-4 text-slate-500" />} label="Reviewed At" value={formatDate(selectedApproval.reviewedAt)} />
                      {selectedApproval.rejectionReason && (
                        <div className="col-span-2">
                          <div className="text-xs font-medium text-slate-500 mb-1">Rejection Reason</div>
                          <div className="text-sm text-rose-700 bg-rose-100 rounded-lg px-3 py-2">
                            {selectedApproval.rejectionReason}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* View Deal Button */}
                <Link href={`/customers/${selectedApproval.clientId}`}
                  className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors">
                  <Eye className="h-4 w-4" /> View Customer & Deal →
                </Link>

                {/* Reject reason input */}
                {showRejectInput && (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                    <label className="block text-sm font-medium text-rose-700 mb-2">Rejection Reason <span className="text-rose-500">*</span></label>
                    <textarea
                      value={rejectReason}
                      onChange={e => setRejectReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-lg border border-rose-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-rose-500 focus:outline-none resize-none"
                      placeholder="Enter reason for rejection..."
                      autoFocus
                    />
                  </div>
                )}
              </div>

              {/* Modal Footer — Actions */}
              <div className="px-6 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
                <button onClick={() => { setShowDetailModal(false); setShowRejectInput(false); setRejectReason(""); }}
                  className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50">
                  Close
                </button>

                {selectedApproval.status === "PENDING" && (
                  <div className="flex items-center gap-3">
                    {/* Reject flow */}
                    {!showRejectInput ? (
                      <button onClick={() => setShowRejectInput(true)}
                        className="inline-flex items-center gap-2 rounded-lg border border-rose-300 bg-white px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 transition-colors">
                        <XCircle className="h-4 w-4" /> Reject
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button onClick={() => { setShowRejectInput(false); setRejectReason(""); }}
                          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                          Cancel
                        </button>
                        <button onClick={() => handleReject(selectedApproval)} disabled={actionLoading || !rejectReason.trim()}
                          className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 transition-colors disabled:opacity-50">
                          {actionLoading ? "Rejecting..." : "Confirm Reject"}
                        </button>
                      </div>
                    )}

                    {/* Approve */}
                    {!showRejectInput && (
                      <button onClick={() => handleApprove(selectedApproval)} disabled={actionLoading}
                        className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-5 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 hover:translate-y-[1px] hover:shadow-lg transition-all disabled:opacity-50">
                        <CheckCircle2 className="h-4 w-4" />
                        {actionLoading ? "Approving..." : "Approve Transfer"}
                      </button>
                    )}
                  </div>
                )}
              </div>

            </div>
          </div>
        </>
      )}

    </DashboardLayout>
  );
}

// Helper component
function InfoRow({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="mt-0.5 shrink-0">{icon}</div>
      <div className="min-w-0">
        <div className="text-xs text-slate-500 font-medium">{label}</div>
        <div className="text-sm font-semibold text-slate-900 truncate">{value}</div>
      </div>
    </div>
  );
}

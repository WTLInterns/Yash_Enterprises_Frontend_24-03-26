"use client";

import { useState, useEffect } from "react";
import { backendApi } from "@/services/api";
import { getAuthUser } from "@/utils/authUser";
import DashboardLayout from "@/components/layout/DashboardLayout";

export default function LeadApprovalsPage() {
  const user = getAuthUser();
  
  // Custom toast notification system
  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });

  const addToast = (message, type = 'info') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);
  };
  
  const [approvals, setApprovals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const [processing, setProcessing] = useState({});

  // Fix hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Fetch pending approvals with enhanced data
  const fetchApprovals = async () => {
    if (!mounted) return;
    
    try {
      setLoading(true);
      const data = await backendApi.get("/approvals/pending");
      
      // Enhance approvals with deal and client details
      const enhancedApprovals = await Promise.all(
        (data || []).map(async (approval) => {
          try {
            // Fetch deal details to get amount and client info
            const dealResponse = await backendApi.get(`/deals/${approval.dealId}`);
            const deal = dealResponse;
            
            // Fetch client details
            const clientResponse = await backendApi.get(`/clients/${deal.clientId}`);
            const client = clientResponse;
            
            return {
              ...approval,
              deal,
              client,
              // Use deal value amount for display
              amount: deal.valueAmount || 0,
              clientName: client.name || `Client #${deal.clientId}`
            };
          } catch (err) {
            console.error("Failed to fetch details for approval:", approval.id, err);
            return {
              ...approval,
              amount: 0,
              clientName: `Client #${approval.dealId}`
            };
          }
        })
      );
      
      setApprovals(enhancedApprovals);
    } catch (error) {
      console.error("Failed to fetch approvals:", error);
      toast.error("Failed to fetch approvals");
    } finally {
      setLoading(false);
    }
  };

  // Fetch approvals on component mount
  useEffect(() => {
    if (mounted) {
      fetchApprovals();
    }
  }, [mounted]);

  // Auto-refresh approvals every 30 seconds
  useEffect(() => {
    if (!mounted) return;
    
    const interval = setInterval(() => {
      fetchApprovals();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [mounted]);

  // Handle approval
  const handleApprove = async (approvalId) => {
    try {
      setProcessing(prev => ({ ...prev, [approvalId]: 'approve' }));
      
      const response = await backendApi.post(`/approvals/${approvalId}/approve`);
      
      if (response.message) {
        addToast(response.message, 'success');
      }
      
      // Refresh approvals list
      await fetchApprovals();
      
      // 🎯 Broadcast approval to other tabs (especially customer detail page)
      if (typeof BroadcastChannel !== 'undefined') {
        const broadcastChannel = new BroadcastChannel('crm-updates');
        broadcastChannel.postMessage({
          type: 'DEAL_APPROVAL_COMPLETED',
          approvalId: approvalId,
          timestamp: new Date().toISOString()
        });
        broadcastChannel.close();
      }
      
    } catch (error) {
      console.error("Failed to approve:", error);
      addToast("Failed to approve request", 'error');
    } finally {
      setProcessing(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  // Handle rejection
  const handleReject = async (approvalId) => {
    try {
      const reason = prompt("Please provide reason for rejection:");
      if (!reason) return;
      
      setProcessing(prev => ({ ...prev, [approvalId]: 'reject' }));
      
      const response = await backendApi.post(`/approvals/${approvalId}/reject`, {
        reason: reason
      });
      
      if (response.message) {
        addToast(response.message, 'success');
      }
      
      // Refresh approvals list
      await fetchApprovals();
      
      // 🎯 Broadcast rejection to other tabs (especially customer detail page)
      if (typeof BroadcastChannel !== 'undefined') {
        const broadcastChannel = new BroadcastChannel('crm-updates');
        broadcastChannel.postMessage({
          type: 'DEAL_APPROVAL_COMPLETED',
          approvalId: approvalId,
          timestamp: new Date().toISOString()
        });
        broadcastChannel.close();
      }
      
    } catch (error) {
      console.error("Failed to reject:", error);
      addToast("Failed to reject request", 'error');
    } finally {
      setProcessing(prev => ({ ...prev, [approvalId]: null }));
    }
  };

  useEffect(() => {
    fetchApprovals();
  }, []);

  // Fix hydration mismatch - only render after mounted
  if (!mounted) {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-slate-600">Loading...</div>
        </div>
      </DashboardLayout>
    );
  }

  // Check if user is MANAGER role
  if (user?.role !== 'MANAGER' && user?.role !== 'ADMIN') {
    return (
      <DashboardLayout>
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h1>
            <p className="text-slate-600">Only MANAGER and ADMIN role users can access this page.</p>
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
                  Manage deal closure requests from ACCOUNT department
                </p>
              </div>
              <button
                onClick={fetchApprovals}
                disabled={!mounted || loading}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {!mounted ? "Loading..." : loading ? "Refreshing..." : "Refresh"}
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" suppressHydrationWarning>
          {!mounted ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              <p className="mt-2 text-slate-600">Loading...</p>
            </div>
          ) : loading ? (
            <div className="text-center py-12">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
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
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Deal
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Client
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Email
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Phone
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Requested By
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Stage
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Requested At
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-slate-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-slate-200">
                    {approvals.map((approval) => (
                      <tr key={approval.id} className="hover:bg-slate-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-slate-900">
                            {approval.deal?.name || approval.dealName || `Deal #${approval.dealId}`}
                          </div>
                          <div className="text-xs text-slate-500">
                            ID: {approval.dealId}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {approval.clientName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {approval.client?.email || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {approval.client?.phone || approval.client?.contactPhone || 'N/A'}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-slate-900">
                            {approval.requestedByName}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                            approval.requestedStage === 'CLOSE_WON' 
                              ? 'bg-green-100 text-green-800' 
                              : 'bg-red-100 text-red-800'
                          }`}>
                            {approval.requestedStage.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                          {new Date(approval.createdAt).toLocaleDateString()}
                          <br />
                          {new Date(approval.createdAt).toLocaleTimeString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            <button
                              onClick={() => handleApprove(approval.id)}
                              disabled={processing[approval.id] === 'approve'}
                              className="px-3 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 disabled:opacity-50"
                            >
                              {processing[approval.id] === 'approve' ? "..." : "Approve"}
                            </button>
                            <button
                              onClick={() => handleReject(approval.id)}
                              disabled={processing[approval.id] === 'reject'}
                              className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 disabled:opacity-50"
                            >
                              {processing[approval.id] === 'reject' ? "..." : "Reject"}
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
      
      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 ${
          toast.type === 'success' ? 'bg-green-500' :
          toast.type === 'error' ? 'bg-red-500' :
          toast.type === 'warning' ? 'bg-yellow-500' :
          'bg-blue-500'
        }`}>
          {toast.message}
        </div>
      )}
    </DashboardLayout>
  );
}

"use client";

import { useState, useEffect } from "react";
import { toast } from "react-hot-toast";
import { useCustomerAddressSync } from "@/context/CustomerAddressContext";
import { useDepartmentGuard } from "@/hooks/useDepartmentGuard";
import { getAuthUser } from "@/utils/authUser";

const API_BASE = process.env.NEXT_PUBLIC_BACKEND_URL;

export default function AddressEditRequestsPage() {
  // ✅ Guard FIRST (no return here)
  const isAuthorized = useDepartmentGuard(["ADMIN", "MANAGER", "TL"], false);
  
  // ✅ ALL hooks must be here (always executed)
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("PENDING");
  const [rejectModal, setRejectModal] = useState({ open: false, requestId: null, reason: "" });
  const { bump } = useCustomerAddressSync();

  // ✅ Side effects AFTER hooks
  const fetchRequests = async () => {
    if (!isAuthorized) return; // safety check
    
    try {
      const url = filter ? `${API_BASE}/api/customer-address-edit-requests?status=${filter}` : `${API_BASE}/api/customer-address-edit-requests`;
      
      // 🔐 CRITICAL: Send user headers for backend authorization
      const user = getAuthUser();
      
      // ======================================== FRONTEND DEBUG START
      console.log("======================================== FRONTEND DEBUG START");
      console.log("Current User:", user);
      console.log("User Role:", user?.role);
      console.log("User Department:", user?.department);
      console.log("API URL:", url);
      console.log("========================================");
      
      const response = await fetch(url, {
        headers: {
          "X-User-Id": user?.id,
          "X-User-Role": user?.role,
          "X-User-Department": user?.department ?? ""
        }
      });
      
      const data = await response.json();
      
      console.log("Raw API Response:", data);
      console.log("Total records returned:", Array.isArray(data) ? data.length : 0);
      
      let filteredData = Array.isArray(data) ? data : [];
      
      console.log("Records count BEFORE frontend filter:", filteredData.length);
      
      // ✅ NO FILTERING: TL, MANAGER, and ADMIN all see all requests
      // Frontend displays whatever backend returns
      
      console.log("Records count AFTER frontend filter:", filteredData.length);
      
      // Log each request
      console.log("========================================");
      console.log("Filtered Requests:");
      filteredData.forEach(req => {
        console.log(`Request ID: ${req.id}, Department: ${req.department}, Status: ${req.status}`);
      });
      console.log("======================================== FRONTEND DEBUG END");
      
      setRequests(filteredData);
    } catch (error) {
      console.error("Failed to fetch requests:", error);
      toast.error("Failed to load requests");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthorized) return; // safe
    fetchRequests();
  }, [filter, isAuthorized]);

  // ✅ Conditional UI AFTER hooks
  if (!isAuthorized) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>;
  }

  // Approve request
  const handleApprove = async (requestId) => {
    try {
      const user = getAuthUser();
      const response = await fetch(`${API_BASE}/api/customer-address-edit-requests/${requestId}/approve`, {
        method: "PUT",
        headers: {
          "X-User-Id": user?.id,
          "X-User-Role": user?.role,
          "X-User-Department": user?.department ?? ""
        }
      });
      
      if (response.ok) {
        toast.success("Address updated successfully");
        fetchRequests(); // Refresh list
        bump(); // 🔥 Force global address sync
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to approve request");
      }
    } catch (error) {
      console.error("Approve failed:", error);
      toast.error("Failed to approve request");
    }
  };

  // Reject request
  const handleReject = async () => {
    if (!rejectModal.reason.trim()) {
      toast.error("Please provide rejection reason");
      return;
    }

    try {
      const user = getAuthUser();
      const response = await fetch(`${API_BASE}/api/customer-address-edit-requests/${rejectModal.requestId}/reject?rejectionReason=${encodeURIComponent(rejectModal.reason)}`, {
        method: "PUT",
        headers: {
          "X-User-Id": user?.id,
          "X-User-Role": user?.role,
          "X-User-Department": user?.department ?? ""
        }
      });
      
      if (response.ok) {
        toast.success("Request rejected");
        setRejectModal({ open: false, requestId: null, reason: "" });
        fetchRequests(); // Refresh list
        bump(); // 🔥 Force global address sync
      } else {
        const error = await response.json();
        toast.error(error.error || "Failed to reject request");
      }
    } catch (error) {
      console.error("Reject failed:", error);
      toast.error("Failed to reject request");
    }
  };

  // Format address
  const formatAddress = (address) => {
    if (!address) return "N/A";
    const parts = [address.addressLine, address.city, address.state, address.pincode].filter(Boolean);
    return parts.join(", ");
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-16 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Address Edit Requests</h1>
        <p className="text-gray-600 mt-1">Manage employee address change requests</p>
      </div>

      {/* Filter */}
      <div className="mb-6 flex gap-2">
        {["ALL", "PENDING", "APPROVED", "REJECTED"].map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status === "ALL" ? "" : status)}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              (status === "ALL" && !filter) || filter === status
                ? "bg-blue-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Requests Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Employee
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Client
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Address Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Old Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proposed Address
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Reason
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {requests.length === 0 ? (
                <tr>
                  <td colSpan="8" className="px-6 py-12 text-center text-gray-500">
                    No requests found
                  </td>
                </tr>
              ) : (
                requests.map((request) => (
                  <tr key={request.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.employeeName || "Unknown Employee"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.customerName || "Unknown Client"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {request.addressType || "N/A"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate">{request.oldAddress || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate">
                        {request.newAddressLine && (
                          <div>{request.newAddressLine}</div>
                        )}
                        {request.newCity && (
                          <div>{request.newCity}, {request.newState}</div>
                        )}
                        {request.newPincode && (
                          <div>{request.newPincode}</div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900 max-w-xs">
                      <div className="truncate">{request.reason || "N/A"}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        request.status === "PENDING" ? "bg-yellow-100 text-yellow-800" :
                        request.status === "APPROVED" ? "bg-green-100 text-green-800" :
                        "bg-red-100 text-red-800"
                      }`}>
                        {request.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      {request.status === "PENDING" && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            className="text-green-600 hover:text-green-900 font-medium"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => setRejectModal({ open: true, requestId: request.id, reason: "" })}
                            className="text-red-600 hover:text-red-900 font-medium"
                          >
                            Reject
                          </button>
                        </div>
                      )}
                      {request.status === "REJECTED" && request.rejectionReason && (
                        <div className="text-xs text-gray-500 max-w-xs">
                          <div className="font-medium">Reason:</div>
                          <div className="truncate">{request.rejectionReason}</div>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {rejectModal.open && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Reject Request</h3>
            <textarea
              value={rejectModal.reason}
              onChange={(e) => setRejectModal({ ...rejectModal, reason: e.target.value })}
              placeholder="Please provide reason for rejection..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={4}
            />
            <div className="mt-4 flex gap-3 justify-end">
              <button
                onClick={() => setRejectModal({ open: false, requestId: null, reason: "" })}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

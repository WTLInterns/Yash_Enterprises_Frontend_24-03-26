"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Eye, Building2, Phone, Globe, MapPin, Settings, X } from "lucide-react";
import { backendApi } from "@/services/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DynamicFieldsSection from "@/components/DynamicFieldsSection";
import { getCurrentUserName, getCurrentUserRole, getCurrentUserId } from "@/utils/userUtils";
import {
  fetchFieldDefinitions,
  fetchFieldValues,
  normalizeDefinitions,
  normalizeValues,
  upsertFieldValue,
} from "@/services/crmFields";
import { toast } from "react-toastify";

export default function BanksPage() {
  // ✅ FIXED: Get dynamic user data
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();
  const userId = getCurrentUserId();
  const [banks, setBanks] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [form, setForm] = useState({
    name: "",
    branch: "",
    phone: "",
    website: "",
    address: "",
    district: "",
    taluka: "",
    pinCode: "",
    description: "",
    customFields: {},
  });
  const [fieldDefs, setFieldDefs] = useState([]);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [bankFieldValuesById, setBankFieldValuesById] = useState({});
  const [currentFieldValues, setCurrentFieldValues] = useState({});

  const getLoggedInUser = () => {
    if (typeof window === "undefined") return { name: "Admin", role: "Administrator" };
    try {
      const raw = localStorage.getItem("user_data");
      const obj = raw ? JSON.parse(raw) : null;
      const name = obj?.name || obj?.fullName || obj?.username || obj?.email || "Admin";
      const role = obj?.role || obj?.designation || "Administrator";
      return { name, role };
    } catch {
      return { name: "Admin", role: "Administrator" };
    }
  };

  const fetchBankFieldDefinitions = async () => {
    try {
      const defsRes = await fetchFieldDefinitions("bank");
      const defs = normalizeDefinitions(defsRes);
      setFieldDefs(defs);
      setDynamicColumns(defs.filter((d) => d.active !== false).map((d) => d.fieldKey));
    } catch (err) {
      console.error("Failed to fetch bank field definitions", err);
      setFieldDefs([]);
      setDynamicColumns([]);
    }
  };

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/banks");
      const banksData = Array.isArray(res) ? res : (res?.content || []);
      setBanks(banksData);
      // If currently editing a bank that no longer exists, close modal and clear selection
      if (selectedBank && !banksData.some(b => b.id === selectedBank.id)) {
        setShowCreateModal(false);
        setSelectedBank(null);
      }
      
      // dynamic columns from definitions
      setDynamicColumns((fieldDefs || []).filter((d) => d.active !== false).map((d) => d.fieldKey));

      // values map for list table
      const entries = await Promise.all(
        (banksData || []).map(async (b) => {
          try {
            const vals = await fetchFieldValues("bank", b.id);
            return [b.id, normalizeValues(vals)];
          } catch (_e) {
            return [b.id, {}];
          }
        })
      );
      setBankFieldValuesById(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to fetch banks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBankFieldDefinitions();
    fetchBanks();
  }, []);

  // Helper function to format field names
  const formatLabel = (key) => {
    return key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  };

  const filtered = banks.filter((b) =>
    (b.bankName || b.name)?.toLowerCase().includes(search.toLowerCase()) ||
    (b.branchName || b.branch)?.toLowerCase().includes(search.toLowerCase()) ||
    b.phone?.toLowerCase().includes(search.toLowerCase())
  );

  const handleCreateOrUpdate = async () => {
    try {
      // Get logged-in user data using utility functions
      const userId = getCurrentUserId();
      const userName = getCurrentUserName();
      const userRole = getCurrentUserRole();
      
      // Also check raw storage for debugging
      const rawUserData = JSON.parse(localStorage.getItem('user_data') || sessionStorage.getItem('user_data') || '{}');
      
      console.log('🔍 [BANK] User authentication check:', {
        userId_from_util: userId,
        userName_from_util: userName,
        userRole_from_util: userRole,
        raw_userData: rawUserData,
        raw_userId: rawUserData?.id || rawUserData?.userId,
        storage_sources: {
          localStorage_userData: localStorage.getItem('user_data'),
          sessionStorage_userData: sessionStorage.getItem('user_data'),
          localStorage_authUser: localStorage.getItem('authUser'),
          sessionStorage_authUser: sessionStorage.getItem('authUser')
        }
      });
      
      // Check multiple sources for valid user ID
      const validUserId = userId || rawUserData?.id || rawUserData?.userId;
      
      // ID 1 is actually valid in this system (it's the real user ID)
      if (!validUserId) {
        toast.error("User not logged in. Please login again.");
        console.error('🔍 [BANK] Authentication failed - No user ID found');
        return;
      }
      
      console.log('🔍 [BANK] Authentication successful - User ID:', validUserId);
      
      // Create payload with correct field names (no ownerId - backend will set it)
      const payload = {
        name: form.name,
        branchName: form.branch,
        phone: form.phone,
        website: form.website,
        address: form.address,
        district: form.district,
        taluka: form.taluka,
        pinCode: form.pinCode,
        description: form.description,
        customFields: JSON.stringify(form.customFields || {}),
        active: true,
      };
      
      // Validate website URL
      if (form.website && form.website.trim()) {
        try {
          new URL(form.website);
        } catch {
          toast.error("Invalid website URL. Please use format: https://example.com");
          return;
        }
      }
      
      console.log('🔍 [BANK] Sending payload:', payload);
      
      let savedId = selectedBank?.id;
      if (selectedBank) {
        if (!selectedBank?.id) {
          toast.error("Selected bank no longer exists. Reloading list...");
          await fetchBanks();
          setShowCreateModal(false);
          setSelectedBank(null);
          return;
        }
        await backendApi.put(`/banks/${selectedBank.id}`, payload);
        savedId = selectedBank.id;
        toast.success("Bank updated successfully");
      } else {
        const created = await backendApi.post("/banks", payload);
        savedId = created?.id;
        toast.success("Bank created successfully");
      }

      if (savedId) {
        const activeDefs = (fieldDefs || []).filter((d) => d.active !== false);
        await Promise.all(
          activeDefs.map((d) =>
            upsertFieldValue("bank", savedId, d.fieldKey, currentFieldValues?.[d.fieldKey] ?? "")
          )
        );
      }
      
      // Refresh list
      await fetchBanks();
      
      // Reset form and close modal
      setShowCreateModal(false);
      setSelectedBank(null);
      setForm({ name: "", branch: "", phone: "", website: "", address: "", district: "", taluka: "", pinCode: "", description: "", customFields: {} });
      setCurrentFieldValues({});
    } catch (err) {
      console.error("🔍 [BANK] Save failed:", err);
      const isNotFound = err?.status === 404 || err?.data?.status === 404;
      if (isNotFound) {
        toast.error("Bank not found. Reloading list...");
        await fetchBanks();
        setShowCreateModal(false);
        setSelectedBank(null);
        return;
      }
      
      // Handle authentication errors specifically
      if (err?.status === 401 || err?.data?.message?.includes('Unauthorized')) {
        toast.error("Session expired. Please login again.");
        // Clear invalid session data
        if (typeof window !== 'undefined') {
          localStorage.removeItem('user_data');
          sessionStorage.removeItem('user_data');
          // Redirect to login after a short delay
          setTimeout(() => {
            window.location.href = '/login';
          }, 2000);
        }
        return;
      }
      
      const errorMsg = err?.data?.message || err?.message || "Unknown error";
      toast.error(`Failed to save bank: ${errorMsg}`);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this bank?")) return;
    try {
      await backendApi.delete(`/banks/${id}`);
      // Optimistic UI update
      setBanks(prev => prev.filter(b => b.id !== id));
      // If we were editing this bank, close the modal and clear selection
      if (selectedBank?.id === id) {
        setShowCreateModal(false);
        setSelectedBank(null);
      }
      toast.success("Bank deleted successfully");
      // Refetch to ensure sync
      await fetchBanks();
    } catch (err) {
      console.error("Delete failed:", err);
      const isNotFound = err?.status === 404 || err?.data?.status === 404;
      
      if (isNotFound) {
        toast.error("Already deleted. Refreshing list...");
        await fetchBanks();
        return;
      }
      
      toast.error("Failed to delete bank");
    }
  };

  const openEdit = async (bank) => {
    try {
      if (!bank?.id) {
        toast.error("Invalid bank selected");
        return;
      }

      // Always fetch latest bank from backend
      const freshBank = await backendApi.get(`/banks/${bank.id}`);
      let valuesMap = {};
      try {
        const valsRes = await fetchFieldValues("bank", bank.id);
        valuesMap = normalizeValues(valsRes);
      } catch (_e) {
        valuesMap = {};
      }

      setSelectedBank(freshBank);
      setForm({
        name: freshBank.name || "",
        branch: freshBank.branchName || "",
        phone: freshBank.phone || "",
        website: freshBank.website || "",
        address: freshBank.address || "",
        district: freshBank.district || "",
        taluka: freshBank.taluka || "",
        pinCode: freshBank.pinCode || "",
        description: freshBank.description || "",
      });

      setCurrentFieldValues(valuesMap);
      setShowCreateModal(true);
    } catch (err) {
      console.error("Failed to open edit:", err);

      const isNotFound = err?.status === 404 || err?.data?.status === 404;
      if (isNotFound) {
        toast.error("Bank not found. Reloading list...");
        await fetchBanks();
        return;
      }

      toast.error("Failed to load bank details");
    }
  };

  const openDetails = (bank) => {
    setSelectedBank(bank);
    setShowDetailsDrawer(true);
  };

  return (
    <DashboardLayout
      header={{
        project: 'Banks',
        user: { name: userName, role: userRole },
        notifications: [],
      }}
    >
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Banks</div>
            <p className="text-sm text-slate-500">All banks list</p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add Bank</span>
            </button>
          </div>
        </div>

      <div className="mb-4 flex items-center gap-2 border rounded px-3 py-2 w-96">
        <Search size={18} className="text-gray-400" />
        <input
          type="text"
          placeholder="Search banks..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 outline-none"
        />
      </div>

      {loading ? (
        <div className="text-center py-8">Loading...</div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Bank Name
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Branch
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Phone
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Website
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Owner
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Taluka
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    District
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                    Updated
                  </th>
                  {/* Dynamic custom fields columns */}
                  {dynamicColumns.map(col => (
                    <th key={col} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      {formatLabel(col)}
                    </th>
                  ))}
                  <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {filtered.map((bank) => (
                  <tr key={bank.id} className="hover:bg-slate-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-blue-600" />
                        {bank.bankName || bank.name}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.branchName || bank.branch || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.phone || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.website ? (
                        <a href={bank.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:text-blue-800 hover:underline">
                          <Globe className="h-4 w-4" />
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.ownerName || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-700">
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-slate-400" />
                        <span className="truncate max-w-xs">{bank.address || "-"}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.taluka || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.district || "-"}
                    </td>
                    {/* Created */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.createdAt
                        ? new Date(bank.createdAt).toLocaleString()
                        : "-"}
                    </td>
                    {/* Updated */}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      {bank.updatedAt
                        ? new Date(bank.updatedAt).toLocaleString()
                        : "-"}
                    </td>
                    {/* Dynamic custom fields data */}
                    {dynamicColumns.map(col => (
                      <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {bankFieldValuesById?.[bank.id]?.[col] || "-"}
                      </td>
                    ))}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openDetails(bank)}
                          className="text-green-600 hover:text-green-800"
                          title="View"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEdit(bank)}
                          className="text-blue-600 hover:text-blue-800"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(bank.id)}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
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

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <>
          <div
            className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowCreateModal(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
            <div
              className="relative w-full max-w-2xl h-[80vh] transform overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/50 animate-slideInRight flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between border-b border-slate-200/80 px-6 py-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">
                    {selectedBank ? "Edit Bank" : "Create Bank"}
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedBank ? "Update bank information" : "Add a new bank to your database"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-6 py-4">
                <div className="space-y-6 max-h-full">
                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Bank Name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                        placeholder="Enter bank name"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Branch Name
                      </label>
                      <input
                        type="text"
                        value={form.branch}
                        onChange={(e) => setForm({ ...form, branch: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                        placeholder="Enter branch name"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Phone Number
                      </label>
                      <input
                        type="tel"
                        value={form.phone}
                        onChange={(e) => setForm({ ...form, phone: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                        placeholder="Enter phone number"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Website
                    </label>
                    <input
                      type="url"
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                      placeholder="https://example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Address
                    </label>
                    <textarea
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      rows={3}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                      placeholder="Enter complete address"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        District
                      </label>
                      <input
                        type="text"
                        value={form.district}
                        onChange={(e) => setForm({ ...form, district: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                        placeholder="Enter district"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Taluka
                      </label>
                      <input
                        type="text"
                        value={form.taluka}
                        onChange={(e) => setForm({ ...form, taluka: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                        placeholder="Enter taluka"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Pin Code
                      </label>
                      <input
                        type="text"
                        value={form.pinCode}
                        onChange={(e) => setForm({ ...form, pinCode: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                        placeholder="Enter pin code"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">
                      Description
                    </label>
                    <textarea
                      value={form.description}
                      onChange={(e) => setForm({ ...form, description: e.target.value })}
                      rows={2}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                      placeholder="Enter bank description"
                    />
                  </div>

                  <DynamicFieldsSection
                    entity="bank"
                    entityId={selectedBank?.id}
                    values={form.customFields}
                    onChange={(values) => setForm({ ...form, customFields: values })}
                  />
                </div>
              </div>

              <div className="border-t border-slate-200/80 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-slate-500">
                    <span className="text-rose-500">*</span> Required fields
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setShowCreateModal(false)}
                      className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateOrUpdate}
                      className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                    >
                      {selectedBank ? "Update Bank" : "Create Bank"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Details Drawer */}
      {showDetailsDrawer && selectedBank && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-end z-50">
          <div className="bg-white w-full max-w-md h-full overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-semibold">Bank Details</h2>
              <button onClick={() => setShowDetailsDrawer(false)} className="text-gray-500 hover:text-gray-700">
                ✕
              </button>
            </div>
            <div className="space-y-3">
              <div><strong>Name:</strong> {selectedBank.bankName || selectedBank.name}</div>
              <div><strong>Branch:</strong> {selectedBank.branchName || selectedBank.branch}</div>
              <div><strong>Phone:</strong> {selectedBank.phone}</div>
              <div><strong>Website:</strong> {selectedBank.website ? <a href={selectedBank.website} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">{selectedBank.website}</a> : "-"}</div>
              <div><strong>Address:</strong> {selectedBank.address}</div>
            </div>
          </div>
        </div>
      )}

      </div>
    </DashboardLayout>
  );
}

"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  User, Mail, Phone, Building2, Briefcase, ArrowLeft,
  FileText, Eye, Trash2, Upload, Plus, X, MapPin, Calendar,
  CreditCard, Shield
} from "lucide-react";
import { backendApi } from "@/services/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUserName, getCurrentUserRole, getCurrentUserId } from "@/utils/userUtils";
import { toast } from "react-toastify";

const TABS = ["Documents"];

export default function EmployeeDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();
  const userId = getCurrentUserId();

  const [employee, setEmployee] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [activeTab, setActiveTab] = useState("Documents");
  const [loading, setLoading] = useState(true);

  // Upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Folder state
  const [openFolder, setOpenFolder] = useState(null);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [empData, docData] = await Promise.all([
        backendApi.get(`/employees/${id}`),
        backendApi.get(`/employees/${id}/documents`).catch(() => []),
      ]);
      setEmployee(empData);
      setDocuments(Array.isArray(docData) ? docData : []);
    } catch (err) {
      toast.error("Failed to load employee details");
    } finally {
      setLoading(false);
    }
  };

  // Group documents by name (folder)
  const docFolders = documents.reduce((acc, doc) => {
    const key = doc.name || "Uncategorized";
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  const handleUpload = async () => {
    if (!docName.trim()) { toast.error("Document name is required"); return; }
    if (!docFile) { toast.error("Please select a file"); return; }
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("name", docName.trim());
      formData.append("file", docFile);
      const res = await fetch(`http://localhost:8080/api/employees/${id}/documents`, {
        method: "POST",
        headers: { "X-User-Id": userId || "" },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("Document uploaded");
      setShowUploadModal(false);
      setDocName("");
      setDocFile(null);
      const updated = await backendApi.get(`/employees/${id}/documents`).catch(() => []);
      setDocuments(Array.isArray(updated) ? updated : []);
    } catch (err) {
      toast.error("Upload failed: " + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDoc = async (docId) => {
    if (!confirm("Delete this document?")) return;
    try {
      await backendApi.delete(`/employees/${id}/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const getInitials = (emp) => {
    if (!emp) return "??";
    return `${emp.firstName?.[0] || ""}${emp.lastName?.[0] || ""}`.toUpperCase();
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case "active": return "bg-emerald-100 text-emerald-700";
      case "inactive": return "bg-red-100 text-red-700";
      case "on_leave": return "bg-yellow-100 text-yellow-700";
      default: return "bg-slate-100 text-slate-600";
    }
  };

  if (loading) {
    return (
      <DashboardLayout header={{ project: "Employee Detail", user: { name: userName, role: userRole }, notifications: [] }}>
        <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!employee) {
    return (
      <DashboardLayout header={{ project: "Employee Detail", user: { name: userName, role: userRole }, notifications: [] }}>
        <div className="flex items-center justify-center h-64 text-slate-500">Employee not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout header={{ project: `${employee.firstName} ${employee.lastName}`, user: { name: userName, role: userRole }, notifications: [] }}>
      <div className="max-w-6xl mx-auto space-y-6 px-4 pb-10">

        {/* Back */}
        <button onClick={() => router.push("/organization")}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </button>

        {/* Premium Gradient Header */}
        <div className="rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 text-xl font-bold">
                {getInitials(employee)}
              </div>
              <div>
                <h1 className="text-2xl font-bold">{employee.firstName} {employee.lastName}</h1>
                <p className="text-sm opacity-80">{employee.employeeId || "—"}</p>
                <div className="mt-2 flex flex-wrap gap-3 text-sm opacity-90">
                  {employee.email && (
                    <span className="flex items-center gap-1"><Mail className="h-4 w-4" />{employee.email}</span>
                  )}
                  {employee.phone && (
                    <span className="flex items-center gap-1"><Phone className="h-4 w-4" />{employee.phone}</span>
                  )}
                  {(employee.departmentName || employee.tlDepartmentName) && (
                    <span className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      {employee.departmentName || employee.tlDepartmentName}
                    </span>
                  )}
                  {employee.tlFullName && (
                    <span className="opacity-80">TL: {employee.tlFullName}</span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2 shrink-0">
              <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                employee.status?.toLowerCase() === "active"
                  ? "bg-emerald-400/30 text-white"
                  : "bg-red-400/30 text-white"
              }`}>
                {employee.status || "Unknown"}
              </span>
              <button onClick={() => setShowUploadModal(true)}
                className="bg-white text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium transition">
                Upload Doc
              </button>
            </div>
          </div>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Building2,
              label: "Department",
              value: employee.departmentName
                || (employee.tlDepartmentName ? `${employee.tlDepartmentName} (via TL)` : null)
                || "—"
            },
            {
              icon: Briefcase,
              label: "Role",
              value: employee.roleName || employee.role?.name || "—"
            },
            {
              icon: Shield,
              label: "Designation",
              value: employee.customDesignation || employee.designationName || employee.designation?.name || "—"
            },
            {
              icon: CreditCard,
              label: "Employee ID",
              value: employee.employeeId || "—"
            },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4 text-indigo-500" />
                <span className="text-xs font-medium text-slate-500">{label}</span>
              </div>
              <p className="text-sm font-semibold text-slate-900">{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs + Content */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex gap-6 border-b border-slate-200 px-6">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`pb-3 pt-4 text-sm font-medium transition flex items-center gap-1.5 ${
                  activeTab === tab
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                <FileText className="h-4 w-4" />
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6">
            {activeTab === "Documents" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-700">Documents ({documents.length})</h3>
                  <button onClick={() => setShowUploadModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                    <Plus className="h-4 w-4" /> Upload Document
                  </button>
                </div>

                {Object.keys(docFolders).length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No documents yet. Upload one to get started.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {Object.entries(docFolders).map(([folderName, files]) => (
                      <div key={folderName} className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                        <button
                          onClick={() => setOpenFolder(openFolder === folderName ? null : folderName)}
                          className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 text-left">
                          <span className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                            <FileText className="h-4 w-4 text-indigo-500" />
                            {folderName}
                            <span className="text-xs font-normal text-slate-400">({files.length} file{files.length !== 1 ? "s" : ""})</span>
                          </span>
                          <span className="text-slate-400 text-xs">{openFolder === folderName ? "▲" : "▼"}</span>
                        </button>
                        {openFolder === folderName && (
                          <div className="p-3 space-y-1">
                            {files.map(doc => (
                              <div key={doc.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 transition">
                                <div className="flex items-center gap-2">
                                  <FileText className="h-4 w-4 text-indigo-500" />
                                  <span className="text-sm text-slate-700">{doc.fileName}</span>
                                  {doc.fileSize && (
                                    <span className="text-xs text-slate-400">({(doc.fileSize / 1024).toFixed(1)} KB)</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-2">
                                  <a href={`http://localhost:8080${doc.fileUrl}`} target="_blank" rel="noopener noreferrer"
                                    className="text-slate-500 hover:text-indigo-600" title="View">
                                    <Eye className="h-4 w-4" />
                                  </a>
                                  <button onClick={() => handleDeleteDoc(doc.id)}
                                    className="text-slate-400 hover:text-red-600" title="Delete">
                                    <Trash2 className="h-4 w-4" />
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Upload Modal */}
      {showUploadModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Upload Document</h3>
                <button onClick={() => setShowUploadModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Document Name / Folder <span className="text-rose-500">*</span>
                  </label>
                  <input type="text" value={docName} onChange={e => setDocName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none"
                    placeholder="e.g. Aadhar, PAN, Offer Letter" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    File <span className="text-rose-500">*</span>
                  </label>
                  <div onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                    <Upload className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                    {docFile ? (
                      <p className="text-sm text-slate-700 font-medium">{docFile.name}</p>
                    ) : (
                      <p className="text-sm text-slate-500">Click to select file</p>
                    )}
                    <input ref={fileInputRef} type="file" className="hidden"
                      onChange={e => setDocFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setShowUploadModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">
                  Cancel
                </button>
                <button onClick={handleUpload} disabled={uploading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

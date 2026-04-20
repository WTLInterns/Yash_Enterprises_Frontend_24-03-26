"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Building2, MapPin, Globe, User, Mail, Briefcase,
  FileText, Send, Plus, Trash2, Eye, X, Paperclip, ArrowLeft, Upload
} from "lucide-react";
import { backendApi } from "@/services/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUserName, getCurrentUserRole, getCurrentUserId } from "@/utils/userUtils";
import { toast } from "react-toastify";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

const TABS = ["Documents", "Emails"];

export default function BankDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();
  const userId = getCurrentUserId();

  const [bank, setBank] = useState(null);
  const [contacts, setContacts] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [emails, setEmails] = useState([]);
  const [activeTab, setActiveTab] = useState("Documents");
  const [loading, setLoading] = useState(true);

  // Document upload state
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [docName, setDocName] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  // Email state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ to: "", cc: "", subject: "", body: "" });
  const [emailFile, setEmailFile] = useState(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const emailFileRef = useRef(null);

  // Grouped documents by name (folder-like)
  const [openFolder, setOpenFolder] = useState(null);

  useEffect(() => {
    if (!id) return;
    loadAll();
  }, [id]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [bankData, contactData, docData, emailData] = await Promise.all([
        backendApi.get(`/banks/${id}`),
        backendApi.get(`/banks/${id}/contacts`).catch(() => []),
        backendApi.get(`/banks/${id}/documents`).catch(() => []),
        backendApi.get(`/banks/${id}/emails`).catch(() => []),
      ]);
      setBank(bankData);
      setContacts(Array.isArray(contactData) ? contactData : []);
      setDocuments(Array.isArray(docData) ? docData : []);
      setEmails(Array.isArray(emailData) ? emailData : []);
    } catch (err) {
      toast.error("Failed to load bank details");
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
      const res = await fetch(`${BASE_URL}/api/banks/${id}/documents`, {
        method: "POST",
        headers: { "X-User-Id": userId || "" },
        body: formData,
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success("Document uploaded");
      setShowUploadModal(false);
      setDocName("");
      setDocFile(null);
      const updated = await backendApi.get(`/banks/${id}/documents`).catch(() => []);
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
      await backendApi.delete(`/banks/${id}/documents/${docId}`);
      setDocuments(prev => prev.filter(d => d.id !== docId));
      toast.success("Document deleted");
    } catch {
      toast.error("Failed to delete document");
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.to.trim()) { toast.error("To address is required"); return; }
    if (!emailForm.subject.trim()) { toast.error("Subject is required"); return; }
    setSendingEmail(true);
    try {
      const formData = new FormData();
      formData.append("to", emailForm.to);
      if (emailForm.cc) formData.append("cc", emailForm.cc);
      formData.append("subject", emailForm.subject);
      formData.append("body", emailForm.body);
      if (emailFile) formData.append("file", emailFile);
      const res = await fetch(`${BASE_URL}/api/banks/${id}/emails`, {
        method: "POST",
        headers: { "X-User-Id": userId || "" },
        body: formData,
      });
      if (!res.ok) throw new Error("Send failed");
      toast.success("Email sent");
      setShowEmailModal(false);
      setEmailForm({ to: "", cc: "", subject: "", body: "" });
      setEmailFile(null);
      const updated = await backendApi.get(`/banks/${id}/emails`).catch(() => []);
      setEmails(Array.isArray(updated) ? updated : []);
    } catch (err) {
      toast.error("Failed to send email: " + err.message);
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout header={{ project: "Bank Detail", user: { name: userName, role: userRole }, notifications: [] }}>
        <div className="flex items-center justify-center h-64 text-slate-500">Loading...</div>
      </DashboardLayout>
    );
  }

  if (!bank) {
    return (
      <DashboardLayout header={{ project: "Bank Detail", user: { name: userName, role: userRole }, notifications: [] }}>
        <div className="flex items-center justify-center h-64 text-slate-500">Bank not found</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout header={{ project: bank.branchName || bank.name || "Bank Detail", user: { name: userName, role: userRole }, notifications: [] }}>
      <div className="max-w-6xl mx-auto space-y-6 px-4 pb-10">

        {/* Back */}
        <button onClick={() => router.push("/bank")}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" /> Back to Banks
        </button>

        {/* Premium Gradient Header */}
        <div className="sticky top-0 z-10 rounded-2xl bg-gradient-to-r from-indigo-500 to-purple-600 p-6 text-white shadow-lg">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-white/20">
                <Building2 className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">{bank.branchName || bank.name}</h1>
                <p className="text-sm opacity-80">{bank.name}</p>
                <div className="mt-2 flex flex-wrap gap-4 text-sm opacity-90">
                  {bank.taluka && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{bank.taluka}</span>}
                  {bank.district && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{bank.district}</span>}
                  {bank.website && (
                    <a href={bank.website} target="_blank" rel="noopener noreferrer"
                      className="flex items-center gap-1 underline underline-offset-2 hover:opacity-80">
                      <Globe className="h-4 w-4" />{bank.website}
                    </a>
                  )}
                </div>
                {bank.address && <p className="mt-1 text-sm opacity-75">{bank.address}</p>}
              </div>
            </div>
            <div className="flex gap-3 shrink-0">
              <button onClick={() => setShowEmailModal(true)}
                className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition">
                Send Email
              </button>
              <button onClick={() => setShowUploadModal(true)}
                className="bg-white text-indigo-600 hover:bg-indigo-50 px-4 py-2 rounded-lg text-sm font-medium transition">
                Upload Doc
              </button>
            </div>
          </div>
        </div>

        {/* Contact Persons */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
          <h3 className="text-sm font-semibold text-slate-700 mb-4">
            Contact Person{contacts.length !== 1 ? "s" : ""}
            {contacts.length > 0 && <span className="ml-2 text-xs font-normal text-slate-400">({contacts.length})</span>}
          </h3>
          {contacts.length === 0 ? (
            <p className="text-sm text-slate-400">No contact persons added yet.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {contacts.map(c => (
                <div key={c.id} className="p-4 rounded-xl border border-slate-200 bg-white shadow-sm hover:shadow-md transition">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                      <User className="h-5 w-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{c.fullName || "-"}</p>
                      {c.position && <p className="text-xs text-slate-500 flex items-center gap-1"><Briefcase className="h-3 w-3" />{c.position}</p>}
                    </div>
                  </div>
                  {c.email && (
                    <div className="mt-3 text-sm text-slate-600 flex items-center gap-1">
                      <Mail className="h-4 w-4 text-slate-400" />{c.email}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="flex gap-6 border-b border-slate-200 px-6">
            {TABS.map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={`pb-3 pt-4 text-sm font-medium transition flex items-center gap-1.5 ${
                  activeTab === tab
                    ? "border-b-2 border-indigo-600 text-indigo-600"
                    : "text-slate-500 hover:text-slate-700"
                }`}>
                {tab === "Documents" && <FileText className="h-4 w-4" />}
                {tab === "Emails" && <Send className="h-4 w-4" />}
                {tab}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* Documents Tab */}
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
                                  <a href={`${BASE_URL}${doc.fileUrl}`} target="_blank" rel="noopener noreferrer"
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

            {/* Emails Tab */}
            {activeTab === "Emails" && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-medium text-slate-700">Email History ({emails.length})</h3>
                  <button onClick={() => setShowEmailModal(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                    <Send className="h-4 w-4" /> Send Email
                  </button>
                </div>

                {emails.length === 0 ? (
                  <div className="text-center py-12 text-slate-400">
                    <Send className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No emails sent yet.</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {emails.map(email => (
                      <div key={email.id} className="p-4 border border-slate-200 rounded-xl hover:shadow-sm transition">
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="font-semibold text-slate-900">{email.subject || "(No subject)"}</p>
                            <p className="text-xs text-slate-500 mt-0.5">
                              To: {email.toEmail}
                              {email.ccEmail && <span> · CC: {email.ccEmail}</span>}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 ml-3">
                            <span className={`text-xs px-2 py-0.5 rounded-full ${
                              email.status === "SENT" ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                            }`}>{email.status}</span>
                            <span className="text-xs text-slate-400">
                              {email.sentAt ? new Date(email.sentAt).toLocaleString("en-IN") : ""}
                            </span>
                          </div>
                        </div>
                        {email.body && (
                          <p className="text-sm text-slate-600 mt-2 line-clamp-2">{email.body}</p>
                        )}
                        {email.attachmentName && (
                          <p className="text-xs text-slate-400 mt-2 flex items-center gap-1">
                            <Paperclip className="h-3 w-3" />{email.attachmentName}
                          </p>
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

      {/* Upload Document Modal */}
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
                  <label className="block text-sm font-medium text-slate-700 mb-1">Document Name / Folder <span className="text-rose-500">*</span></label>
                  <input type="text" value={docName} onChange={e => setDocName(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="e.g. Agreement, KYC, NOC" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">File <span className="text-rose-500">*</span></label>
                  <div
                    onClick={() => fileInputRef.current?.click()}
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
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={handleUpload} disabled={uploading}
                  className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Send Email Modal */}
      {showEmailModal && (
        <>
          <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowEmailModal(false)} />
          <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
            <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-semibold text-slate-900">Send Email</h3>
                <button onClick={() => setShowEmailModal(false)}><X className="h-5 w-5 text-slate-400" /></button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">To <span className="text-rose-500">*</span></label>
                  <input type="email" value={emailForm.to} onChange={e => setEmailForm({ ...emailForm, to: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="recipient@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">CC</label>
                  <input type="email" value={emailForm.cc} onChange={e => setEmailForm({ ...emailForm, cc: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="cc@example.com" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Subject <span className="text-rose-500">*</span></label>
                  <input type="text" value={emailForm.subject} onChange={e => setEmailForm({ ...emailForm, subject: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="Email subject" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Body</label>
                  <textarea value={emailForm.body} onChange={e => setEmailForm({ ...emailForm, body: e.target.value })} rows={4}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
                    placeholder="Write your message..." />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Attach File</label>
                  <div className="flex items-center gap-2">
                    <button onClick={() => emailFileRef.current?.click()}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-50">
                      <Paperclip className="h-4 w-4" />
                      {emailFile ? emailFile.name : "Choose file"}
                    </button>
                    {emailFile && (
                      <button onClick={() => setEmailFile(null)} className="text-red-400 hover:text-red-600">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    <input ref={emailFileRef} type="file" className="hidden"
                      onChange={e => setEmailFile(e.target.files?.[0] || null)} />
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-5">
                <button onClick={() => setShowEmailModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Cancel</button>
                <button onClick={handleSendEmail} disabled={sendingEmail}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50">
                  <Send className="h-4 w-4" />
                  {sendingEmail ? "Sending..." : "Send Email"}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

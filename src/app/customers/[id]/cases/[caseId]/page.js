"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { backendApi } from "@/services/api";
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";

export default function CaseDetailModalPage() {
  const params = useParams();
  const router = useRouter();

  // ✅ FIXED: Get dynamic user data
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();

  const customerId = params?.id;
  const caseId = params?.caseId;

  const [caseData, setCaseData] = useState(null);
  const [docs, setDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [file, setFile] = useState(null);
  const [docType, setDocType] = useState("");
  const fileInputRef = useRef(null);
  const [viewingDoc, setViewingDoc] = useState(null);

  useEffect(() => {
    if (!caseId) return;

    let isMounted = true;

    async function loadCase() {
      try {
        const data = await backendApi.get(`/cases/${caseId}`);
        if (!isMounted) return;
        setCaseData(data || null);
      } catch (err) {
        console.error("Failed to load case", err);
      }
    }

    async function loadDocuments() {
      try {
        const list = await backendApi.get(`/case-documents/case/${caseId}`);
        if (!isMounted) return;
        setDocs(list || []);
      } catch (err) {
        console.error("Failed to load documents", err);
      }
    }

    (async () => {
      setLoading(true);
      await Promise.all([loadCase(), loadDocuments()]);
      if (isMounted) setLoading(false);
    })();

    return () => {
      isMounted = false;
    };
  }, [caseId]);

  function closeModal() {
    if (customerId) {
      router.push(`/customers/${customerId}`);
    } else {
      router.push("/customers");
    }
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!file || !caseId) return;

    try {
      setUploading(true);

      const formData = new FormData();
      formData.append("file", file);
      formData.append("caseId", String(caseId));
      formData.append("documentName", docType || file.name);
      formData.append("description", "");

      const res = await fetch("http://localhost:8080/api/case-documents/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const text = await res.text();
        console.error("Upload failed", text);
        return;
      }

      const uploaded = await res.json();
      setDocs((prev) => [...prev, uploaded]);
      setFile(null);
      setDocType("");
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Failed to upload document", err);
    } finally {
      setUploading(false);
    }
  }

  async function handleRemoveDoc(id) {
    if (!id) return;
    try {
      await backendApi.delete(`/case-documents/${id}`);
      setDocs((prev) => prev.filter((d) => d.id !== id));
    } catch (err) {
      console.error("Failed to delete document", err);
    }
  }

  function handleViewDoc(doc) {
    if (!doc) return;
    setViewingDoc(doc);
  }

  function closePdfModal() {
    setViewingDoc(null);
  }

  function downloadDoc(doc) {
    if (!doc) return;
    window.open(`http://localhost:8080/api/case-documents/download/${doc.id}`, '_blank');
  }

  const caseTitle = caseData?.title || caseData?.caseNumber || `Case #${caseId}`;

  return (
    <DashboardLayout
      header={{
        project: "Case Details",
        user: { name: userName, role: userRole },
        notifications: [],
      }}
    >
      <div className="fixed inset-0 z-40 bg-black/40" />

      <div className="fixed inset-0 z-50 flex items-start justify-center px-4 py-12 overflow-y-auto">
        <div className="w-full max-w-6xl rounded-2xl bg-white p-8 shadow-xl">
          <div className="mb-4 flex items-start justify-between">
            <div>
              <p className="text-xs text-slate-500">
                <Link href="/customers" className="text-indigo-600 hover:underline">
                  Customers
                </Link>{" "}
                {customerId && (
                  <>
                    {"/ "}
                    <Link
                      href={`/customers/${customerId}`}
                      className="text-indigo-600 hover:underline"
                    >
                      Customer
                    </Link>{" "}
                  </>
                )}
                {"/ Case"}
              </p>
              <h1 className="mt-1 text-xl font-semibold text-slate-900">{caseTitle}</h1>
              {caseData && (
                <p className="mt-1 text-xs text-slate-500">
                  Case No: {caseData.caseNumber || "-"} | Status:{" "}
                  <span className={`font-medium ${
                    caseData.status === "OPEN" ? "text-green-600" : "text-slate-600"
                  }`}>
                    {caseData.status || "-"}
                  </span>{" "}
                  | Priority:{" "}
                  <span className={`font-medium ${
                    caseData.priority === "MEDIUM" ? "text-orange-600" : 
                    caseData.priority === "HIGH" ? "text-red-600" : 
                    caseData.priority === "LOW" ? "text-blue-600" : "text-slate-600"
                  }`}>
                    {caseData.priority || "-"}
                  </span>
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={closeModal}
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            >
              X
            </button>
          </div>

          <div className="border-b border-slate-200 pb-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-slate-900">Documents</h2>
            </div>
            <form onSubmit={handleUpload} className="flex items-center gap-3 mb-4">
              <div className="flex-1">
                <input
                  type="text"
                  className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder:text-slate-500"
                  value={docType}
                  onChange={(e) => setDocType(e.target.value)}
                  placeholder="Enter document name"
                />
              </div>
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                className="text-sm file:mr-2 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"
                ref={fileInputRef}
              />
              <button
                type="submit"
                disabled={uploading || !file}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-indigo-300"
              >
                {uploading ? "Uploading..." : "Upload Document"}
              </button>
            </form>
          </div>

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-slate-500">Loading documents...</p>
            ) : docs.length === 0 ? (
              <p className="text-sm text-slate-500">
                No documents uploaded. Click &quot;Upload Doc&quot; to add a PDF.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-500 text-white">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-5 w-5"
                        >
                          <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h8.5a2 2 0 001.414-.586l3.5-3.5A2 2 0 0018 13.5V4a2 2 0 00-2-2H4z" />
                        </svg>
                      </div>
                      <div>
                        <div className="text-xs font-semibold uppercase tracking-wide text-slate-700">
                          {doc.documentName || "Document"}
                        </div>
                        <div className="text-sm font-medium text-slate-900">
                          {doc.fileName || "File"}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewDoc(doc)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-medium flex items-center gap-1"
                        title="View document"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        View
                      </button>
                      <button
                        type="button"
                        onClick={() => downloadDoc(doc)}
                        className="text-green-600 hover:text-green-800 text-xs font-medium flex items-center gap-1"
                        title="Download document"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveDoc(doc.id)}
                        className="text-red-500 hover:text-red-600"
                        title="Remove document"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="h-4 w-4"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM8 8a1 1 0 012 0v7a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v7a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* PDF Modal Viewer */}
      {viewingDoc && (
        <>
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={closePdfModal} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="relative w-full max-w-6xl h-[90vh] bg-white rounded-xl shadow-2xl overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b bg-white">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {viewingDoc.documentName || viewingDoc.fileName || "Document"}
                  </h3>
                  <p className="text-sm text-slate-500">{viewingDoc.fileName}</p>
                </div>
                <button
                  type="button"
                  onClick={closePdfModal}
                  className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
              <div className="flex-1 bg-gray-100 p-1">
                <iframe
                  src={`http://localhost:8080/api/case-documents/view/${viewingDoc.id}`}
                  className="w-full h-full border-0 rounded-lg"
                  title="PDF Viewer"
                  style={{ minHeight: 'calc(90vh - 80px)' }}
                  onError={(e) => {
                    console.error('PDF load error:', e);
                    // Fallback: try opening in new tab if iframe fails
                    window.open(`http://localhost:8080/api/case-documents/view/${viewingDoc.id}`, '_blank');
                    e.target.style.display = 'none';
                    const errorDiv = document.createElement('div');
                    errorDiv.className = 'flex items-center justify-center h-full text-red-600';
                    errorDiv.innerHTML = '<div class="text-center"><p class="text-lg font-medium">PDF Viewer Error</p><p class="text-sm mt-2">Opening in new tab...</p></div>';
                    e.target.parentNode.appendChild(errorDiv);
                  }}
                  onLoad={() => {
                    console.log('PDF loaded successfully');
                  }}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}

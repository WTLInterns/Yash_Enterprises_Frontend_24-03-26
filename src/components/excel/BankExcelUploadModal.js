"use client";
import { useState, useRef } from "react";
import { X, Download, Upload, FileSpreadsheet } from "lucide-react";
import { toast } from "react-toastify";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

export default function BankExcelUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef(null);

  const getUserData = () => {
    try {
      const raw = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/banks/download-template`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "bank-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      toast.error("Failed to download template: " + e.message);
    }
  };

  const handleFileChange = (e) => {
    const f = e.target.files[0];
    if (f && f.name.endsWith(".xlsx")) {
      setFile(f);
      setUploadResult(null);
    } else {
      toast.error("Please select a valid .xlsx file");
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".xlsx")) {
      setFile(f);
      setUploadResult(null);
    } else {
      toast.error("Please select a valid .xlsx file");
    }
  };

  const handleUpload = async () => {
    if (!file) { toast.error("Please select a file first"); return; }
    setUploading(true);
    setUploadResult(null);
    try {
      const user = getUserData();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`${BASE_URL}/api/banks/upload-excel`, {
        method: "POST",
        headers: {
          "X-User-Id": user?.id ? String(user.id) : "",
          "X-User-Role": user?.role || "",
          "X-User-Department": user?.department || "",
        },
        body: formData,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || data.message || "Upload failed");
      setUploadResult(data);
      if ((data.success ?? data.count ?? 1) > 0) {
        onUploadSuccess?.(data);
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null);
    setUploadResult(null);
    setUploading(false);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Upload Excel - Banks
          </h2>
          <button onClick={reset} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        {!uploadResult ? (
          <>
            <div className="mb-4">
              <button
                onClick={handleDownloadTemplate}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 mr-2"
              >
                📥 Download Template
              </button>
              <span className="text-sm text-gray-600">Use the template to ensure correct format</span>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300"}`}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={() => setDragActive(false)}
              onClick={() => fileInputRef.current?.click()}
            >
              <input ref={fileInputRef} type="file" accept=".xlsx" onChange={handleFileChange} className="hidden" />
              {file ? (
                <div>
                  <div className="text-green-600 mb-2">✅ {file.name}</div>
                  <span className="text-blue-500 hover:underline text-sm">Choose different file</span>
                </div>
              ) : (
                <div>
                  <Upload className="h-8 w-8 text-gray-400 mx-auto mb-3" />
                  <div className="text-gray-500 mb-2">Drag and drop your Excel file here, or click to browse</div>
                </div>
              )}
            </div>

            <div className="mt-4 text-sm text-gray-600">
              <p className="font-semibold mb-1">Required Headers:</p>
              <p>Bank Name, Branch Name</p>
              <p className="mt-1">Optional: Address, Taluka, District, Pin Code, Website</p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button onClick={reset} className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50">Cancel</button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {uploading ? "Uploading..." : "Upload"}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className={`p-4 rounded-lg mb-4 ${(uploadResult.success ?? 0) > 0 ? "bg-green-50 border border-green-200" : "bg-yellow-50 border border-yellow-200"}`}>
              <h3 className="font-semibold mb-2">Upload Summary</h3>
              <div className="space-y-1 text-sm">
                {uploadResult.totalRows != null && <p>Total Rows: {uploadResult.totalRows}</p>}
                <p className="text-green-600">✅ Successful: {uploadResult.success ?? uploadResult.count ?? "—"}</p>
                {uploadResult.failed != null && <p className="text-red-600">❌ Failed: {uploadResult.failed}</p>}
              </div>
            </div>

            {uploadResult.errors?.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 mb-2">Errors:</h4>
                <div className="max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded p-2">
                  {uploadResult.errors.map((err, i) => (
                    <div key={i} className="text-sm text-red-700">{err}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button onClick={reset} className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600">Close</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

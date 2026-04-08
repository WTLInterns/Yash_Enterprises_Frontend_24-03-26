"use client";
import React, { useState, useRef } from "react";
import { X, Download, Upload, FileSpreadsheet } from "lucide-react";
import { getTabSafeItem } from "@/utils/tabSafeStorage";

export default function CustomerExcelUploadModal({ isOpen, onClose, onUploadSuccess }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef(null);

  const getAuthUser = () => {
    try {
      const raw = getTabSafeItem("user_data")
        || sessionStorage.getItem("user_data")
        || localStorage.getItem("user_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const handleDownloadTemplate = async () => {
    try {
      const res = await fetch("https://api.yashrajent.com/api/deals/download-template");
      if (!res.ok) throw new Error("Template download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "deal-import-template.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      setError("Failed to download template: " + e.message);
    }
  };

  const handleUpload = async () => {
    if (!file) { setError("Please select a file first"); return; }
    setError("");
    setUploading(true);
    try {
      const authUser = getAuthUser();
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("https://api.yashrajent.com/api/deals/upload-excel", {
        method: "POST",
        headers: {
          "X-User-Id":         String(authUser?.id || ""),
          "X-User-Role":       authUser?.role || authUser?.roleName || "",
          "X-User-Department": authUser?.department || authUser?.departmentName || "",
        },
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Upload failed");
      onUploadSuccess(data);
      setFile(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            Upload Excel
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-4">
          <button
            onClick={handleDownloadTemplate}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg border border-green-600 text-green-700 px-4 py-2 text-sm font-medium hover:bg-green-50"
          >
            <Download className="h-4 w-4" />
            Download Template
          </button>

          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-slate-300 rounded-lg p-6 text-center cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors"
          >
            <Upload className="h-8 w-8 text-slate-400 mx-auto mb-2" />
            {file ? (
              <p className="text-sm font-medium text-indigo-700">{file.name}</p>
            ) : (
              <p className="text-sm text-slate-500">Click to select .xlsx file</p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx"
              className="hidden"
              onChange={e => { setFile(e.target.files[0] || null); setError(""); }}
            />
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={handleUpload}
              disabled={uploading || !file}
              className="flex-1 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState } from 'react';
import { backendApi } from '@/services/api';

const CustomerExcelUploadModal = ({ isOpen, onClose, onUploadSuccess }) => {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile && selectedFile.name.endsWith('.xlsx')) {
      setFile(selectedFile);
      setUploadResult(null);
    } else {
      alert('Please select a valid .xlsx file');
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragActive(false);
    
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && droppedFile.name.endsWith('.xlsx')) {
      setFile(droppedFile);
      setUploadResult(null);
    } else {
      alert('Please select a valid .xlsx file');
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  const reactivateBanks = async () => {
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      // Fetch inactive banks created by import service
      const res = await fetch(`${BASE_URL}/api/banks?size=9999&active=false`);
      if (!res.ok) return;
      const data = await res.json();
      const inactive = (data.content || []);
      if (inactive.length === 0) return;
      // Reactivate all inactive banks
      await Promise.all(inactive.map(b =>
        fetch(`${BASE_URL}/api/banks/${b.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...b, active: true }),
        }).catch(() => {})
      ));
    } catch { /* silent */ }
  };

  const handleUpload = async () => {
    if (!file) {
      alert('Please select a file first');
      return;
    }

    setUploading(true);
    setUploadResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await backendApi.post('/deals/upload-excel', formData);

      setUploadResult(response);
      
      if (response.success > 0) {
        reactivateBanks(); // fix banks created with active=false by import service
        onUploadSuccess?.(response);
      }
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  const handleDownloadTemplate = async () => {
    try {
      const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';
      const res = await fetch(`${BASE_URL}/api/deals/download-template`);
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'deal-import-template.xlsx';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Template download failed:', error);
      alert('Failed to download template: ' + error.message);
    }
  };

  const resetModal = () => {
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
          <h2 className="text-xl font-semibold">Upload Excel - Customers & Deals</h2>
          <button
            onClick={resetModal}
            className="text-gray-400 hover:text-gray-600"
          >
            ✕
          </button>
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
              <span className="text-sm text-gray-600">
                Use the template to ensure correct format
              </span>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center ${
                dragActive ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
              }`}
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
            >
              <input
                type="file"
                accept=".xlsx"
                onChange={handleFileChange}
                className="hidden"
                id="excel-upload"
              />
              
              {file ? (
                <div>
                  <div className="text-green-600 mb-2">✅ {file.name}</div>
                  <button
                    onClick={() => document.getElementById('excel-upload').click()}
                    className="text-blue-500 hover:underline"
                  >
                    Choose different file
                  </button>
                </div>
              ) : (
                <div>
                  <div className="text-gray-500 mb-4">
                    Drag and drop your Excel file here, or click to browse
                  </div>
                  <button
                    onClick={() => document.getElementById('excel-upload').click()}
                    className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
                  >
                    Choose File
                  </button>
                </div>
              )}
            </div>

            <div className="mt-4 text-sm text-gray-600">
              <p className="font-semibold mb-2">Required Headers:</p>
              <p>Customer Name, Village, Taluka, District, Product, Department, Stage</p>
              <p className="mt-2">Optional: Bank Name, Branch Name, Contact Name, Amount, Closing Date, Address Type</p>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <button
                onClick={resetModal}
                className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={!file || uploading}
                className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 disabled:opacity-50"
              >
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </>
        ) : (
          <div>
            <div className={`p-4 rounded-lg mb-4 ${
              uploadResult.success > 0 ? 'bg-green-50 border border-green-200' : 'bg-yellow-50 border border-yellow-200'
            }`}>
              <h3 className="font-semibold mb-2">Upload Summary</h3>
              <div className="space-y-1 text-sm">
                <p>Total Rows: {uploadResult.totalRows}</p>
                <p className="text-green-600">✅ Successful: {uploadResult.success}</p>
                <p className="text-red-600">❌ Failed: {uploadResult.failed}</p>
              </div>
            </div>

            {uploadResult.errors && uploadResult.errors.length > 0 && (
              <div className="mb-4">
                <h4 className="font-semibold text-red-600 mb-2">Errors:</h4>
                <div className="max-h-40 overflow-y-auto bg-red-50 border border-red-200 rounded p-2">
                  {uploadResult.errors.map((error, index) => (
                    <div key={index} className="text-sm text-red-700">{error}</div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={resetModal}
                className="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
              >
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerExcelUploadModal;

'use client';

import { useState, useEffect } from 'react';
import { X, Save, Download, Eye, Plus, Edit, Trash2, Search, Package, DollarSign, Tag, Calendar, User, Building, CreditCard, FileText } from 'lucide-react';
import { invoiceService } from '@/services/invoiceService';
import InvoiceForm from './InvoiceForm';
import InvoicePreview from './InvoicePreview.jsx';
import { useToast } from '@/components/common/ToastProvider';

export default function InvoiceModal({ isOpen, onClose, initialData, onSave }) {
  const [activeTab, setActiveTab] = useState('form');
  const [loading, setLoading] = useState(false);
  const [currentInvoiceData, setCurrentInvoiceData] = useState(initialData || {});
  const { addToast } = useToast();

  // Update currentInvoiceData when initialData changes
  useEffect(() => {
    setCurrentInvoiceData(initialData || {});
  }, [initialData]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Background blur overlay */}
      <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md" onClick={onClose} />
      
      {/* Modal container */}
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="relative bg-white rounded-2xl max-w-7xl w-full max-h-[95vh] overflow-hidden shadow-2xl">
          
          {/* Modal Header */}
          <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white p-6">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-4">
                <div className="bg-white/20 backdrop-blur-sm rounded-xl p-3">
                  <FileText className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">
                    {initialData ? 'Edit Invoice' : 'Create New Invoice'}
                  </h2>
                  <p className="text-white/80">
                    {initialData ? 'Modify invoice details and items' : 'Fill in the details to generate a professional invoice'}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-all duration-200 backdrop-blur-sm"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Tab Navigation */}
          <div className="bg-gray-50 border-b">
            <div className="flex">
              <button
                onClick={() => setActiveTab('form')}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-all duration-200 ${
                  activeTab === 'form'
                    ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Edit className="h-4 w-4" />
                Invoice Details
              </button>
              <button
                onClick={() => setActiveTab('preview')}
                className={`flex items-center gap-2 px-6 py-3 font-medium transition-all duration-200 ${
                  activeTab === 'preview'
                    ? 'bg-white text-indigo-600 border-b-2 border-indigo-600'
                    : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                }`}
              >
                <Eye className="h-4 w-4" />
                Preview
              </button>
            </div>
          </div>

          {/* Modal Content */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: 'calc(95vh - 180px)' }}>
            {activeTab === 'form' ? (
              <div className="p-6">
                <InvoiceForm
                  initialData={initialData}
                  onChange={setCurrentInvoiceData}
                  onSave={async (data) => {
                    setCurrentInvoiceData(data); // Update preview data
                    try {
                      await onSave(data);
                      onClose();
                    } catch (error) {
                      // Error is already handled by parent with toast
                      console.error('Save failed in modal:', error);
                    }
                  }}
                  onCancel={onClose}
                />
              </div>
            ) : (
              <div className="p-6">
                <InvoicePreview 
                  data={currentInvoiceData || {
                    invoiceNo: '',
                    invoiceDate: new Date(),
                    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
                    isProForma: false,
                    includeGst: true,
                    billedByName: '',
                    billedByAddress: '',
                    billedByEmail: '',
                    gstin: '',
                    pan: '',
                    billedToName: '',
                    billedToAddress: '',
                    billedToGstin: '',
                    billedToMobile: '',
                    billedToEmail: '',
                    billedToBranch: '',
                    selectedBankName: '',
                    selectedBranch: '',
                    selectedCustomer: null,
                    accountName: '',
                    accountNumber: '',
                    ifsc: '',
                    accountType: '',
                    bank: '',
                    upiId: '',
                    terms: '',
                    items: [],
                    subtotal: 0,
                    cgst: 0,
                    sgst: 0,
                    grandTotal: 0,
                    amountInWords: 'ZERO'
                  }} 
                />
              </div>
            )}
          </div>

          {/* Modal Footer Actions */}
          <div className="bg-gray-50 border-t p-6">
            <div className="flex justify-end items-center">
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-xl hover:bg-gray-300 transition-all duration-200"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    // This will trigger the form submission
                    const form = document.querySelector('#invoice-form');
                    if (form) {
                      form.dispatchEvent(new Event('submit', { cancelable: true }));
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
                >
                  <Save className="h-4 w-4" />
                  {initialData ? 'Update Invoice' : 'Create Invoice'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Plus, Eye, Download, Edit, Trash2, Search, Filter, FileText, X, Mail } from 'lucide-react';
import InvoiceModal from '@/components/expenses/invoices/InvoiceModal';
import InvoicePreview from '@/components/expenses/invoices/InvoicePreview';
import { invoiceService } from '@/services/invoiceService';
import { generateInvoicePdf } from '@/utils/pdfGenerator';
import { toast } from 'react-toastify';

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailData, setEmailData] = useState(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const itemsPerPage = 10;

  useEffect(() => {
    loadInvoices();
  }, []);

  async function loadInvoices() {
    try {
      setLoading(true);
      const response = await invoiceService.getInvoices({
        page: currentPage,
        size: itemsPerPage,
        search: searchTerm
      });
      setInvoices(response.content || []);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      toast.error('Failed to load invoices. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }

  async function loadInvoiceDetails(invoiceId) {
    try {
      setLoading(true);
      const invoiceDetails = await invoiceService.getInvoiceById(invoiceId);
      setEditingInvoice(invoiceDetails);
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load invoice details:', error);
      toast.error('Failed to load invoice details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this invoice? This action cannot be undone.')) return;
    try {
      await invoiceService.deleteInvoice(id);
      setInvoices(prev => prev.filter(inv => inv.id !== id));
      toast.success('Invoice deleted successfully!');
    } catch (err) {
      console.error('Failed to delete invoice', err);
      toast.error('Failed to delete invoice. Please try again.');
    }
  }

  async function loadInvoiceDetails(invoiceId) {
    try {
      setLoading(true);
      const invoiceDetails = await invoiceService.getInvoiceById(invoiceId);
      console.log('Loaded invoice details:', invoiceDetails);
      setEditingInvoice(invoiceDetails);
      setShowEditModal(true);
    } catch (error) {
      console.error('Failed to load invoice details:', error);
      toast.error('Failed to load invoice details. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateInvoice(invoiceData) {
    try {
      const newInvoice = await invoiceService.createInvoice(invoiceData);
      setInvoices(prev => [newInvoice, ...prev]);
      setShowCreateModal(false);
      toast.success(`Invoice ${newInvoice.invoiceNo} created successfully!`);
    } catch (err) {
      console.error('Failed to create invoice', err);
      toast.error('Failed to create invoice. Please check your data and try again.');
    }
  }

  async function handleUpdateInvoice(invoiceData) {
    try {
      const updatedInvoice = await invoiceService.updateInvoice(editingInvoice.id, invoiceData);
      setInvoices(prev => prev.map(inv => inv.id === editingInvoice.id ? updatedInvoice : inv));
      setShowEditModal(false);
      setEditingInvoice(null);
      toast.success(`Invoice ${updatedInvoice.invoiceNo} updated successfully!`);
    } catch (err) {
      console.error('Failed to update invoice', err);
      toast.error('Failed to update invoice. Please check your data and try again.');
    }
  }
  
  // � Download invoice PDF
  const downloadInvoice = async (invoiceId, invoiceNo) => {
    try {
      const response = await fetch(`http://localhost:8080/api/invoices/${invoiceId}/pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`,
          'X-User-Id': (() => {
            if (typeof window === 'undefined') return null;
            try {
              const userStr = localStorage.getItem('user');
              return userStr ? JSON.parse(userStr).id : null;
            } catch {
              return null;
            }
          })()
        }
      });

      if (!response.ok) {
        throw new Error('Failed to download PDF');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Invoice_${invoiceNo}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      
      toast.success(`Invoice ${invoiceNo} downloaded successfully!`);
    } catch (error) {
      console.error('Failed to download invoice:', error);
      toast.error('Failed to download invoice. Please try again.');
    }
  };

  // 📧 Email invoice functions
  const openEmailModal = (invoice) => {
    setEmailData({
      invoiceId: invoice.id,
      customerName: invoice.billedToName,
      email: invoice.billedToEmail,
      invoiceNo: invoice.invoiceNo,
      amount: invoice.grandTotal
    });
    setShowEmailModal(true);
  };
  
  const closeEmailModal = () => {
    setShowEmailModal(false);
    setEmailData(null);
  };
  
  const sendInvoiceEmail = async () => {
    if (!emailData?.invoiceId) return;
    
    setIsSendingEmail(true);
    try {
      const response = await invoiceService.sendInvoiceEmail(emailData.invoiceId);
      
      if (response.success) {
        toast.success(`📧 Invoice ${emailData.invoiceNo} sent successfully to ${emailData.email}!`, {
          position: "top-right",
          autoClose: 4000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "light"
        });
        
        // Update invoice status to SENT in list
        setInvoices(prev => prev.map(inv => 
          inv.id === emailData.invoiceId 
            ? { ...inv, status: 'SENT', sentAt: new Date().toISOString() }
            : inv
        ));
        
        closeEmailModal();
      } else {
        toast.error(`❌ Failed to send invoice: ${response.message || 'Unknown error'}`, {
          position: "top-right",
          autoClose: 5000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "light"
        });
      }
    } catch (err) {
      console.error('Failed to send invoice email:', err);
      toast.error(`❌ Failed to send invoice. Please check your connection and try again.`, {
        position: "top-right",
        autoClose: 5000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light"
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoiceNo?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.billedToName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.billedByName?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
  const paginatedInvoices = filteredInvoices.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const summary = {
    total: invoices.length,
    thisMonth: invoices.filter(inv => {
      const invDate = new Date(inv.invoiceDate);
      const now = new Date();
      return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear();
    }).length,
    totalAmount: invoices.reduce((sum, inv) => sum + (inv.grandTotal || 0), 0),
    pending: invoices.filter(inv => inv.status === 'PENDING').length,
  };

  return (
    <DashboardLayout header={{ title: 'Invoices' }}>
      <div className="space-y-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Invoices</h3>
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">This Month</h3>
            <p className="text-2xl font-bold text-gray-900">{summary.thisMonth}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Total Amount</h3>
            <p className="text-2xl font-bold text-gray-900">₹{summary.totalAmount.toLocaleString('en-IN')}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-sm font-medium text-gray-500">Pending</h3>
            <p className="text-2xl font-bold text-gray-900">{summary.pending}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 flex-1">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 w-full"
              />
            </div>
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50">
              <Filter className="h-4 w-4" />
              Filter
            </button>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-lg hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 shadow-lg"
          >
            <Plus className="h-4 w-4" />
            New Invoice
          </button>
        </div>

        {/* Invoices Table */}
        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Invoice No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Billed To
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
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
                {loading ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      Loading...
                    </td>
                  </tr>
                ) : paginatedInvoices.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-gray-500">
                      No invoices found
                    </td>
                  </tr>
                ) : (
                  paginatedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {invoice.invoiceNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(invoice.invoiceDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {invoice.billedToName}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ₹{invoice.grandTotal?.toLocaleString('en-IN') || 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          invoice.status === 'PAID' 
                            ? 'bg-green-100 text-green-800'
                            : invoice.status === 'PENDING'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {invoice.status || 'DRAFT'}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowPreviewModal(true);
                          }}
                          className="text-indigo-600 hover:text-indigo-900"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            loadInvoiceDetails(invoice.id);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => downloadInvoice(invoice.id, invoice.invoiceNo)}
                          className="text-green-600 hover:text-green-900"
                        >
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => openEmailModal(invoice)}
                          className={`${
                            invoice.status === 'SENT' 
                              ? 'text-gray-400 cursor-not-allowed' 
                              : 'text-purple-600 hover:text-purple-900'
                          }`}
                          disabled={invoice.status === 'SENT' || isSendingEmail}
                          title={invoice.status === 'SENT' ? 'Invoice already sent' : 'Send invoice'}
                        >
                          {isSendingEmail && emailData?.invoiceId === invoice.id ? (
                            <div className="w-4 h-4 border-2 border-purple-600 border-t-transparent rounded-full animate-spin"></div>
                          ) : (
                            <Mail className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleDelete(invoice.id)}
                          className="text-red-600 hover:text-red-900"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
              <div className="flex-1 flex justify-between sm:hidden">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
              <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm text-gray-700">
                    Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                    <span className="font-medium">{Math.min(currentPage * itemsPerPage, filteredInvoices.length)}</span> of{' '}
                    <span className="font-medium">{filteredInvoices.length}</span> results
                  </p>
                </div>
                <div>
                  <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                    <button
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Previous
                    </button>
                    {[...Array(totalPages)].map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPage(i + 1)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          currentPage === i + 1
                            ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={currentPage === totalPages}
                      className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                    >
                      Next
                    </button>
                  </nav>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invoice Modals */}
      <InvoiceModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSave={handleCreateInvoice}
      />

      <InvoiceModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingInvoice(null);
        }}
        initialData={editingInvoice}
        onSave={handleUpdateInvoice}
      />

      {/* Preview Modal */}
      {showPreviewModal && selectedInvoice && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="fixed inset-0 bg-black bg-opacity-50 backdrop-blur-md" onClick={() => setShowPreviewModal(false)} />
          <div className="flex min-h-screen items-center justify-center p-4 relative">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden relative z-10">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-4 rounded-t-xl flex justify-between items-center">
                <h2 className="text-xl font-bold">Invoice Preview</h2>
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="text-white hover:text-gray-200 transition-colors"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Preview Content */}
              <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(90vh - 80px)' }}>
                <InvoicePreview data={selectedInvoice} />
              </div>

              {/* Modal Footer */}
              <div className="bg-gray-50 border-t px-6 py-4 rounded-b-xl flex justify-end gap-3">
                <button
                  onClick={() => setShowPreviewModal(false)}
                  className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  <X className="h-4 w-4" />
                  Close
                </button>
                <button
                  onClick={async () => {
                    try {
                      const pdfBlob = await generateInvoicePdf(selectedInvoice);
                      const url = window.URL.createObjectURL(pdfBlob);
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `Invoice_${selectedInvoice.invoiceNo || 'Draft'}.pdf`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      window.URL.revokeObjectURL(url);
                      toast.success(`Invoice ${selectedInvoice.invoiceNo} PDF downloaded successfully!`);
                    } catch (error) {
                      console.error('Failed to generate PDF:', error);
                      toast.error('Failed to generate PDF. Please try again.');
                    }
                  }}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                >
                  <Download className="h-4 w-4" />
                  Download PDF
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 📧 Professional Email Confirmation Modal */}
      {showEmailModal && emailData && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          {/* Enhanced backdrop with better blur */}
          <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm" 
            onClick={closeEmailModal}
            style={{ backdropFilter: 'blur(8px)' }}
          />
          <div className="flex min-h-screen items-center justify-center p-4 relative">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg relative z-10 transform transition-all duration-300 ease-out">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 text-white px-6 py-5 rounded-t-2xl flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                    <Mail className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Send Invoice</h3>
                    <p className="text-sm text-white/80">Confirm invoice details before sending</p>
                  </div>
                </div>
                <button
                  onClick={closeEmailModal}
                  className="text-white/80 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6 space-y-5">
                {/* Invoice Summary Card */}
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-gray-600">Invoice Number</p>
                      <p className="text-xl font-bold text-gray-900">{emailData.invoiceNo}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Amount</p>
                      <p className="text-2xl font-bold text-green-600">₹{emailData.amount?.toLocaleString('en-IN') || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Recipient Details */}
                <div className="space-y-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-blue-600">👤</span>
                      </div>
                      Customer Name
                    </label>
                    <div className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-medium">
                      {emailData.customerName}
                    </div>
                  </div>
                  
                  <div className="bg-gray-50 rounded-lg p-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
                      <div className="w-6 h-6 bg-green-100 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-green-600">✉️</span>
                      </div>
                      Email Address
                    </label>
                    <div className="w-full px-4 py-3 bg-white border border-gray-200 rounded-lg text-gray-800 font-medium">
                      {emailData.email}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={closeEmailModal}
                    disabled={isSendingEmail}
                    className="flex-1 px-6 py-3 border-2 border-gray-300 text-gray-700 rounded-xl hover:bg-gray-50 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={sendInvoiceEmail}
                    disabled={isSendingEmail}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 transition-all font-semibold disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {isSendingEmail ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Mail className="h-4 w-4" />
                        Send Invoice
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

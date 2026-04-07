'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { backendApi } from '@/services/api';
import {
  Eye,
  Trash2,
  Check,
  X,
  IndianRupee,
  Plus,
  XCircle,
  Download,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

const BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.yashrajent.com';

export default function ExpenseOverviewPage() {

  const [activeTab, setActiveTab] = useState('overview');
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [clients, setClients] = useState([]);
  const [clientProducts, setClientProducts] = useState([]);
  const [clientDealId, setClientDealId] = useState(null);
  const [dealStats, setDealStats] = useState({ totalDeals: 0, closeWin: 0, closeLost: 0, pending: 0 });
  const [productSales, setProductSales] = useState([]);
  const [productSalesOpen, setProductSalesOpen] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [saving, setSaving] = useState(false);
  const [filePreview, setFilePreview] = useState(null);
  const [selectedClientId, setSelectedClientId] = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [rejectModal, setRejectModal] = useState(null); // { id } when open
  const [rejectReason, setRejectReason] = useState('');
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportType, setExportType] = useState('all'); // 'all' | 'employee'
  const [exportEmployeeId, setExportEmployeeId] = useState('');
  const [exportFromDate, setExportFromDate] = useState('');
  const [exportToDate, setExportToDate] = useState('');

  // Get current user info for role-based filtering
  const [currentUser, setCurrentUser] = useState(null);

  // Function to get current user info
  function getCurrentUser() {
    try {
      const userData = localStorage.getItem("user_data") || 
                      localStorage.getItem("authUser") || 
                      localStorage.getItem("user") ||
                      sessionStorage.getItem("authUser") || 
                      sessionStorage.getItem("user");
      
      if (userData) {
        return JSON.parse(userData);
      }
    } catch (err) {
      console.error("Failed to get current user:", err);
    }
    return null;
  }

  useEffect(() => {
    const user = getCurrentUser();
    setCurrentUser(user);
    loadExpenses();
    loadEmployees();
    loadClients();
    loadDealStats();
    loadProductSales();
  }, []);

  async function loadExpenses() {
    try {
      setLoading(true);
      const data = await backendApi.get('/expenses');
      setExpenses(data || []);
    } catch (err) {
      console.error('Failed to load expenses', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadEmployees() {
    try {
      const res = await backendApi.get('/employees');
      setEmployees(res || []);
    } catch (err) {
      console.error("Failed to load employees", err);
    }
  }

  async function loadClients() {
    try {
      const res = await backendApi.get('/clients');
      setClients(Array.isArray(res) ? res : (res?.content || []));
    } catch (err) {
      console.error("Failed to load clients", err);
    }
  }

  async function loadDealStats() {
    try {
      const res = await backendApi.get('/deals?size=9999');
      const list = Array.isArray(res) ? res : (res?.content || []);
      setDealStats({
        totalDeals: list.length,
        closeWin:   list.filter(d => d.stageCode === 'CLOSE_WIN').length,
        closeLost:  list.filter(d => d.stageCode === 'CLOSE_LOST').length,
        pending:    list.filter(d => !['CLOSE_WIN','CLOSE_LOST'].includes(d.stageCode)).length,
      });
    } catch (err) {
      console.error('Failed to load deal stats', err);
    }
  }

  async function loadProductSales() {
    try {
      const res = await backendApi.get('/deals/products/sales-summary');
      setProductSales(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('Failed to load product sales', err);
    }
  }

  async function handleClientChange(clientId) {
    setSelectedClientId(clientId);
    setClientProducts([]);
    setClientDealId(null);
    if (!clientId) return;
    try {
      const deals = await backendApi.get(`/deals?clientId=${clientId}&size=9999`);
      const list = Array.isArray(deals) ? deals : (deals?.content || []);
      const deal = list.sort((a, b) => (b.id || 0) - (a.id || 0))[0];
      if (!deal) return;
      setClientDealId(deal.id);
      const products = await backendApi.get(`/deals/${deal.id}/products`).catch(() => []);
      setClientProducts(Array.isArray(products) ? products : []);
    } catch (err) {
      console.error('Failed loading client products', err);
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);

    const file = formData.get("receipt");

    // File validation
    if(file && file.size > 5 * 1024 * 1024){
      alert("File must be under 5MB");
      return;
    }

    const clientId = formData.get("clientId");
    const selectedClient = clients.find(c => String(c.id) === String(clientId));

    const payload = {
      employeeId: formData.get("employeeId"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      expenseDate: formData.get("expenseDate"),
      status: formData.get("status"),
      clientId: clientId || null,
      clientName: selectedClient ? (selectedClient.name || selectedClient.clientName || selectedClient.companyName) : null
    };

    const uploadData = new FormData();

    uploadData.append("expense", JSON.stringify(payload));

    if(file && file.size > 0){
      uploadData.append("file", file);
    }

    try {
      setSaving(true);

      if(editExpense){
        await backendApi.put(`/expenses/${editExpense.id}`, uploadData,{
          headers:{ "Content-Type":"multipart/form-data" }
        });
      }else{
        await backendApi.post(`/expenses`, uploadData,{
          headers:{ "Content-Type":"multipart/form-data" }
        });
      }

      setShowFormModal(false);
      setEditExpense(null);
      setPreviewImage(null);
      setFilePreview(null);
      setSelectedClientId('');
      setClientProducts([]);
      setClientDealId(null);
      e.target.reset();
      loadExpenses();

    } catch(err){
      console.error("Failed saving expense", err);
    } finally {
      setSaving(false);
    }
  }

  async function handleBulkUpload(file) {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    setUploading(true);
    setUploadResult(null);
    try {
      const res = await backendApi.post('/expenses/bulk-upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      setUploadResult({ success: true, message: `Uploaded ${res.count || res.length || 'all'} expenses successfully` });
      loadExpenses();
    } catch (err) {
      setUploadResult({ success: false, message: err?.message || 'Upload failed' });
    } finally {
      setUploading(false);
    }
  }

  async function downloadTemplate() {
    const workbook = new ExcelJS.Workbook();
    const ws = workbook.addWorksheet('Expenses');
    ws.columns = [
      { header: 'Employee Name', key: 'employeeName', width: 20 },
      { header: 'Client Name', key: 'clientName', width: 20 },
      { header: 'Department', key: 'departmentName', width: 20 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Description', key: 'description', width: 30 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Expense Date (YYYY-MM-DD)', key: 'expenseDate', width: 25 },
      { header: 'Status', key: 'status', width: 15 },
    ];
    ws.addRow({ employeeName: 'John Doe', clientName: 'ABC Corp', departmentName: 'PPO', category: 'Travel', description: 'Client visit', amount: 500, expenseDate: '2024-01-15', status: 'PENDING' });
    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), 'expenses-template.xlsx');
  }

  async function handleDelete(id) {
    try {
      await backendApi.delete(`/expenses/${id}`);
      setExpenses(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Delete failed', err);
    }
  }

  async function handleApprove(id) {
    const updated = await backendApi.post(`/expenses/${id}/approve`);
    setExpenses(prev => prev.map(e => e.id === id ? updated : e));
  }

  async function handleReject(id, reason) {
    const updated = await backendApi.post(`/expenses/${id}/reject`, { reason });
    setExpenses(prev => prev.map(e => e.id === id ? updated : e));
    setRejectModal(null);
    setRejectReason('');
  }

  async function handlePaid(id) {
    const updated = await backendApi.post(`/expenses/${id}/mark-paid`);
    setExpenses(prev => prev.map(e => e.id === id ? updated : e));
  }

  const STATUS_COLORS = {
    PENDING:  { argb: 'FFFFF9C4' }, // yellow
    APPROVED: { argb: 'FFC8E6C9' }, // green
    PAID:     { argb: 'FFC8E6C9' }, // green
    REJECTED: { argb: 'FFFFCDD2' }, // red
  };

  async function exportExcel() {
    let rows = [...expenses];

    if (exportType === 'employee' && exportEmployeeId) {
      rows = rows.filter(e => String(e.employeeId) === String(exportEmployeeId));
    }
    if (exportFromDate) {
      rows = rows.filter(e => e.expenseDate && e.expenseDate >= exportFromDate);
    }
    if (exportToDate) {
      rows = rows.filter(e => e.expenseDate && e.expenseDate <= exportToDate);
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Expenses');

    worksheet.columns = [
      { header: 'Employee Name',    key: 'employeeName',    width: 22 },
      { header: 'Client Name',      key: 'clientName',      width: 20 },
      { header: 'Department',       key: 'departmentName',  width: 18 },
      { header: 'Category',         key: 'category',        width: 18 },
      { header: 'Description',      key: 'description',     width: 30 },
      { header: 'Amount (₹)',       key: 'amount',          width: 15 },
      { header: 'Date',             key: 'expenseDate',     width: 18 },
      { header: 'Status',           key: 'status',          width: 14 },
      { header: 'Rejection Reason', key: 'rejectionReason', width: 30 },
    ];

    // Style header row
    worksheet.getRow(1).eachCell(cell => {
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF3F51B5' } };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    // Group by employee name, sort each group by date
    const grouped = {};
    rows.forEach(e => {
      const key = e.employeeName || 'Unknown';
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(e);
    });
    const empNames = Object.keys(grouped).sort((a, b) => a.localeCompare(b));
    const summaryMap = {};

    empNames.forEach(empName => {
      const empRows = grouped[empName].slice().sort((a, b) =>
        (a.expenseDate || '').localeCompare(b.expenseDate || '')
      );

      // Blue employee name banner row
      const empHeaderRow = worksheet.addRow([`👤  ${empName}`, '', '', '', '', '', '', '', '']);
      worksheet.mergeCells(`A${empHeaderRow.number}:I${empHeaderRow.number}`);
      empHeaderRow.getCell(1).font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
      empHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1565C0' } };
      empHeaderRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      empHeaderRow.height = 20;

      // Data rows sorted by date
      empRows.forEach(expense => {
        const row = worksheet.addRow({
          employeeName:    expense.employeeName    || '',
          clientName:      expense.clientName      || '',
          departmentName:  expense.departmentName  || '',
          category:        expense.category        || '',
          description:     expense.description     || '',
          amount:          expense.amount          || 0,
          expenseDate:     expense.expenseDate     || '',
          status:          expense.status          || '',
          rejectionReason: expense.rejectionReason || '',
        });
        const fillColor = STATUS_COLORS[expense.status];
        if (fillColor) {
          const statusCell = row.getCell(8);
          statusCell.fill = { type: 'pattern', pattern: 'solid', fgColor: fillColor };
          statusCell.font = {
            bold: true,
            color: {
              argb: expense.status === 'PENDING'  ? 'FF795548' :
                    expense.status === 'REJECTED' ? 'FFB71C1C' : 'FF1B5E20'
            }
          };
        }
      });

      // Per-employee subtotal row
      const totalAmt    = empRows.reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const pending     = empRows.filter(e => e.status === 'PENDING').length;
      const paid        = empRows.filter(e => e.status === 'PAID' || e.status === 'APPROVED').length;
      const rejected    = empRows.filter(e => e.status === 'REJECTED').length;
      const pendingAmt  = empRows.filter(e => e.status === 'PENDING').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const paidAmt     = empRows.filter(e => e.status === 'PAID' || e.status === 'APPROVED').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      const rejectedAmt = empRows.filter(e => e.status === 'REJECTED').reduce((s, e) => s + (Number(e.amount) || 0), 0);
      summaryMap[empName] = { pending, paid, rejected, pendingAmt, paidAmt, rejectedAmt };

      const subtotalRow = worksheet.addRow([
        `Subtotal — ${empName}`, '', '', '',
        `${empRows.length} expense(s)`,
        totalAmt, '',
        `P:${pending}  ✓:${paid}  ✗:${rejected}`, '',
      ]);
      subtotalRow.eachCell(cell => {
        cell.font = { bold: true, italic: true, color: { argb: 'FF1A237E' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8EAF6' } };
      });
      subtotalRow.getCell(6).numFmt = '#,##0.00';

      worksheet.addRow([]); // blank separator between employees
    });

    // Employee-wise summary section at the bottom
    if (empNames.length > 0) {
      worksheet.addRow([]);
      worksheet.getColumn(10).width = 22;
      worksheet.getColumn(11).width = 26;

      const summaryHeaderRow = worksheet.addRow([
        'EMPLOYEE-WISE SUMMARY', '', '', '', '',
        'Pending Count', 'Pending Amount (₹)',
        'Paid/Approved Count', 'Paid/Approved Amount (₹)',
        'Rejected Count', 'Rejected Amount (₹)',
      ]);
      summaryHeaderRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF37474F' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      });

      empNames.forEach(name => {
        const s = summaryMap[name];
        const dataRow = worksheet.addRow([
          name, '', '', '', '',
          s.pending, s.pendingAmt,
          s.paid,    s.paidAmt,
          s.rejected, s.rejectedAmt,
        ]);
        dataRow.getCell(1).font = { bold: true };
        [6, 7].forEach(col => {
          dataRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF9C4' } };
          dataRow.getCell(col).font = { color: { argb: 'FF795548' }, bold: true };
          dataRow.getCell(col).alignment = { horizontal: 'center' };
        });
        [8, 9].forEach(col => {
          dataRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFC8E6C9' } };
          dataRow.getCell(col).font = { color: { argb: 'FF1B5E20' }, bold: true };
          dataRow.getCell(col).alignment = { horizontal: 'center' };
        });
        [10, 11].forEach(col => {
          dataRow.getCell(col).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFCDD2' } };
          dataRow.getCell(col).font = { color: { argb: 'FFB71C1C' }, bold: true };
          dataRow.getCell(col).alignment = { horizontal: 'center' };
        });
      });

      const totals = empNames.reduce((acc, name) => {
        const s = summaryMap[name];
        acc.pending += s.pending; acc.pendingAmt += s.pendingAmt;
        acc.paid    += s.paid;    acc.paidAmt    += s.paidAmt;
        acc.rejected += s.rejected; acc.rejectedAmt += s.rejectedAmt;
        return acc;
      }, { pending: 0, pendingAmt: 0, paid: 0, paidAmt: 0, rejected: 0, rejectedAmt: 0 });

      const totalRow = worksheet.addRow([
        'GRAND TOTAL', '', '', '', '',
        totals.pending, totals.pendingAmt,
        totals.paid,    totals.paidAmt,
        totals.rejected, totals.rejectedAmt,
      ]);
      totalRow.eachCell(cell => {
        cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1A237E' } };
        cell.alignment = { horizontal: 'center' };
      });
    }

    // Filename: employee name + date range
    const empLabel = exportType === 'employee' && exportEmployeeId
      ? (employees.find(e => String(e.id) === String(exportEmployeeId))?.firstName || 'employee')
      : 'all';
    const dateLabel = `${exportFromDate || 'start'}_to_${exportToDate || 'end'}`;

    const buffer = await workbook.xlsx.writeBuffer();
    saveAs(
      new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
      `expenses_${empLabel}_${dateLabel}.xlsx`
    );
    setShowExportModal(false);
  }

  const summary = {
    pending:  { count: expenses.filter(e => e.status === 'PENDING').length,  amount: expenses.filter(e => e.status === 'PENDING').reduce((s, e) => s + Number(e.amount || 0), 0) },
    approved: { count: expenses.filter(e => e.status === 'APPROVED').length, amount: expenses.filter(e => e.status === 'APPROVED').reduce((s, e) => s + Number(e.amount || 0), 0) },
    rejected: { count: expenses.filter(e => e.status === 'REJECTED').length, amount: expenses.filter(e => e.status === 'REJECTED').reduce((s, e) => s + Number(e.amount || 0), 0) },
    paid:     { count: expenses.filter(e => e.status === 'PAID').length,     amount: expenses.filter(e => e.status === 'PAID').reduce((s, e) => s + Number(e.amount || 0), 0) },
  };

  const totalExpenseAmount = useMemo(() =>
    expenses.reduce((sum, e) => sum + Number(e.amount || 0), 0)
  , [expenses]);

  const productSummary = useMemo(() => {
    let totalQty = 0, totalPrice = 0;
    clientProducts.forEach(p => {
      const qty   = Number(p.quantity || p.qty || 1);
      const price = Number(p.unitPrice || p.price || p.totalPrice || 0);
      totalQty   += qty;
      totalPrice += qty * price;
    });
    return { totalQty, totalPrice };
  }, [clientProducts]);

  const filtered = expenses.filter(e => {
    const searchMatch = 
      e.employeeName?.toLowerCase().includes(search.toLowerCase()) ||
      e.category?.toLowerCase().includes(search.toLowerCase());
    
    const statusMatch = !statusFilter || e.status === statusFilter;
    
    return searchMatch && statusMatch;
  });

  const paginatedExpenses = filtered.slice((page-1)*pageSize, page*pageSize);

  return (
    <DashboardLayout>

      <div className="space-y-6">

        {/* HEADER */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">Expenses</h1>
            <p className="text-sm text-gray-500">
              {currentUser?.roleName === 'TL' 
                ? `Manage ${currentUser?.department || 'your department'} expenses`
                : 'Manage employee expenses across departments'
              }
            </p>
            {currentUser && (
              <p className="text-xs text-gray-400 mt-1">
                Logged in as: {currentUser.name || currentUser.firstName + ' ' + currentUser.lastName} 
                ({currentUser.roleName || currentUser.role}) 
                {currentUser.department && ` - ${currentUser.department}`}
              </p>
            )}
          </div>

          <button
            onClick={()=>{
              setEditExpense(null);
              setFilePreview(null);
              setSelectedClientId('');
              setClientProducts([]);
              setClientDealId(null);
              setShowFormModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700"
          >
            <Plus size={16}/>
            Add Expense
          </button>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <Card title="Pending"  count={summary.pending.count}  amount={summary.pending.amount}  color="yellow"/>
          <Card title="Approved" count={summary.approved.count} amount={summary.approved.amount} color="green"/>
          <Card title="Rejected" count={summary.rejected.count} amount={summary.rejected.amount} color="red"/>
          <Card title="Paid"     count={summary.paid.count}     amount={summary.paid.amount}     color="blue"/>
          <div className="bg-indigo-600 text-white rounded-lg p-4 flex flex-col justify-between">
            <div className="text-sm opacity-80">Total Expenses</div>
            <div className="text-xl font-bold mt-1">₹{totalExpenseAmount.toLocaleString('en-IN')}</div>
            <div className="text-xs opacity-70 mt-1">{expenses.length} record{expenses.length !== 1 ? 's' : ''}</div>
          </div>
        </div>

        {/* PRODUCT SALES STATS - collapsible */}
        <div className="bg-white border rounded-lg overflow-hidden">
          <button
            onClick={() => setProductSalesOpen(o => !o)}
            className="w-full px-5 py-3 border-b bg-gray-50 flex items-center justify-between hover:bg-gray-100 transition-colors"
          >
            <div className="text-left">
              <h2 className="text-sm font-semibold text-gray-800">Product Sales Summary</h2>
              <p className="text-xs text-gray-400 mt-0.5">Total products sold across all customer deals</p>
            </div>
            <span className="text-gray-400 text-sm">{productSalesOpen ? '▲' : '▼'}</span>
          </button>

          {productSalesOpen && (
            productSales.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">No product sales data yet.</div>
            ) : (
              <div className="overflow-auto max-h-64">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500 tracking-wider sticky top-0">
                    <tr>
                      <th className="px-5 py-3 text-left">#</th>
                      <th className="px-5 py-3 text-left">Product Name</th>
                      <th className="px-5 py-3 text-right">Deals</th>
                      <th className="px-5 py-3 text-right">Total Qty</th>
                      <th className="px-5 py-3 text-right">Total Price</th>
                    </tr>
                  </thead>
                  <tbody>
                    {productSales.map((p, i) => (
                      <tr key={i} className="border-t hover:bg-gray-50">
                        <td className="px-5 py-2 text-gray-400">{i + 1}</td>
                        <td className="px-5 py-2 font-medium text-gray-800">{p.productName || '—'}</td>
                        <td className="px-5 py-2 text-right">
                          <span className="bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full text-xs font-semibold">
                            {Number(p.dealCount).toLocaleString()}
                          </span>
                        </td>
                        <td className="px-5 py-2 text-right font-semibold text-gray-700">{Number(p.totalQty).toLocaleString()}</td>
                        <td className="px-5 py-2 text-right font-semibold text-green-600">
                          ₹{Number(p.totalPrice || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t bg-indigo-50 font-semibold">
                      <td className="px-5 py-2" colSpan={2}>Total</td>
                      <td className="px-5 py-2 text-right text-indigo-700">{productSales.reduce((s, p) => s + Number(p.dealCount || 0), 0).toLocaleString()}</td>
                      <td className="px-5 py-2 text-right text-gray-700">{productSales.reduce((s, p) => s + Number(p.totalQty || 0), 0).toLocaleString()}</td>
                      <td className="px-5 py-2 text-right text-green-700">₹{productSales.reduce((s, p) => s + Number(p.totalPrice || 0), 0).toLocaleString('en-IN')}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )
          )}
        </div>

        {/* SEARCH */}
        <div className="bg-white border rounded-lg p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
          <div className="flex flex-col md:flex-row gap-3 flex-1">
            <input
              type="text"
              placeholder="Search employee or category..."
              value={search}
              onChange={(e)=>{
              setSearch(e.target.value);
              setPage(1);
            }}
              className="border rounded-md px-3 py-2 text-sm w-full md:w-72"
            />
            
            <select
              value={statusFilter}
              onChange={(e)=>{
              setStatusFilter(e.target.value);
              setPage(1);
            }}
              className="border px-3 py-2 rounded text-sm"
            >
              <option value="">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
              <option value="PAID">Paid</option>
            </select>
          </div>
          
          <button
            onClick={() => setShowExportModal(true)}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
          >
            <Download size={16}/>
            Export Excel
          </button>
          <button
            onClick={() => { setShowUploadModal(true); setUploadResult(null); }}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700"
          >
            <Download size={16} className="rotate-180"/>
            Upload Excel
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-white border rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-gray-500">Loading expenses...</div>
          ) : (
            <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 380px)' }}>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Client</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Evidence</th>
                  <th className="p-3 text-left">Status</th>
                  <th className="p-3 text-left">Rejection Reason</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>

              <tbody>

                {paginatedExpenses.map(e => (

                  <tr key={e.id} className="border-b hover:bg-gray-50">

                    {/* EMPLOYEE */}
                    <td className="p-3">
                      <div className="flex items-center gap-3">

                        <div className="h-9 w-9 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-semibold">
                          {e.employeeName?.charAt(0) || "U"}
                        </div>

                        <div>
                          <div className="font-medium">
                            {e.employeeName || "Unknown"}
                          </div>

                          <div className="text-xs text-gray-500">
                            {e.departmentName || "Department"}
                          </div>
                        </div>

                      </div>
                    </td>

                    {/* CATEGORY */}
                    <td className="p-3">
                      <span className="text-xs text-gray-600">{e.clientName || '-'}</span>
                    </td>

                    {/* CATEGORY */}
                    <td className="p-3">
                      <span className="bg-indigo-100 text-indigo-600 px-2 py-1 rounded text-xs">
                        {e.category}
                      </span>
                    </td>

                    {/* AMOUNT */}
                    <td className="p-3 font-semibold text-green-600">
                      ₹{Number(e.amount).toLocaleString()}
                    </td>

                    {/* DATE */}
                    <td className="p-3">
                      {e.expenseDate ? new Date(e.expenseDate).toLocaleDateString() : "-"}
                    </td>

                    {/* EVIDENCE */}
                    <td className="p-3">

                      {e.receiptUrl ? (

                        e.receiptUrl.match(/\.(jpg|jpeg|png)$/i) ?

                          <img
                            src={`${BASE_URL}${e.receiptUrl}`}
                            onClick={() => setPreviewImage(e.receiptUrl)}
                            className="w-10 h-10 rounded object-cover border cursor-pointer"
                          />

                          :

                          <a
                            href={`${BASE_URL}${e.receiptUrl}`}
                            target="_blank"
                            className="text-indigo-600 text-xs underline"
                          >
                            View
                          </a>

                      ) : (
                        <span className="text-gray-400 text-xs">
                          None
                        </span>
                      )}

                    </td>

                    {/* STATUS */}
                    <td className="p-3">
                      <StatusBadge status={e.status}/>
                    </td>

                    {/* REJECTION REASON */}
                    <td className="p-3">
                      {e.rejectionReason ? (
                        <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">{e.rejectionReason}</span>
                      ) : (
                        <span className="text-xs text-gray-400">-</span>
                      )}
                    </td>

                    {/* ACTIONS */}
                    <td className="p-3">

                      <div className="flex justify-end gap-2">

                        <button
                          onClick={()=>{
                            setEditExpense(e);
                            setFilePreview(null);
                            setSelectedClientId(e.clientId || '');
                            setClientProducts([]);
                            setClientDealId(null);
                            setShowFormModal(true);
                          }}
                          className="p-2 bg-gray-100 rounded"
                        >
                          <Eye size={14}/>
                        </button>

                        {e.status === "PENDING" && (
                          <>
                            <button onClick={()=>handleApprove(e.id)} className="p-2 bg-green-100 text-green-700 rounded">
                              <Check size={14}/>
                            </button>

                            <button onClick={()=>{ setRejectModal({ id: e.id }); setRejectReason(''); }} className="p-2 bg-red-100 text-red-700 rounded">
                              <X size={14}/>
                            </button>
                          </>
                        )}

                        {e.status === "APPROVED" && (
                          <button onClick={()=>handlePaid(e.id)} className="p-2 bg-blue-100 text-blue-700 rounded">
                            <IndianRupee size={14}/>
                          </button>
                        )}

                        <button onClick={()=>handleDelete(e.id)} className="p-2 bg-red-100 text-red-700 rounded">
                          <Trash2 size={14}/>
                        </button>

                      </div>

                    </td>

                  </tr>

                ))}

              </tbody>

            </table>

            </div>
          )}

        </div>

        {/* PAGINATION */}
        {filtered.length > pageSize && (
          <div className="bg-white border rounded-lg p-4 flex justify-between items-center">
            <div className="text-sm text-gray-600">
              Showing {((page-1)*pageSize)+1} to {Math.min(page*pageSize, filtered.length)} of {filtered.length} expenses
            </div>
            <div className="flex gap-2">
              <button
                onClick={()=>setPage(page-1)}
                disabled={page===1}
                className="flex items-center gap-2 px-3 py-2 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                <ChevronLeft size={16}/>
                Previous
              </button>
              <span className="px-3 py-2 border rounded text-sm bg-gray-50">
                Page {page}
              </span>
              <button
                onClick={()=>setPage(page+1)}
                disabled={page*pageSize >= filtered.length}
                className="flex items-center gap-2 px-3 py-2 border rounded text-sm disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50"
              >
                Next
                <ChevronRight size={16}/>
              </button>
            </div>
          </div>
        )}

      </div>

      {/* IMAGE MODAL */}
      {previewImage && (

        <div className="fixed inset-0 z-50 flex items-center justify-center">

          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={()=>setPreviewImage(null)}
          />

          <div className="relative w-[80vw] max-h-[90vh] bg-white rounded-lg shadow-lg overflow-auto p-6">

            <button
              onClick={()=>setPreviewImage(null)}
              className="absolute top-4 right-4"
            >
              <XCircle size={24}/>
            </button>

            <img
              src={`${BASE_URL}${previewImage}`}
              className="w-full object-contain"
            />

          </div>

        </div>

      )}

      {/* FORM MODAL */}
      {showFormModal && (

        <div className="fixed inset-0 z-50 flex items-center justify-center">

          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={()=>setShowFormModal(false)}
          />

          <div className="relative bg-white rounded-lg shadow-lg w-[500px] p-6">

            <button
              onClick={()=>setShowFormModal(false)}
              className="absolute top-3 right-3"
            >
              <XCircle size={22}/>
            </button>

            <h2 className="text-lg font-semibold mb-4">
              {editExpense ? "Edit Expense" : "Add Expense"}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3 max-h-[70vh] overflow-y-auto pr-1" key={editExpense?.id || "new"}>

              {/* Employee */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Employee *</label>
                <select
                  name="employeeId"
                  defaultValue={editExpense?.employeeId || ""}
                  required
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">Select Employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} — {emp.departmentName || emp.tlDepartmentName || emp.department || 'No Dept'} ({emp.roleName})
                    </option>
                  ))}
                </select>
              </div>

              {/* Client */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Client (optional)</label>
                <select
                  name="clientId"
                  value={selectedClientId}
                  onChange={e => handleClientChange(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">No Client</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name || c.clientName || c.companyName}
                    </option>
                  ))}
                </select>
                {selectedClientId && clientProducts.length > 0 && (
                  <div className="mt-2 p-2 bg-indigo-50 rounded text-xs text-indigo-700 flex gap-4">
                    <span>Products: <b>{productSummary.totalQty}</b></span>
                    <span>Total Value: <b>₹{productSummary.totalPrice.toLocaleString('en-IN')}</b></span>
                  </div>
                )}
                {selectedClientId && clientProducts.length === 0 && clientDealId && (
                  <p className="text-xs text-gray-400 mt-1">No products linked to this client's deal.</p>
                )}
              </div>

              {/* Category + Amount */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Category *</label>
                  <input
                    name="category"
                    defaultValue={editExpense?.category || ""}
                    placeholder="e.g. Travel"
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Amount (₹) *</label>
                  <input
                    name="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editExpense?.amount || ""}
                    placeholder="0.00"
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Description</label>
                <textarea
                  name="description"
                  defaultValue={editExpense?.description || ""}
                  placeholder="Brief description..."
                  rows={2}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>

              {/* Date + Status */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Date *</label>
                  <input
                    name="expenseDate"
                    type="date"
                    defaultValue={editExpense?.expenseDate || ""}
                    required
                    className="w-full border rounded px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Status</label>
                  <select
                    name="status"
                    defaultValue={editExpense?.status || "PENDING"}
                    className="w-full border rounded px-3 py-2 text-sm"
                  >
                    <option value="PENDING">Pending</option>
                    <option value="APPROVED">Approved</option>
                    <option value="REJECTED">Rejected</option>
                    <option value="PAID">Paid</option>
                  </select>
                </div>
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-xs text-gray-500 mb-1">Evidence / Receipt</label>
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
                  <input
                    name="receipt"
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files[0];
                      if (f && f.type.startsWith('image/')) {
                        setFilePreview(URL.createObjectURL(f));
                      } else {
                        setFilePreview(f ? f.name : null);
                      }
                    }}
                  />
                  {filePreview ? (
                    filePreview.startsWith('blob:') ? (
                      <img src={filePreview} className="h-20 object-contain rounded" />
                    ) : (
                      <span className="text-sm text-indigo-600">{filePreview}</span>
                    )
                  ) : (
                    <>
                      <span className="text-2xl text-gray-400">📎</span>
                      <span className="text-xs text-gray-500 mt-1">Click to upload image or PDF (max 5MB)</span>
                    </>
                  )}
                </label>
                {editExpense?.receiptUrl && !filePreview && (
                  <p className="text-xs text-gray-400 mt-1">Current: <a href={`${BASE_URL}${editExpense.receiptUrl}`} target="_blank" className="text-indigo-500 underline">View existing</a></p>
                )}
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-2 rounded text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-700"
              >
                {saving ? "Saving..." : (editExpense ? "Update Expense" : "Add Expense")}
              </button>

            </form>

          </div>

        </div>

      )}

      {/* VIEW MODAL */}
      {selectedExpense && (

        <div className="fixed inset-0 z-50 flex items-center justify-center">

          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={()=>setSelectedExpense(null)}
          />

          <div className="relative bg-white p-6 rounded-lg shadow-lg w-[400px]">

            <button
              onClick={()=>setSelectedExpense(null)}
              className="absolute top-3 right-3"
            >
              <XCircle size={20}/>
            </button>

            <h2 className="text-lg font-semibold mb-4">
              Expense Details
            </h2>

            <p><b>Employee:</b> {selectedExpense.employeeName}</p>
            <p><b>Department:</b> {selectedExpense.departmentName}</p>
            <p><b>Category:</b> {selectedExpense.category}</p>
            <p><b>Amount:</b> ₹{selectedExpense.amount}</p>
            <p><b>Description:</b> {selectedExpense.description}</p>

          </div>

        </div>

      )}

      {/* EXPORT MODAL */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowExportModal(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[460px] p-6">
            <button onClick={() => setShowExportModal(false)} className="absolute top-3 right-3"><XCircle size={22}/></button>
            <h2 className="text-lg font-semibold mb-4">Export Expenses to Excel</h2>

            {/* Type toggle */}
            <div className="flex gap-3 mb-5">
              <button
                onClick={() => { setExportType('all'); setExportEmployeeId(''); }}
                className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${
                  exportType === 'all' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                All Employees
              </button>
              <button
                onClick={() => setExportType('employee')}
                className={`flex-1 py-2 rounded border text-sm font-medium transition-colors ${
                  exportType === 'employee' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                By Employee
              </button>
            </div>

            {/* Employee dropdown — only when 'employee' selected */}
            {exportType === 'employee' && (
              <div className="mb-4">
                <label className="block text-xs text-gray-500 mb-1">Select Employee *</label>
                <select
                  value={exportEmployeeId}
                  onChange={e => setExportEmployeeId(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="">-- Select Employee --</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName} {(emp.departmentName || emp.tlDepartmentName || emp.department) ? `(${emp.departmentName || emp.tlDepartmentName || emp.department})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Date range */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs text-gray-500 mb-1">From Date</label>
                <input
                  type="date"
                  value={exportFromDate}
                  onChange={e => setExportFromDate(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">To Date</label>
                <input
                  type="date"
                  value={exportToDate}
                  onChange={e => setExportToDate(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>

            {/* Color legend */}
            <div className="flex gap-3 mb-5 text-xs">
              <span className="px-2 py-1 rounded bg-yellow-100 text-yellow-700">■ Pending</span>
              <span className="px-2 py-1 rounded bg-green-100 text-green-700">■ Approved / Paid</span>
              <span className="px-2 py-1 rounded bg-red-100 text-red-700">■ Rejected</span>
            </div>

            <div className="flex gap-3">
              <button onClick={() => setShowExportModal(false)} className="flex-1 border rounded py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={exportExcel}
                disabled={exportType === 'employee' && !exportEmployeeId}
                className="flex-1 bg-green-600 text-white rounded py-2 text-sm font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Download size={14} className="inline mr-1"/> Download
              </button>
            </div>
          </div>
        </div>
      )}

      {/* REJECT REASON MODAL */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setRejectModal(null)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[420px] p-6">
            <button onClick={() => setRejectModal(null)} className="absolute top-3 right-3"><XCircle size={22}/></button>
            <h2 className="text-lg font-semibold mb-3">Reject Expense</h2>
            <p className="text-sm text-gray-500 mb-3">Enter a reason for rejection (required):</p>
            <textarea
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="e.g. Receipt missing, amount exceeds limit..."
              rows={3}
              className="w-full border rounded px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <div className="flex gap-3">
              <button onClick={() => setRejectModal(null)} className="flex-1 border rounded py-2 text-sm text-gray-600 hover:bg-gray-50">Cancel</button>
              <button
                onClick={() => handleReject(rejectModal.id, rejectReason)}
                disabled={!rejectReason.trim()}
                className="flex-1 bg-red-600 text-white rounded py-2 text-sm hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BULK UPLOAD MODAL */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowUploadModal(false)} />
          <div className="relative bg-white rounded-lg shadow-lg w-[480px] p-6">
            <button onClick={() => setShowUploadModal(false)} className="absolute top-3 right-3">
              <XCircle size={22}/>
            </button>
            <h2 className="text-lg font-semibold mb-1">Bulk Upload Expenses</h2>
            <p className="text-xs text-gray-500 mb-4">Upload an Excel file with expense records. Download the template first to see the required format.</p>

            <button
              onClick={downloadTemplate}
              className="flex items-center gap-2 text-sm text-indigo-600 underline mb-4 hover:text-indigo-800"
            >
              <Download size={14}/> Download Template
            </button>

            <label className="flex flex-col items-center justify-center w-full h-28 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-indigo-400 hover:bg-indigo-50 transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={e => {
                  const f = e.target.files[0];
                  if (f) handleBulkUpload(f);
                }}
              />
              {uploading ? (
                <span className="text-sm text-indigo-600">Uploading...</span>
              ) : (
                <>
                  <span className="text-2xl text-gray-400">📊</span>
                  <span className="text-xs text-gray-500 mt-1">Click to select .xlsx file</span>
                </>
              )}
            </label>

            {uploadResult && (
              <div className={`mt-4 p-3 rounded text-sm ${
                uploadResult.success ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {uploadResult.message}
              </div>
            )}
          </div>
        </div>
      )}

    </DashboardLayout>
  );
}

/* COMPONENTS */

function Card({ title, count, amount, color }) {
  const colors = {
    yellow: { text: 'text-yellow-600', bg: 'bg-yellow-50' },
    green:  { text: 'text-green-600',  bg: 'bg-green-50' },
    red:    { text: 'text-red-600',    bg: 'bg-red-50' },
    blue:   { text: 'text-blue-600',   bg: 'bg-blue-50' },
  };
  const c = colors[color] || colors.blue;
  return (
    <div className={`${c.bg} border rounded-lg p-4`}>
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-semibold ${c.text}`}>{count}</div>
      <div className={`text-xs font-medium ${c.text} mt-1`}>₹{Number(amount || 0).toLocaleString('en-IN')}</div>
    </div>
  );
}

function StatusBadge({status}){

  const map={
    APPROVED:"bg-green-100 text-green-700",
    REJECTED:"bg-red-100 text-red-700",
    PAID:"bg-blue-100 text-blue-700",
    PENDING:"bg-yellow-100 text-yellow-700"
  }

  return(
    <span className={`px-2 py-1 text-xs rounded-full ${map[status]||map.PENDING}`}>
      {status}
    </span>
  )
}


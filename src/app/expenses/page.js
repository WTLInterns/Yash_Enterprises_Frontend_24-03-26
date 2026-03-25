'use client';

import { useEffect, useState } from 'react';
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

export default function ExpenseOverviewPage() {

  const [activeTab, setActiveTab] = useState('overview');
  const [expenses, setExpenses] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  const [selectedExpense, setSelectedExpense] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);
  const [showFormModal, setShowFormModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [saving, setSaving] = useState(false);

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

  async function handleSubmit(e) {
    e.preventDefault();

    const formData = new FormData(e.target);

    const file = formData.get("receipt");

    // File validation
    if(file && file.size > 5 * 1024 * 1024){
      alert("File must be under 5MB");
      return;
    }

    const payload = {
      employeeId: formData.get("employeeId"),
      category: formData.get("category"),
      amount: formData.get("amount"),
      description: formData.get("description"),
      expenseDate: formData.get("expenseDate"),
      status: formData.get("status")
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
      e.target.reset();
      loadExpenses();

    } catch(err){
      console.error("Failed saving expense", err);
    } finally {
      setSaving(false);
    }
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

  async function handleReject(id) {
    const updated = await backendApi.post(`/expenses/${id}/reject`);
    setExpenses(prev => prev.map(e => e.id === id ? updated : e));
  }

  async function handlePaid(id) {
    const updated = await backendApi.post(`/expenses/${id}/mark-paid`);
    setExpenses(prev => prev.map(e => e.id === id ? updated : e));
  }

  async function exportExcel() {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Expenses");
    
    worksheet.columns = [
      { header: "Employee Name", key: "employeeName", width: 20 },
      { header: "Category", key: "category", width: 20 },
      { header: "Amount", key: "amount", width: 15 },
      { header: "Status", key: "status", width: 15 },
      { header: "Date", key: "expenseDate", width: 20 }
    ];
    
    filtered.forEach(expense => {
      worksheet.addRow(expense);
    });
    
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    saveAs(blob, "expenses.xlsx");
  }

  const summary = {
    pending: expenses.filter(e => e.status === 'PENDING').length,
    approved: expenses.filter(e => e.status === 'APPROVED').length,
    rejected: expenses.filter(e => e.status === 'REJECTED').length,
    paid: expenses.filter(e => e.status === 'PAID').length,
  };

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
              setShowFormModal(true);
            }}
            className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-md text-sm hover:bg-indigo-700"
          >
            <Plus size={16}/>
            Add Expense
          </button>
        </div>

        {/* SUMMARY */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card title="Pending" value={summary.pending} color="yellow"/>
          <Card title="Approved" value={summary.approved} color="green"/>
          <Card title="Rejected" value={summary.rejected} color="red"/>
          <Card title="Paid" value={summary.paid} color="blue"/>
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
            onClick={exportExcel}
            className="flex items-center gap-2 bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700"
          >
            <Download size={16}/>
            Export Excel
          </button>
        </div>

        {/* TABLE */}
        <div className="bg-white border rounded-lg overflow-x-auto">

          {loading ? (
            <div className="p-8 text-center text-gray-500">
              Loading expenses...
            </div>
          ) : (

            <table className="w-full text-sm">

              <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                <tr>
                  <th className="p-3 text-left">Employee</th>
                  <th className="p-3 text-left">Category</th>
                  <th className="p-3 text-left">Amount</th>
                  <th className="p-3 text-left">Date</th>
                  <th className="p-3 text-left">Evidence</th>
                  <th className="p-3 text-left">Status</th>
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
                            src={`http://localhost:8080${e.receiptUrl}`}
                            onClick={() => setPreviewImage(e.receiptUrl)}
                            className="w-10 h-10 rounded object-cover border cursor-pointer"
                          />

                          :

                          <a
                            href={`http://localhost:8080${e.receiptUrl}`}
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

                    {/* ACTIONS */}
                    <td className="p-3">

                      <div className="flex justify-end gap-2">

                        <button
                          onClick={()=>{
                            setEditExpense(e);
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

                            <button onClick={()=>handleReject(e.id)} className="p-2 bg-red-100 text-red-700 rounded">
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
              src={`http://localhost:8080${previewImage}`}
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

            <form onSubmit={handleSubmit} className="space-y-4" key={editExpense?.id || "new"}>

              <select
                name="employeeId"
                defaultValue={editExpense?.employeeId || ""}
                className="w-full border rounded px-3 py-2"
              >
                <option value="">Select Employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.firstName} {emp.lastName} — {emp.departmentName || 'No Department'} ({emp.roleName})
                  </option>
                ))}
              </select>

              <input
                name="category"
                defaultValue={editExpense?.category || ""}
                placeholder="Category"
                className="w-full border rounded px-3 py-2"
              />

              <input
                name="amount"
                defaultValue={editExpense?.amount || ""}
                placeholder="Amount"
                className="w-full border rounded px-3 py-2"
              />

              <textarea
                name="description"
                defaultValue={editExpense?.description || ""}
                placeholder="Description"
                className="w-full border rounded px-3 py-2"
              />

              <input
                name="expenseDate"
                type="date"
                defaultValue={editExpense?.expenseDate || ""}
                className="w-full border rounded px-3 py-2"
              />

              <select
                name="status"
                defaultValue={editExpense?.status || "PENDING"}
                className="w-full border rounded px-3 py-2"
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approved</option>
                <option value="REJECTED">Rejected</option>
                <option value="PAID">Paid</option>
              </select>

              <input
                name="receipt"
                type="file"
                className="w-full border rounded px-3 py-2"
              />

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-indigo-600 text-white py-2 rounded disabled:opacity-50 disabled:cursor-not-allowed"
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

    </DashboardLayout>
  );
}

/* COMPONENTS */

function Card({title,value,color}){

  const colors={
    yellow:"text-yellow-600",
    green:"text-green-600",
    red:"text-red-600",
    blue:"text-blue-600"
  }

  return(
    <div className="bg-white border rounded-lg p-4">
      <div className="text-sm text-gray-500">{title}</div>
      <div className={`text-2xl font-semibold ${colors[color]}`}>
        {value}
      </div>
    </div>
  )
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


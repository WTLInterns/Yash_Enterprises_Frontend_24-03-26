'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { Pencil, Trash2, Plus, Search, Eye, UserPlus, MoreVertical } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { backendApi } from '@/services/api';
import { getCurrentUserName, getCurrentUserRole } from '@/utils/userUtils';

export default function EmployeesPage() {
  const router = useRouter();
  
  // ✅ FIXED: Get dynamic user data
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();

  useEffect(() => {
    let isMounted = true;

    async function loadEmployees() {
      try {
        setLoading(true);
        const data = await backendApi.get('/employees');
        if (!isMounted) return;
        setEmployees(data || []);
      } catch (err) {
        console.error('Failed to load employees', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadEmployees();

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredEmployees = employees.filter(employee =>
    employee.firstName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.lastName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.employeeId?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleDelete = async (id) => {
    try {
      await backendApi.delete(`/employees/${id}`);
      setEmployees((prev) => prev.filter((e) => e.id !== id));
    } catch (err) {
      console.error('Failed to delete employee', err);
    }
  };

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'inactive':
        return 'bg-red-100 text-red-800';
      case 'on_leave':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DashboardLayout
      header={{
        project: "Organization Management",
        user: {
          name: userName,
          role: userRole
        },
        notifications: [],
        tabs: [
          { key: "employees", label: "Employees" },
          { key: "admins", label: "Admins" },
          { key: "roles", label: "Roles" },
          { key: "designation", label: "Designation" },
          { key: "teams", label: "Teams" },
        ],
        activeTabKey: "employees"
      }}
    >
      <div className="p-6 bg-[#f8fafc] min-h-screen">
        {/* Top Tabs */}
        <div className="flex gap-8 border-b mb-6 text-sm font-medium">
          {['Employees', 'Admins', 'Roles', 'Designation', 'Teams'].map(
            (tab) => (
              <button
                key={tab}
                onClick={() => {
                  if (tab === 'Employees') return;
                  const routes = {
                    'Admins': '/admins',
                    'Roles': '/roles',
                    'Designation': '/designation',
                    'Teams': '/teams'
                  };
                  router.push(routes[tab]);
                }}
                className={`pb-3 ${
                  tab === 'Employees'
                    ? 'border-b-2 border-blue-600 text-blue-600'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab}
              </button>
            )
          )}
        </div>

        {/* Card */}
        <div className="bg-white rounded-xl shadow-sm border">
          {/* Header */}
          <div className="flex justify-between items-center p-4">
            <h2 className="font-semibold text-gray-800">Employees ({employees.length})</h2>

            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 text-gray-400 w-4 h-4" />
                <input
                  placeholder="Search employees..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 pr-3 py-2 border rounded-lg text-sm focus:outline-none w-64"
                />
              </div>

              {/* Add Button */}
              <button
                onClick={() => router.push('/employees/add')}
                className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"
              >
                <UserPlus size={16} /> Add Employee
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-y">
                <tr className="text-left text-gray-600">
                  <th className="p-3 w-10">
                    <input type="checkbox" />
                  </th>
                  <th className="p-3">Employee ID</th>
                  <th className="p-3">Name</th>
                  <th className="p-3">Email</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Department</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right pr-8">Action</th>
                </tr>
              </thead>

              <tbody>
                {loading && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-gray-500">
                      Loading employees...
                    </td>
                  </tr>
                )}
                {!loading && filteredEmployees.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-gray-500">
                      {searchTerm ? 'No employees found matching your search.' : 'No employees found.'}
                    </td>
                  </tr>
                )}
                {!loading && filteredEmployees.map((employee) => (
                  <tr
                    key={employee.id}
                    className="border-b last:border-none hover:bg-gray-50"
                  >
                    <td className="p-3">
                      <input type="checkbox" />
                    </td>
                    <td className="p-3 text-gray-800 font-medium">{employee.employeeId || 'N/A'}</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-gray-600">
                            {employee.firstName?.[0]}{employee.lastName?.[0]}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">
                            {employee.firstName} {employee.lastName}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-600">{employee.email}</td>
                    <td className="p-3 text-gray-600">{employee.phone || 'N/A'}</td>
                    <td className="p-3 text-gray-600">
                      {(() => {
                        // ✅ NEW: Show TL name for EMPLOYEE role, department name for others
                        if (employee.role?.name === 'EMPLOYEE' && employee.tl) {
                          return `${employee.tl.firstName} ${employee.tl.lastName} (${employee.tl.departmentName || 'N/A'})`;
                        }
                        return employee.departmentName || employee.department?.name || 'N/A';
                      })()}
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(employee.status)}`}>
                        {employee.status || 'Unknown'}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-2">
                        <button 
                          onClick={() => router.push(`/employees/${employee.id}`)}
                          className="p-2 rounded-md bg-gray-100 hover:bg-gray-200"
                          title="View Details"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => router.push(`/employees/${employee.id}/edit`)}
                          className="p-2 rounded-md bg-gray-100 hover:bg-gray-200"
                          title="Edit"
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          onClick={() => handleDelete(employee.id)}
                          className="p-2 rounded-md bg-red-50 text-red-600 hover:bg-red-100"
                          title="Delete"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer / Pagination */}
          <div className="flex justify-end items-center gap-6 p-4 text-sm text-gray-600 border-t">
            <div>
              Rows per page:
              <select className="ml-2 border rounded px-2 py-1">
                <option>20</option>
                <option>50</option>
                <option>100</option>
              </select>
            </div>
            <div>
              {filteredEmployees.length > 0 ? `1–${filteredEmployees.length} of ${filteredEmployees.length}` : '0 of 0'}
            </div>

            <div className="flex gap-2">
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
                ‹
              </button>
              <button className="w-8 h-8 flex items-center justify-center rounded-full bg-gray-100 text-gray-400">
                ›
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

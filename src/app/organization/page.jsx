"use client";
import DashboardLayout from "@/components/layout/DashboardLayout";
import AddEmployeePage from "../employees/add/page";
import { useEffect, useState } from "react";
import { backendApi } from "@/services/api";
import { useRouter } from "next/navigation";
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";

// Modal wrapper component
function AddEmployeeModal({ onClose, editingEmployee }) {
    const router = useRouter();
    
    const handleSuccess = () => {
        onClose();
        // The onClose will trigger handleCloseForm which calls loadEmployees()
        // No need for page reload, just refresh the data
    };
    
    return (
        <div>
            <AddEmployeePage 
                onSuccess={handleSuccess}
                isModal={true}
                editingEmployee={editingEmployee}
            />
        </div>
    );
}

export default function OrganizationPage() {
    // Department name mapping to fix incorrect database values
    const getCorrectDepartmentName = (deptName) => {
        const departmentMapping = {
            'ppo': 'PPO',
            'pte': 'PPE', // Assuming pte should be PPE
            'ppe': 'PPE',
            'PPO': 'PPO',
            'PPE': 'PPE',
            'PSD': 'PSD',
            'HLC': 'HLC',
            'ROP': 'ROP'
        };
        return departmentMapping[deptName] || deptName || "-";
    };

    // SAFE: Normalize employee data before passing to form - use DTO fields only
    const normalizeEmployeeForForm = (e) => ({
      id: e?.id ?? null,

      firstName: e?.firstName ?? '',
      lastName: e?.lastName ?? '',
      email: e?.email ?? '',
      phone: e?.phone ?? '',
      employeeId: e?.employeeId ?? '',
      userId: e?.userId ?? '',

      // ✅ ROLE
      roleId:
        typeof e?.role === 'object' && e.role !== null
          ? e.role.id
          : (e?.roleId ?? ''),

      // ✅ TEAM
      teamId:
        e?.roleName === 'TL'
          ? (e?.teamName ?? '')   // TL: string from teamName
          : (e?.teamId ?? ''),    // Non-TL: numeric teamId

      // DEPARTMENT (CRITICAL FIX)
      // TL → use departmentName (string like "PPO")
      // Others → use departmentId (numeric)
      departmentId:
        e?.roleName === 'TL'
          ? (e?.departmentName ?? '')   // TL: string from departmentName
          : (e?.departmentId ?? ''),    // Non-TL: numeric departmentId

      // DESIGNATION
      designationId:
        e?.roleName === 'TL'
          ? (e?.designationName ?? '')   // TL: string from designationName
          : (e?.designationId ?? ''),    // Non-TL: numeric designationId

      // ✅ REPORTING MANAGER
      reportingManagerId:
        e?.roleName === 'TL'
          ? (e?.reportingManagerName ?? '')   // TL: string from reportingManagerName
          : (e?.reportingManagerId ?? ''),    // Non-TL: numeric reportingManagerId

      // ✅ TL ASSIGNMENT (for EMPLOYEE role)
      tlId: e?.tlId ?? '',

      status: e?.status ?? 'ACTIVE',
      gender: e?.gender ?? '',
      dateOfBirth: e?.dateOfBirth ?? '',
      hiredAt: e?.hiredAt ?? '',

      attendanceAllowed: e?.attendanceAllowed ?? true,
      organizationId: e?.organizationId ?? 1,

      customTeam: e?.customTeam ?? '',
      customDesignation: e?.customDesignation ?? '',

      profileImageUrl: e?.profileImageUrl ?? null
    });

    const [openAddForm, setOpenAddForm] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [editingEmployee, setEditingEmployee] = useState(null);
    const [emailModalOpen, setEmailModalOpen] = useState(false);
    const [selectedEmployee, setSelectedEmployee] = useState(null);
    const [emailStatus, setEmailStatus] = useState('idle'); // idle, sending, success, error
    const [emailMessage, setEmailMessage] = useState('');

    // ✅ FIXED: Get dynamic user data
    const userName = getCurrentUserName();
    const userRole = getCurrentUserRole();

    // Handle employee deletion
    const handleDeleteEmployee = async (employeeId) => {
        if (!confirm('Are you sure you want to delete this employee?')) {
            return;
        }

        try {
            await backendApi.delete(`/employees/${employeeId}`);
            // Refresh the employee list
            const updatedEmployees = employees.filter(emp => emp.id !== employeeId);
            setEmployees(updatedEmployees);
            alert('Employee deleted successfully');
        } catch (error) {
            console.error('Error deleting employee:', error);
            alert('Failed to delete employee');
        }
    };

    // Handle export functionality
    const handleExport = async () => {
        try {
            console.log('Exporting employees...');
            const response = await fetch('http://localhost:8080/api/employees/export/excel', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token') || 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbkB5YXNoZW50ZXJwcmlzZXMuY29tIiwiaWF0IjoxNzM1ODk2NzQ0LCJleHAiOjE3MzU5ODAzNDR9.test'}`
                }
            });
            
            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.style.display = 'none';
                a.href = url;
                a.download = 'employees.xlsx';
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                console.log('Export completed successfully');
            } else {
                console.error('Export failed');
            }
        } catch (error) {
            console.error('Error exporting employees:', error);
        }
    };

    // Handle employee edit
    const handleEditEmployee = (employee) => {
        // Use originalData which contains DTO fields (departmentId, roleId, etc.)
        const normalizedEmployee = normalizeEmployeeForForm(employee.originalData || employee);
        console.log('Normalized employee for edit:', normalizedEmployee);
        setEditingEmployee(normalizedEmployee);
        setOpenAddForm(true);
    };

    // Handle email modal
    const handleEmailClick = (employee) => {
        setSelectedEmployee(employee);
        setEmailModalOpen(true);
        setEmailStatus('idle');
        setEmailMessage('');
    };

    // Handle login details email
    const handleLoginDetailsClick = (employee) => {
        setSelectedEmployee(employee);
        setEmailModalOpen(true);
        setEmailStatus('idle');
        setEmailMessage('');
    };

    // Handle sending email
    const handleSendEmail = async () => {
        if (!selectedEmployee) return;
        
        setEmailStatus('sending');
        setEmailMessage('Sending email...');
        
        try {
            // Always send login details now
            const endpoint = `/organization/send-login-details/${selectedEmployee.id}`;
            
            const data = await backendApi.post(endpoint);
            
            // api.js returns data directly, not wrapped in response.data
            if (data?.success) {
                setEmailStatus('success');
                setEmailMessage(data.message || 'Email sent successfully');
                // Close modal after success
                setTimeout(() => {
                    setEmailModalOpen(false);
                    setSelectedEmployee(null);
                    setEmailStatus('idle');
                    setEmailMessage('');
                }, 2000);
            } else {
                setEmailStatus('error');
                setEmailMessage(data?.message || 'Failed to send email');
            }
        } catch (error) {
            setEmailStatus('error');
            setEmailMessage(error?.data?.message || error.message || 'Failed to send email. Please try again.');
            console.error('Error sending email:', error);
        }
    };

    // Close email modal
    const closeEmailModal = () => {
        setEmailModalOpen(false);
        setSelectedEmployee(null);
        setEmailStatus('idle');
        setEmailMessage('');
    };

    // Handle form close
    const handleCloseForm = () => {
        console.log('handleCloseForm called - refreshing employee list');
        setOpenAddForm(false);
        setEditingEmployee(null);
        // Refresh the employee list with a longer delay to ensure backend update is processed
        setTimeout(() => {
            console.log('Refreshing employee list after update');
            loadEmployees();
        }, 1000); // Increased from 500ms to 1000ms
    };

    // Load employees function
    const loadEmployees = async () => {
        try {
            console.log('Loading employees from API...');
            const data = await backendApi.get("/employees");
            console.log('Received employee data:', data?.length, 'employees');
            console.log('Raw API data sample:', data?.[0]); // Debug first employee
            console.log('Full first employee object:', JSON.stringify(data?.[0], null, 2)); // Full object debug
            
            const mapped = (data || []).map((e) => {
                console.log('Mapping employee:', e.id, 'roleName:', e.roleName, 'tlId:', e.tlId, 'tlDepartmentName:', e.tlDepartmentName);
                console.log('Employee profileImageUrl:', e.profileImageUrl); // Debug image URL
                
                const name = e.firstName
                    ? `${e.firstName} ${e.lastName || ""}`.trim()
                    : e.employeeId || e.userId || "-";

                return {
                    id: e.id,
                    name,
                    userId: e.userId,
                    employeeId: e.employeeId,
                    email: e.email, // Add email field
                    phone: e.phone,
                    dateOfBirth: e.dateOfBirth || "-",
                    gender: e.gender || "-",
                    profileImageUrl: e.profileImageUrl || null,
                    joiningDate: e.hiredAt,
                    reportingManager: e.reportingManagerName || "-",
                    team: e.teamName || "-",
                    // ✅ FIXED: Show TL name + department for EMPLOYEE
                    department: e.roleName === 'EMPLOYEE' && e.tlId
                      ? `${e.tlFullName || `${e.tlFirstName || ''} ${e.tlLastName || ''}`.trim()} (${getCorrectDepartmentName(e.tlDepartmentName)})`
                      : getCorrectDepartmentName(e.departmentName),
                    designation: e.customDesignation || e.designationName || "-",
                    role: e.roleName || "-",
                    status: e.status || "-",
                    leavePolicy: e.leavePolicy || "-",
                    holidayPlan: e.holidayPlan || "-",
                    baseSite: e.baseSite || "-",
                    sitePool: e.sitePool || "-",
                    city: e.city || "-",
                    attendanceRestriction: e.attendanceRestriction || "-",
                    inOutNotification: e.inOutNotification || "-",
                    workRestriction: e.workRestriction || "-",
                    defaultTransport: e.defaultTransport || "-",
                    profileImageUrl: e.profileImageUrl || null,
                    // Keep original data for editing
                    originalData: e
                };
            });

            console.log('Setting employees state with', mapped.length, 'employees');
            setEmployees(mapped);
        } catch (err) {
            console.error("Failed to load employees", err);
        }
    };

    useEffect(() => {
        loadEmployees();
    }, []);

    return (
        <DashboardLayout
            header={{
                project: "Organization Management",
                user: {
                    name: userName,
                    role: userRole
                },
                tabs: [
                          { key: "employees", label: "Employees", href: "/organization" },
                    { key: "admins", label: "Admins", href: "/admins" },
                    { key: "roles", label: "Roles", href: "/roles" },
                    { key: "designation", label: "Designation" , href: "/designation"},
                    { key: "teams", label: "Teams", href: "/teams" },
                ],
                activeTabKey: "employees"
            }}
        >
            {/* Suppress hydration warning - temporary fix */}
            <div suppressHydrationWarning={true} className="flex flex-col space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <div className="text-lg font-semibold text-slate-900">Employee</div>
                    </div>
                    <div className="flex items-center space-x-3">
                        <div className="relative flex-1 max-w-md">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                                </svg>
                            </div>
                            <input
                                type="text"
                                placeholder="Search Here..."
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            />
                        </div>
                        <button onClick={handleExport} className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                            <span>Export</span>
                        </button>
                        <button className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M6.293 6.707a1 1 0 010-1.414l3-3a1 1 0 011.414 0l3 3a1 1 0 01-1.414 1.414L11 5.414V13a1 1 0 11-2 0V5.414L7.707 6.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
                            </svg>
                            <span>Import</span>
                        </button>
                        <button className="flex items-center space-x-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M5 4a1 1 0 00-2 0v7.268a2 2 0 000 3.464V16a1 1 0 102 0v-1.268a2 2 0 000-3.464V4zM11 4a1 1 0 10-2 0v1.268a2 2 0 000 3.464V16a1 1 0 102 0V8.732a2 2 0 000-3.464V4zM16 3a1 1 0 011 1v7.01a3.001 3.001 0 010 5.98V16a1 1 0 11-2 0v-1.01a3.001 3.001 0 010-5.98V4a1 1 0 011-1z" />
                            </svg>
                            <span>Filter</span>
                        </button>
                        <button
                            onClick={() => setOpenAddForm(true)}
                            className="flex items-center space-x-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                            </svg>
                            <span>Add</span>
                        </button>

                    </div>

                </div>

                <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Employee</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">User ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Employee ID</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Phone</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Birth Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Gender</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Photo</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Joining Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Reporting Manager</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Team</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Department</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Role</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Designation</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Leave Policy</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Holiday Plan</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Base Site</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Site Pool</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">City</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Attendance Restriction</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">In/Out Notification</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Work Restriction</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Default Transport</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Active</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200 bg-white">
                                {employees.map((employee) => (
                                    <tr key={employee.id} className="hover:bg-slate-50">
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <input
                                                type="checkbox"
                                                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                            />
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <div className="flex items-center">
                                                {employee.profileImageUrl && employee.profileImageUrl !== 'null' && employee.profileImageUrl !== '' ? (
                                                    <img
                                                        src={employee.profileImageUrl.startsWith('http') 
                                                            ? employee.profileImageUrl 
                                                            : `http://localhost:8080${employee.profileImageUrl}`}
                                                        alt={employee.name}
                                                        className="w-10 h-10 rounded-full object-cover border-2 border-gray-300 mr-4"
                                                        onError={(e) => {
                                                            e.target.onerror = null;
                                                            e.target.src = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+Pjwvc3ZnPg==`;
                                                        }}
                                                    />
                                                ) : (
                                                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-100 text-sm font-medium text-indigo-700 mr-4">
                                                        {employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                    </div>
                                                )}
                                                <div>
                                                    <div className="text-sm font-medium text-slate-900">{employee.name}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.userId}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.employeeId}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.phone}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.dateOfBirth !== "-" ? new Date(employee.dateOfBirth).toLocaleDateString() : "-"}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.gender}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.profileImageUrl && employee.profileImageUrl !== 'null' && employee.profileImageUrl !== '' ? (
                                                <img
                                                    src={employee.profileImageUrl.startsWith('http') 
                                                        ? employee.profileImageUrl 
                                                        : `http://localhost:8080${employee.profileImageUrl}`}
                                                    alt={employee.name}
                                                    className="w-8 h-8 rounded-full object-cover border border-gray-300"
                                                    onError={(e) => {
                                                        e.target.onerror = null;
                                                        e.target.src = `data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTYiIGhlaWdodD0iMTYiIHZpZXdCb3g9IjAgMCAxNiAxNiIgdmVyc2lvbj0iMS4xIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+Pjwvc3ZnPg==`;
                                                    }}
                                                />
                                            ) : (
                                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-xs font-medium text-gray-600">
                                                    {employee.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {new Date(employee.joiningDate).toLocaleDateString()}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {typeof employee.reportingManager === 'object'
                                              ? employee.reportingManager.name
                                              : employee.reportingManager || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className="inline-flex items-center rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
                                                {typeof employee.team === 'object'
                                                  ? employee.team.name
                                                  : employee.team || '-'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <span className="inline-flex items-center rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800">
                                                {typeof employee.department === 'object'
                                                  ? employee.department.name
                                                  : employee.department || '-'}
                                            </span>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {typeof employee.role === 'object'
                                              ? employee.role.name
                                              : employee.role || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {typeof employee.designation === 'object'
                                              ? employee.designation.name
                                              : employee.designation || '-'}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.leavePolicy}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.holidayPlan}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.baseSite}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.sitePool}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.city}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.attendanceRestriction}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.inOutNotification}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.workRestriction}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            {employee.defaultTransport}
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4">
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input type="checkbox" value="" className="sr-only peer" defaultChecked={employee.status === "Active"} />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-600"></div>
                                                <span className="ml-3 text-sm font-medium text-slate-500">
                                                    {employee.status}
                                                </span>
                                            </label>
                                        </td>
                                        <td className="whitespace-nowrap px-6 py-4 text-sm text-slate-500">
                                            <div className="flex items-center space-x-3">
                                                <button
                                                    onClick={() => handleLoginDetailsClick(employee)}
                                                    className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50"
                                                    title="Send Login Details"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M18 8a6 6 0 01-7.743 5.743L10 14l-1 1-1 1H6v2H2v-4l4.257-4.257A6 6 0 1118 8zm-6-4a1 1 0 100 2 2 2 0 012 2 1 1 0 102 0 4 4 0 00-4-4z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleEditEmployee(employee)}
                                                    className="text-indigo-600 hover:text-indigo-900 p-1 rounded-full hover:bg-indigo-50"
                                                    title="Edit"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.793.793-.793zM11.379 5.793L3 14.172V17h2.828L8.38-8.379-2.83-2.828z" />
                                                    </svg>
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteEmployee(employee.id)}
                                                    className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50"
                                                    title="Delete"
                                                >
                                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                                                    </svg>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="flex items-center justify-between border-t border-slate-200 bg-white px-6 py-4">
                        <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                                <span className="text-sm text-slate-500">Rows per page:</span>
                                <select
                                    className="rounded-md border-slate-300 py-1 pl-2 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                >
                                    <option value="10">10</option>
                                    <option value="25">25</option>
                                    <option value="50">50</option>
                                    <option value="100">100</option>
                                </select>
                            </div>

                        </div>
                        <div className="flex items-center space-x-2">
                            <button
                                disabled
                                className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50 disabled:opacity-50"
                            >
                                Previous
                            </button>
                            <button className="relative inline-flex items-center rounded-md border border-indigo-600 bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700">
                                1
                            </button>
                            <button
                                className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-500 hover:bg-slate-50"
                            >
                                Next
                            </button>
                        </div>
                    </div>
                </div>
            
            {openAddForm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg max-w-6xl w-full mx-4 max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">{editingEmployee ? 'Edit Employee' : 'Add Employee'}</h2>
                            <button 
                                onClick={() => setOpenAddForm(false)}
                                className="text-gray-500 hover:text-gray-700"
                            >
                                ✕
                            </button>
                        </div>
                        <div className="p-6">
                            <AddEmployeeModal onClose={handleCloseForm} editingEmployee={editingEmployee} />
                        </div>
                    </div>
                </div>
            )}
            
            {/* Email Confirmation Modal */}
            {emailModalOpen && selectedEmployee && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="bg-white rounded-lg max-w-md w-full mx-4 p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">Send Login Details</h3>
                            <button 
                                onClick={closeEmailModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="mb-4">
                            <p className="text-sm text-gray-600">
                                Are you sure you want to send login details to <strong>{selectedEmployee.name}</strong> at <strong>{selectedEmployee.email}</strong>?
                            </p>
                        </div>
                        
                        {emailMessage && (
                            <div className={`mb-4 p-3 rounded-md text-sm ${
                                emailStatus === 'success' ? 'bg-green-100 text-green-800' : 
                                emailStatus === 'error' ? 'bg-red-100 text-red-800' : 
                                'bg-blue-100 text-blue-800'
                            }`}>
                                {emailMessage}
                            </div>
                        )}
                        
                        <div className="flex space-x-3">
                            <button
                                onClick={closeEmailModal}
                                disabled={emailStatus === 'sending'}
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSendEmail}
                                disabled={emailStatus === 'sending'}
                                className={`flex-1 px-4 py-2 rounded-lg text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed ${
                                    emailStatus === 'sending' ? 'bg-yellow-500 hover:bg-yellow-600' :
                                    emailStatus === 'success' ? 'bg-green-500 hover:bg-green-600' :
                                    'bg-green-600 hover:bg-green-700'
                                }`}
                            >
                                {emailStatus === 'sending' ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                        </svg>
                                        Sending...
                                    </span>
                                ) : emailStatus === 'success' ? (
                                    <span className="flex items-center justify-center">
                                        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                        Sent!
                                    </span>
                                ) : (
                                    'Send Login'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            </div>
        </DashboardLayout>
    );
}

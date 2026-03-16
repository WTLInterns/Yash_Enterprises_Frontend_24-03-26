'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { backendApi } from '@/services/api';
import { getCurrentUserName, getCurrentUserRole } from '@/utils/userUtils';
import {
  Users,
  UserCheck,
  Calendar,
  Clock,
  TrendingUp,
  Briefcase,
  AlertCircle,
  CheckCircle,
  XCircle,
  Building,
  UserPlus,
  UserMinus,
  Download,
  RefreshCw
} from 'lucide-react';
import { DepartmentDistributionChart, AttendanceChart, RoleDistributionChart } from '@/components/charts/HRMCharts';

export default function HRMDashboard() {
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState({
    employees: [],
    leaves: [],
    attendance: [],
    departments: [],
    stats: {
      totalEmployees: 0,
      totalTLs: 0,
      totalManagers: 0,
      totalAdmins: 0,
      presentToday: 0,
      absentToday: 0,
      leavePending: 0,
      leaveApproved: 0,
      leaveRejected: 0,
      departmentStats: {}
    }
  });

  useEffect(() => {
    const currentUser = getCurrentUserName();
    const currentRole = getCurrentUserRole();
    setUserName(currentUser);
    setUserRole(currentRole);
    
    // Check if user has access to HRM Dashboard
    const hasAccess = checkHRMAccess(currentRole);
    if (!hasAccess) {
      alert('You do not have permission to access the HRM Dashboard.');
      window.location.href = '/dashboard';
      return;
    }
    
    loadDashboardData();
  }, []);

  const checkHRMAccess = (role) => {
    // Allowed roles: ADMIN, MANAGER, HR
    // Allowed departments: ACCOUNT (as department)
    const allowedRoles = ['ADMIN', 'MANAGER', 'HR'];
    const allowedDepartments = ['ACCOUNT'];
    
    // Check if user has allowed role
    if (allowedRoles.includes(role)) {
      return true;
    }
    
    // Check if user is from ACCOUNT department
    const userData = getCurrentUser();
    const userDepartment = userData?.departmentName || userData?.department;
    
    if (allowedDepartments.includes(userDepartment)) {
      return true;
    }
    
    return false;
  };

  const getCurrentUser = () => {
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
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      console.log('🔥 [HRM DASHBOARD] Starting data fetch...');
      
      // Fetch employees data (same as organization page)
      let employees = [];
      try {
        const employeesRes = await backendApi.get("/employees");
        console.log('🔥 [HRM DASHBOARD] Raw employee data:', employeesRes?.length, 'employees');
        console.log('🔥 [HRM DASHBOARD] Sample employee:', employeesRes?.[0]);
        
        // Apply same mapping logic as organization page
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

        employees = (employeesRes || []).map((e) => {
          console.log('🔥 [HRM DASHBOARD] Processing employee:', e.id, 'roleName:', e.roleName, 'departmentName:', e.departmentName);
          
          return {
            id: e.id,
            firstName: e.firstName,
            lastName: e.lastName,
            userId: e.userId,
            employeeId: e.employeeId,
            email: e.email,
            phone: e.phone,
            departmentName: getCorrectDepartmentName(e.departmentName),
            roleName: e.roleName,
            role: e.roleName,
            status: e.status,
            tlDepartmentName: e.tlDepartmentName,
            tlId: e.tlId,
            // Keep original data for debugging
            originalData: e
          };
        });
        
        console.log('🔥 [HRM DASHBOARD] Processed employees:', employees.length);
      } catch (empError) {
        console.warn('🔥 [HRM DASHBOARD] Failed to load employees:', empError.message);
        employees = [];
      }

      // Fetch leaves data with error handling
      let leaves = [];
      try {
        const leavesRes = await backendApi.get("/leaves");
        leaves = leavesRes || [];
        console.log('🔥 [HRM DASHBOARD] Leaves loaded:', leaves.length);
      } catch (leaveError) {
        console.warn('🔥 [HRM DASHBOARD] Failed to load leaves:', leaveError.message);
        leaves = [];
      }

      // Fetch attendance data with error handling
      let attendance = [];
      try {
        console.log('🔥 [HRM DASHBOARD] Attempting to fetch attendance...');
        const attendanceRes = await backendApi.get("/attendance");
        attendance = attendanceRes || [];
        console.log('🔥 [HRM DASHBOARD] Attendance loaded successfully:', attendance.length);
      } catch (attError) {
        console.warn('🔥 [HRM DASHBOARD] Attendance API failed - endpoint may not exist:', attError.message);
        console.log('🔥 [HRM DASHBOARD] Continuing without attendance data (dashboard will work normally)...');
        attendance = []; // Set to empty array to continue without attendance
      }

      // Get unique departments from employees
      const departments = [...new Set(employees.map(emp => 
        emp.departmentName || 'UNKNOWN'
      ))].filter(dept => dept !== 'UNKNOWN' && dept !== '-');

      console.log('🔥 [HRM DASHBOARD] Found departments:', departments);

      // Calculate department statistics
      const departmentStats = {};
      const allDepartments = ['ACCOUNT', 'PPE', 'PPO', 'HCL'];
      
      // Initialize all departments
      allDepartments.forEach(dept => {
        departmentStats[dept] = {
          total: 0,
          present: 0,
          absent: 0,
          onLeave: 0,
          tl: 0,
          manager: 0,
          employee: 0
        };
      });

      // Calculate department stats from real employee data
      employees.forEach(emp => {
        const dept = emp.departmentName || 'UNKNOWN';
        console.log('🔥 [HRM DASHBOARD] Employee', emp.id, 'department:', dept, 'role:', emp.roleName);
        
        if (departmentStats[dept]) {
          departmentStats[dept].total++;
          
          // Count by role
          const roleName = emp.roleName || emp.role || 'EMPLOYEE';
          if (roleName === 'TL') {
            departmentStats[dept].tl++;
            console.log('🔥 [HRM DASHBOARD] Found TL in', dept);
          } else if (roleName === 'MANAGER') {
            departmentStats[dept].manager++;
            console.log('🔥 [HRM DASHBOARD] Found Manager in', dept);
          } else if (roleName === 'ADMIN') {
            departmentStats[dept].employee++; // Count admins as employees for dept stats
            console.log('🔥 [HRM DASHBOARD] Found Admin in', dept);
          } else {
            departmentStats[dept].employee++;
            console.log('🔥 [HRM DASHBOARD] Found Employee in', dept);
          }
        }
      });

      console.log('🔥 [HRM DASHBOARD] Department stats after processing:', departmentStats);

      // Calculate attendance for today (with fallback for missing data)
      let todayAttendance = [];
      let presentCount = 0;
      let absentCount = 0;
      
      if (attendance.length > 0) {
        console.log('🔥 [HRM DASHBOARD] Processing attendance data...');
        const today = new Date().toISOString().split('T')[0];
        todayAttendance = attendance.filter(att => att.date === today);
        
        todayAttendance.forEach(att => {
          const employee = employees.find(emp => emp.id === att.employeeId);
          if (employee) {
            const dept = employee.departmentName;
            if (departmentStats[dept]) {
              if (att.status === 'PRESENT') {
                departmentStats[dept].present++;
                presentCount++;
              } else if (att.status === 'ABSENT') {
                departmentStats[dept].absent++;
                absentCount++;
              }
            }
          }
        });
        console.log('🔥 [HRM DASHBOARD] Today\'s attendance processed:', todayAttendance.length, 'records');
      } else {
        console.log('🔥 [HRM DASHBOARD] No attendance data available - showing 0 for attendance stats');
      }

      // Calculate leave statistics
      const leaveStats = {
        pending: leaves.filter(leave => leave.status === 'PENDING').length,
        approved: leaves.filter(leave => leave.status === 'APPROVED').length,
        rejected: leaves.filter(leave => leave.status === 'REJECTED').length
      };

      // Update department stats with leave info
      leaves.forEach(leave => {
        if (leave.status === 'APPROVED') {
          const employee = employees.find(emp => emp.id === leave.employeeId);
          if (employee) {
            const dept = employee.departmentName;
            if (departmentStats[dept]) {
              departmentStats[dept].onLeave++;
            }
          }
        }
      });

      // Calculate overall statistics
      const stats = {
        totalEmployees: employees.length,
        totalTLs: employees.filter(emp => (emp.roleName || emp.role) === 'TL').length,
        totalManagers: employees.filter(emp => (emp.roleName || emp.role) === 'MANAGER').length,
        totalAdmins: employees.filter(emp => (emp.roleName || emp.role) === 'ADMIN').length,
        presentToday: presentCount, // Use calculated count
        absentToday: absentCount,   // Use calculated count
        leavePending: leaveStats.pending,
        leaveApproved: leaveStats.approved,
        leaveRejected: leaveStats.rejected,
        departmentStats
      };

      console.log('🔥 [HRM DASHBOARD] Final stats calculated:', stats);
      console.log('🔥 [HRM DASHBOARD] Total TLs:', stats.totalTLs);
      console.log('🔥 [HRM DASHBOARD] Total Managers:', stats.totalManagers);
      console.log('🔥 [HRM DASHBOARD] Total Admins:', stats.totalAdmins);

      setDashboardData({
        employees,
        leaves,
        attendance: todayAttendance,
        departments: allDepartments,
        stats
      });

    } catch (error) {
      console.error('🔥 [HRM DASHBOARD] Critical error in loadDashboardData:', error);
      // Set empty data to prevent crashes
      setDashboardData({
        employees: [],
        leaves: [],
        attendance: [],
        departments: ['ACCOUNT', 'PPE', 'PPO', 'HCL'],
        stats: {
          totalEmployees: 0,
          totalTLs: 0,
          totalManagers: 0,
          totalAdmins: 0,
          presentToday: 0,
          absentToday: 0,
          leavePending: 0,
          leaveApproved: 0,
          leaveRejected: 0,
          departmentStats: {
            ACCOUNT: { total: 0, present: 0, absent: 0, onLeave: 0, tl: 0, manager: 0, employee: 0 },
            PPE: { total: 0, present: 0, absent: 0, onLeave: 0, tl: 0, manager: 0, employee: 0 },
            PPO: { total: 0, present: 0, absent: 0, onLeave: 0, tl: 0, manager: 0, employee: 0 },
            HCL: { total: 0, present: 0, absent: 0, onLeave: 0, tl: 0, manager: 0, employee: 0 }
          }
        }
      });
    } finally {
      setLoading(false);
    }
  };

  const exportToExcel = async () => {
    try {
      const ExcelJS = await import('exceljs');
      const { saveAs } = await import('file-saver');
      
      const workbook = new ExcelJS.Workbook();
      
      // Summary Sheet
      const summarySheet = workbook.addWorksheet('HRM Summary');
      summarySheet.columns = [
        { header: 'Metric', key: 'metric', width: 25 },
        { header: 'Count', key: 'count', width: 15 }
      ];
      
      summarySheet.addRows([
        { metric: 'Total Employees', count: dashboardData.stats.totalEmployees },
        { metric: 'Total Admins', count: dashboardData.stats.totalAdmins },
        { metric: 'Total Managers', count: dashboardData.stats.totalManagers },
        { metric: 'Total Team Leaders', count: dashboardData.stats.totalTLs },
        { metric: 'Present Today', count: dashboardData.stats.presentToday },
        { metric: 'Absent Today', count: dashboardData.stats.absentToday },
        { metric: 'Leave Pending', count: dashboardData.stats.leavePending },
        { metric: 'Leave Approved', count: dashboardData.stats.leaveApproved },
        { metric: 'Leave Rejected', count: dashboardData.stats.leaveRejected }
      ]);

      // Department-wise Sheet
      const deptSheet = workbook.addWorksheet('Department Details');
      deptSheet.columns = [
        { header: 'Department', key: 'dept', width: 15 },
        { header: 'Total Employees', key: 'total', width: 15 },
        { header: 'Team Leaders', key: 'tl', width: 12 },
        { header: 'Managers', key: 'manager', width: 12 },
        { header: 'Employees', key: 'employee', width: 12 },
        { header: 'Present Today', key: 'present', width: 12 },
        { header: 'Absent Today', key: 'absent', width: 12 },
        { header: 'On Leave', key: 'onLeave', width: 10 }
      ];

      Object.entries(dashboardData.stats.departmentStats).forEach(([dept, stats]) => {
        deptSheet.addRow({
          dept,
          total: stats.total,
          tl: stats.tl,
          manager: stats.manager,
          employee: stats.employee,
          present: stats.present,
          absent: stats.absent,
          onLeave: stats.onLeave
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      });
      
      const today = new Date().toISOString().split('T')[0];
      saveAs(blob, `HRM_Dashboard_Report_${today}.xlsx`);
      
    } catch (error) {
      console.error('Failed to export report:', error);
      alert('Failed to export report. Please try again.');
    }
  };

  const getDepartmentColor = (dept) => {
    const colors = {
      'ACCOUNT': 'bg-blue-100 text-blue-800 border-blue-200',
      'PPE': 'bg-green-100 text-green-800 border-green-200',
      'PPO': 'bg-purple-100 text-purple-800 border-purple-200',
      'HCL': 'bg-orange-100 text-orange-800 border-orange-200'
    };
    return colors[dept] || 'bg-gray-100 text-gray-800 border-gray-200';
  };

  const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        <div className={`p-3 rounded-lg ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const DepartmentCard = ({ dept, stats }) => (
    <div className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${getDepartmentColor(dept)}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">{dept}</h3>
        <Building className="w-5 h-5 text-gray-600" />
      </div>
      
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          <p className="text-xs text-gray-600">Total Employees</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-green-600">{stats.present}</p>
          <p className="text-xs text-gray-600">Present Today</p>
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">TLs:</span>
          <span className="font-medium">{stats.tl}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Managers:</span>
          <span className="font-medium">{stats.manager}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Employees:</span>
          <span className="font-medium">{stats.employee}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Absent:</span>
          <span className="font-medium text-red-600">{stats.absent}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">On Leave:</span>
          <span className="font-medium text-orange-600">{stats.onLeave}</span>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <DashboardLayout
        header={{
          project: "HRM Dashboard",
          user: { name: userName, role: userRole }
        }}
      >
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading HRM Dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout
      header={{
        project: "HRM Dashboard",
        user: { name: userName, role: userRole },
        tabs: [
          { key: "dashboard", label: "Dashboard", href: "/hrm" },
          { key: "organization", label: "Organization", href: "/organization" },
          { key: "leaves", label: "Leaves", href: "/leaves" },
          { key: "attendance", label: "Attendance", href: "/attendance" }
        ],
        activeTabKey: "dashboard"
      }}
    >
      <div suppressHydrationWarning={true} className="flex flex-col space-y-4">
        {/* Overview Stats */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Overview</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
              title="Total Employees"
              value={dashboardData.stats.totalEmployees}
              icon={<Users className="w-6 h-6" />}
              color="bg-blue-500"
            />
            <StatCard
              title="Team Leaders"
              value={dashboardData.stats.totalTLs}
              icon={<UserCheck className="w-6 h-6" />}
              color="bg-green-500"
            />
            <StatCard
              title="Present Today"
              value={dashboardData.stats.presentToday}
              icon={<Calendar className="w-6 h-6" />}
              color="bg-purple-500"
              subtitle={dashboardData.attendance.length === 0 ? "(No attendance data)" : ""}
            />
            <StatCard
              title="Leave Requests"
              value={dashboardData.stats.leavePending + dashboardData.stats.leaveApproved + dashboardData.stats.leaveRejected}
              icon={<Clock className="w-6 h-6" />}
              color="bg-orange-500"
            />
          </div>
          
          {/* Attendance Data Warning */}
          {dashboardData.attendance.length === 0 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-yellow-600 mr-2" />
                <div>
                  <p className="text-sm text-yellow-800 font-medium">
                    Attendance API endpoint is not configured
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Present/Absent counts will show 0 until the attendance controller is implemented in the backend.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Leave Statistics */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <StatCard
            title="Pending Leaves"
            value={dashboardData.stats.leavePending}
            icon={AlertCircle}
            color="bg-yellow-600"
            subtitle="Awaiting approval"
          />
          <StatCard
            title="Approved Leaves"
            value={dashboardData.stats.leaveApproved}
            icon={CheckCircle}
            color="bg-green-600"
            subtitle="Approved requests"
          />
          <StatCard
            title="Rejected Leaves"
            value={dashboardData.stats.leaveRejected}
            icon={XCircle}
            color="bg-red-600"
            subtitle="Rejected requests"
          />
        </div>

        {/* Department-wise Statistics */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Department-wise Statistics</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {['ACCOUNT', 'PPE', 'PPO', 'HCL'].map(dept => (
              <DepartmentCard
                key={dept}
                dept={dept}
                stats={dashboardData.stats.departmentStats[dept] || {
                  total: 0, present: 0, absent: 0, onLeave: 0,
                  tl: 0, manager: 0, employee: 0
                }}
              />
            ))}
          </div>
        </div>

        {/* Charts Section */}
        <div className="mb-8">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Analytics & Insights</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Department Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Distribution</h3>
              <DepartmentDistributionChart data={dashboardData.stats.departmentStats} />
            </div>

            {/* Attendance Overview */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Today's Attendance</h3>
              <AttendanceChart data={dashboardData.stats.departmentStats} />
            </div>

            {/* Role Distribution */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Role Distribution</h3>
              <RoleDistributionChart data={dashboardData.stats} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Quick Actions</h2>
            <button
              onClick={loadDashboardData}
              className="flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh Data
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button
              onClick={() => window.open('/organization', '_blank')}
              className="flex items-center justify-center gap-2 p-4 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Users className="w-5 h-5" />
              Manage Employees
            </button>
            <button
              onClick={() => window.open('/leaves', '_blank')}
              className="flex items-center justify-center gap-2 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Calendar className="w-5 h-5" />
              Manage Leaves
            </button>
            <button
              onClick={() => window.open('/attendance', '_blank')}
              className="flex items-center justify-center gap-2 p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Clock className="w-5 h-5" />
              View Attendance
            </button>
            <button
              onClick={() => exportToExcel()}
              className="flex items-center justify-center gap-2 p-4 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Download className="w-5 h-5" />
              Export Report
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

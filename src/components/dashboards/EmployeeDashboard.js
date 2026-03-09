"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { 
  Calendar,
  Clock,
  CheckCircle,
  Target,
  User,
  LogOut,
  Settings
} from "lucide-react";
import { backendApi } from "@/services/api";

export default function EmployeeDashboard({ userName, userRole }) {
  const router = useRouter();
  const [employeeData, setEmployeeData] = useState(null);
  const [todayStats, setTodayStats] = useState(null);
  const [recentTasks, setRecentTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ Fetch employee-specific data
  const fetchEmployeeData = async () => {
    try {
      setLoading(true);
      
      // ✅ Use dummy data for now - replace with actual API calls later
      const dummyProfileData = {
        employeeId: 'EMP001',
        department: 'PPO',
        tlName: 'John Doe',
        email: 'employee@company.com',
        phone: '+91 9876543210',
        joiningDate: '2023-01-15',
        status: 'ACTIVE'
      };

      const dummyTodayStats = {
        attendanceStatus: 'Present',
        tasksAssigned: 5,
        hoursWorked: '6h 30m',
        leaveBalance: 12
      };

      const dummyRecentTasks = [
        {
          id: 1,
          title: 'Complete document verification',
          dueDate: '2024-03-02',
          status: 'completed'
        },
        {
          id: 2,
          title: 'Follow up with customer',
          dueDate: '2024-03-03',
          status: 'in-progress'
        },
        {
          id: 3,
          title: 'Submit weekly report',
          dueDate: '2024-03-04',
          status: 'pending'
        }
      ];

      setEmployeeData(dummyProfileData);
      setTodayStats(dummyTodayStats);
      setRecentTasks(dummyRecentTasks);

    } catch (error) {
      console.error('Failed to fetch employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ✅ WELCOME HEADER */}
      <div className="mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Welcome back, {userName || 'Employee'}! 👋
              </h1>
              <p className="text-gray-600 mt-2">
                Here's your workspace for today
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Employee ID</p>
                <p className="text-lg font-semibold text-gray-900">
                  {employeeData?.employeeId || 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ TODAY'S STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="text-green-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Attendance Today</p>
              <p className="text-2xl font-bold text-gray-900">
                {todayStats?.attendanceStatus || 'Not Marked'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Target className="text-blue-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Tasks Assigned</p>
              <p className="text-2xl font-bold text-gray-900">
                {todayStats?.tasksAssigned || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Clock className="text-purple-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Hours Worked</p>
              <p className="text-2xl font-bold text-gray-900">
                {todayStats?.hoursWorked || '0h'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Calendar className="text-orange-600" size={24} />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Leave Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {todayStats?.leaveBalance || '0'} days
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ✅ QUICK ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
          <div className="space-y-3">
            <button
              onClick={() => router.push('/attendance/mark')}
              className="w-full flex items-center justify-center gap-3 p-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Clock size={20} />
              Mark Attendance
            </button>
            <button
              onClick={() => router.push('/tasks')}
              className="w-full flex items-center justify-center gap-3 p-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Target size={20} />
              View My Tasks
            </button>
            <button
              onClick={() => router.push('/leaves/request')}
              className="w-full flex items-center justify-center gap-3 p-4 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Calendar size={20} />
              Request Leave
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Recent Tasks</h2>
          <div className="space-y-3">
            {recentTasks.length > 0 ? (
              recentTasks.map((task, index) => (
                <div key={task.id || index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${
                      task.status === 'completed' ? 'bg-green-500' : 
                      task.status === 'in-progress' ? 'bg-yellow-500' : 'bg-gray-400'
                    }`}></div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{task.title}</p>
                      <p className="text-xs text-gray-500">{task.dueDate}</p>
                    </div>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs ${
                    task.status === 'completed' ? 'bg-green-100 text-green-800' : 
                    task.status === 'in-progress' ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-800'
                  }`}>
                    {task.status}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-gray-500 text-center py-4">No tasks assigned</p>
            )}
          </div>
          {recentTasks.length > 0 && (
            <button
              onClick={() => router.push('/tasks')}
              className="w-full mt-3 text-center text-sm text-indigo-600 hover:text-indigo-800"
            >
              View all tasks →
            </button>
          )}
        </div>
      </div>

      {/* ✅ EMPLOYEE INFO */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">My Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-500">Department</p>
            <p className="font-medium text-gray-900">{employeeData?.department || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Team Lead</p>
            <p className="font-medium text-gray-900">{employeeData?.tlName || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Email</p>
            <p className="font-medium text-gray-900">{employeeData?.email || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Phone</p>
            <p className="font-medium text-gray-900">{employeeData?.phone || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Joining Date</p>
            <p className="font-medium text-gray-900">{employeeData?.joiningDate || 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <span className={`px-2 py-1 rounded-full text-xs ${
              employeeData?.status === 'ACTIVE' 
                ? 'bg-green-100 text-green-800' 
                : 'bg-red-100 text-red-800'
            }`}>
              {employeeData?.status || 'N/A'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

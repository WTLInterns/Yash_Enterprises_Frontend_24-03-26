"use client";

import { useState, useEffect } from "react";
import { 
  UsersIcon, 
  BuildingOffice2Icon, 
  CheckCircleIcon, 
  BanknotesIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  TagIcon
} from "@heroicons/react/24/outline";
import { departmentStatsService } from "@/services/departmentStats.service";
import { getAuthUser } from "@/utils/authUser";
import DepartmentStatsCard from "@/components/dashboard/DepartmentStatsCard";
import DepartmentPieChart from "@/components/charts/DepartmentPieChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { useStages } from '@/context/StageContext';

// ✅ Funnel Chart Component for TL - Proper Dynamic Funnel with Real Stages
const FunnelChart = ({ data, department, stages }) => {
  if (!data || data.length === 0) return null;
  
  // Use real stages if available, otherwise use data
  const displayData = stages && stages.length > 0 
    ? stages.map(stage => ({
        stage: stage.stageName,
        count: data.find(d => d.stage === stage.stageCode)?.count || 0
      })).filter(item => item.count > 0) // Only show stages with data
    : data;

  if (displayData.length === 0) return null;
  
  const maxCount = Math.max(...displayData.map(d => d.count));
  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
  
  // Dynamic height based on number of stages
  const svgHeight = Math.max(400, displayData.length * 60);
  const stageHeight = svgHeight / displayData.length;
  
  return (
    <div className="flex flex-col items-center justify-center py-4">
      <svg width="100%" height={svgHeight} viewBox={`0 0 400 ${svgHeight}`} className="max-w-lg">
        {displayData.map((stage, index) => {
          const widthPercentage = (stage.count / maxCount) * 100;
          const y = index * stageHeight;
          
          // Create proper funnel shape - smooth transition between stages
          const currentWidth = 300 * (widthPercentage / 100);
          const nextWidth = index < displayData.length - 1 
            ? 300 * ((displayData[index + 1].count / maxCount) * 100 / 100)
            : currentWidth * 0.3; // Bottom is narrower
          
          const centerX = 200;
          
          // Create smooth trapezoid path
          const path = `
            M ${centerX - currentWidth/2} ${y}
            L ${centerX + currentWidth/2} ${y}
            L ${centerX + nextWidth/2} ${y + stageHeight}
            L ${centerX - nextWidth/2} ${y + stageHeight}
            Z
          `;
          
          return (
            <g key={stage.stage}>
              {/* Main funnel section with gradient */}
              <defs>
                <linearGradient id={`gradient-${index}`} x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor={colors[index % colors.length]} stopOpacity="0.9" />
                  <stop offset="100%" stopColor={colors[index % colors.length]} stopOpacity="1" />
                </linearGradient>
              </defs>
              
              <path
                d={path}
                fill={`url(#gradient-${index})`}
                stroke="white"
                strokeWidth="2"
              />
              
              {/* Add 3D effect - side shading */}
              <path
                d={`
                  M ${centerX + currentWidth/2} ${y}
                  L ${centerX + currentWidth/2 + 8} ${y}
                  L ${centerX + nextWidth/2 + 8} ${y + stageHeight}
                  L ${centerX + nextWidth/2} ${y + stageHeight}
                  Z
                `}
                fill="rgba(0,0,0,0.15)"
              />
              
              {/* Stage count text */}
              <text
                x={centerX}
                y={y + stageHeight/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="14"
                fontWeight="bold"
              >
                {stage.count}
              </text>
              
              {/* Stage label - positioned outside */}
              <text
                x={centerX + Math.max(currentWidth, nextWidth)/2 + 15}
                y={y + stageHeight/2}
                textAnchor="start"
                dominantBaseline="middle"
                fill="#374151"
                fontSize="12"
                fontWeight="500"
              >
                {stage.stage}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default function TLDepartmentDashboard({ userName, userRole }) {
  // ✅ Use real stage data
  const { getStagesForDepartment } = useStages();
  
  const [departmentStats, setDepartmentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const currentUser = getAuthUser();

  // ✅ Fetch department-specific stats for TL
  const fetchDepartmentStats = async () => {
    if (!currentUser?.department) {
      setError('No department assigned');
      setLoading(false);
      return;
    }
    
    try {
      console.log('Fetching department stats for TL:', currentUser.department);
      setLoading(true);
      setError(null);
      
      // ✅ Use dummy data for now - replace with actual API call later
      const dummyStats = {
        customers: {
          department: 45,
          total: 120,
          percentage: 37.5
        },
        products: {
          department: 28,
          total: 85,
          percentage: 32.9
        },
        tasks: {
          department: 67,
          total: 200,
          percentage: 33.5,
          completed: 45,
          pending: 22
        },
        bank: {
          department: 15,
          total: 50,
          percentage: 30.0,
          totalAmount: 2500000
        },
        recentActivity: [
          {
            description: 'New customer onboarded',
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
            user: 'John Doe'
          },
          {
            description: 'Task completed: Document verification',
            timestamp: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
            user: 'Jane Smith'
          },
          {
            description: 'Bank transaction processed',
            timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
            user: 'Mike Johnson'
          },
          {
            description: 'Product delivery confirmed',
            timestamp: new Date(Date.now() - 48 * 60 * 60 * 1000), // 2 days ago
            user: 'Sarah Williams'
          }
        ],
        funnelData: [
          { stage: 'NEW_LEAD', count: 45 },
          { stage: 'PDO', count: 38 },
          { stage: 'EVALUATION', count: 30 },
          { stage: 'PPS', count: 22 },
          { stage: 'REVIEW', count: 15 },
          { stage: 'DOP', count: 10 },
          { stage: 'ACCOUNT', count: 6 }
        ]
      };
      
      setDepartmentStats(dummyStats);
      
    } catch (error) {
      console.error('Failed to fetch department stats:', error);
      setError('Failed to load department statistics');
      setDepartmentStats({
        error: true,
        message: 'Failed to load department statistics'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDepartmentStats();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !currentUser?.department) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-lg font-medium mb-2">
            {error || 'No department assigned'}
          </div>
          <button 
            onClick={fetchDepartmentStats}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ✅ DEPARTMENT HEADER */}
      <div className="mb-8">
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {currentUser.department} Department Dashboard
              </h1>
              <p className="text-gray-600 mt-2">
                Overview for {currentUser.department} department
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-gray-500">Department Head</p>
                <p className="text-lg font-semibold text-gray-900">
                  {userName || 'Team Lead'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {departmentStats?.error ? (
        // Error state
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-800 font-medium">{departmentStats.message}</p>
          <button 
            onClick={fetchDepartmentStats}
            className="mt-3 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      ) : departmentStats ? (
        // 🎯 PROFESSIONAL TL DEPARTMENT-WISE DASHBOARD
        <>
          {/* ✅ FUNNEL CHART - TL Dashboard */}
          <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Funnel Chart - {currentUser?.department} Department
            </h3>
            <FunnelChart 
              data={departmentStats?.funnelData || []} 
              department={currentUser?.department} 
              stages={getStagesForDepartment(currentUser?.department)}
            />
          </div>

          {/* Department Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <DepartmentStatsCard
              title="Total Customers"
              value={departmentStats.customers?.department || 0}
              total={departmentStats.customers?.total || 0}
              percentage={departmentStats.customers?.percentage || 0}
              icon={UsersIcon}
            />
            <DepartmentStatsCard
              title="Total Products"
              value={departmentStats.products?.department || 0}
              total={departmentStats.products?.total || 0}
              percentage={departmentStats.products?.percentage || 0}
              icon={BuildingOffice2Icon}
            />
            <DepartmentStatsCard
              title="Total Tasks"
              value={departmentStats.tasks?.department || 0}
              total={departmentStats.tasks?.total || 0}
              percentage={departmentStats.tasks?.percentage || 0}
              icon={CheckCircleIcon}
            />
            <DepartmentStatsCard
              title="Bank Records"
              value={departmentStats.bank?.department || 0}
              total={departmentStats.bank?.total || 0}
              percentage={departmentStats.bank?.percentage || 0}
              icon={BanknotesIcon}
            />
          </div>

          {/* Pie Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <DepartmentPieChart
              data={departmentStats.customers}
              title="Customers Distribution"
              department={currentUser.department}
            />
            <DepartmentPieChart
              data={departmentStats.tasks}
              title="Tasks Distribution"
              department={currentUser.department}
            />
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <ClockIcon className="h-5 w-5 mr-2 text-gray-400" />
              Recent Activity - {currentUser.department} Department
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {departmentStats.recentActivity?.map((activity, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div className="flex-shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-2"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Just now'}
                    </p>
                    {activity.user && (
                      <p className="text-xs text-gray-400">by {activity.user}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Task Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Breakdown - {currentUser.department}</h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-100">
                  <p className="text-2xl font-bold text-green-700">{departmentStats.tasks?.completed || 0}</p>
                  <p className="text-sm text-green-600">Completed Tasks</p>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg border border-yellow-100">
                  <p className="text-2xl font-bold text-yellow-700">{departmentStats.tasks?.pending || 0}</p>
                  <p className="text-sm text-yellow-600">Pending Tasks</p>
                </div>
              </div>
            </div>

            {/* Bank Summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Summary - {currentUser.department}</h3>
              <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-2xl font-bold text-blue-700">
                  ₹{(departmentStats.bank?.totalAmount || 0).toLocaleString()}
                </p>
                <p className="text-sm text-blue-600">Total Transaction Amount</p>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <UsersIcon className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Customers</p>
                  <p className="text-sm text-gray-500">Manage customers</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TagIcon className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Tasks</p>
                  <p className="text-sm text-gray-500">View tasks</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ArrowTrendingUpIcon className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Reports</p>
                  <p className="text-sm text-gray-500">View reports</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <CalendarIcon className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">Calendar</p>
                  <p className="text-sm text-gray-500">View schedule</p>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        // No data state
        <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
          <p className="text-gray-600">No department statistics available</p>
        </div>
      )}
    </div>
  );
}

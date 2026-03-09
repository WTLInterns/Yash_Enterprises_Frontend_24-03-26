"use client";

import { useState, useEffect } from "react";
import { 
  BarChart3, 
  PieChart, 
  TrendingUp, 
  Calendar, 
  Filter,
  Download,
  RefreshCw,
  Users,
  Building2,
  DollarSign,
  Eye
} from "lucide-react";
import { backendApi } from "@/services/api";

// ✅ CHART COMPONENTS
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { useStages } from '@/context/StageContext';

// ✅ FILTER COLORS
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// ✅ Funnel Chart Component - Proper Dynamic Funnel with Real Stages
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

export default function AdminManagerCRMDashboard({ userName, userRole }) {
  // ✅ Use real stage data
  const { departments, getStagesForDepartment, fetchStagesForDepartment } = useStages();
  
  // ✅ FILTER STATES
  const [filters, setFilters] = useState({
    dateRange: { start: '', end: '' },
    department: '',
    taluka: '',
    district: '',
    bankName: '',
    branchName: '',
    customerName: '',
    allocation: ''
  });

  // ✅ DATA STATES
  const [chartData, setChartData] = useState({
    departmentByAmount: [],
    yashrqjBranchByAmount: [],
    distByAmount: [],
    amountByClosingDate: [],
    contactWiseAmount: [],
    departmentWiseStage: [],
    bankBranchWiseAmount: [],
    funnelData: []
  });

  const [selectedDepartment, setSelectedDepartment] = useState('ACCOUNT');

  const [tableData, setTableData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    departments: [],
    talukas: [],
    districts: [],
    banks: [],
    branches: [],
    customers: [],
    allocations: []
  });

  // ✅ FETCH DASHBOARD DATA
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      console.log('Fetching CRM Dashboard data for:', userRole);
      
      // ✅ Use dummy data for now - replace with actual API calls later
      const dummyChartData = {
        departmentByAmount: [
          { department: 'PPO', amount: 4500000 },
          { department: 'PSD', amount: 3200000 },
          { department: 'PPE', amount: 2800000 },
          { department: 'HLC', amount: 2100000 },
          { department: 'ACCOUNT', amount: 1900000 },
          { department: 'ROP', amount: 1500000 }
        ],
        yashrqjBranchByAmount: [
          { branch: 'Mumbai Branch', amount: 3200000 },
          { branch: 'Pune Branch', amount: 2800000 },
          { branch: 'Nagpur Branch', amount: 2100000 },
          { branch: 'Nashik Branch', amount: 1800000 },
          { branch: 'Aurangabad Branch', amount: 1500000 },
          { branch: 'Solapur Branch', amount: 1200000 }
        ],
        distByAmount: [
          { name: 'Mumbai', amount: 2000000 },
          { name: 'Pune', amount: 1500000 },
          { name: 'Nashik', amount: 800000 },
          { name: 'Nagpur', amount: 600000 }
        ],
        amountByClosingDate: [
          { closingDate: '2024-01', PPO: 500000, PSD: 300000, PPE: 200000 },
          { closingDate: '2024-02', PPO: 600000, PSD: 400000, PPE: 300000 },
          { closingDate: '2024-03', PPO: 400000, PSD: 500000, PPE: 100000 }
        ],
        contactWiseAmount: [
          { contactName: 'Rajesh Kumar', amount: 500000 },
          { contactName: 'Priya Sharma', amount: 350000 },
          { contactName: 'Amit Patel', amount: 280000 },
          { contactName: 'Sneha Reddy', amount: 220000 }
        ],
        departmentWiseStage: [
          { department: 'PPO', stageDuration: '5:23:45' },
          { department: 'PSD', stageDuration: '3:45:12' },
          { department: 'PPE', stageDuration: '7:12:30' },
          { department: 'HHD', stageDuration: '4:30:15' }
        ],
        bankBranchWiseAmount: [
          { bankName: 'SBI', amount: 2500000 },
          { bankName: 'HDFC', amount: 1800000 },
          { bankName: 'ICICI', amount: 1200000 },
          { bankName: 'Axis', amount: 800000 }
        ],
        funnelData: {
          'PPO': [
            { stage: 'NEW_LEAD', count: 120 },
            { stage: 'DOC_COLLECT', count: 95 },
            { stage: 'DRAFT', count: 75 },
            { stage: 'OTH', count: 60 },
            { stage: 'FILEING', count: 45 },
            { stage: 'FOLLOWUP', count: 30 },
            { stage: 'ACCOUNT', count: 15 }
          ],
          'HLC': [
            { stage: 'NEW_LEAD', count: 80 },
            { stage: 'ELIGIBILITY', count: 65 },
            { stage: 'DOCUMENTS', count: 50 },
            { stage: 'PROCESSING', count: 35 },
            { stage: 'LOAN_APPLICATION', count: 25 },
            { stage: 'LOAN_SANCTION', count: 18 },
            { stage: 'ACCOUNT', count: 10 }
          ],
          'ACCOUNT': [
            { stage: 'INVENTORY', count: 100 },
            { stage: 'MAKE_BILL', count: 85 },
            { stage: 'BILL_SUBMIT', count: 70 },
            { stage: 'BILL_FOLLOWUP', count: 55 },
            { stage: 'BILL_PASS', count: 40 },
            { stage: 'CLOSE_WIN', count: 25 },
            { stage: 'CLOSE_LOST', count: 5 }
          ],
          'PPE': [
            { stage: 'NEW_LEAD', count: 90 },
            { stage: 'PDO', count: 75 },
            { stage: 'EVALUATION', count: 60 },
            { stage: 'PPS', count: 45 },
            { stage: 'REVIEW', count: 30 },
            { stage: 'DOP', count: 20 },
            { stage: 'ACCOUNT', count: 12 }
          ],
          'PSD': [
            { stage: 'NEW_LEAD', count: 70 },
            { stage: 'EVALUATION', count: 58 },
            { stage: 'BUYER_REGD', count: 46 },
            { stage: 'EMD_REGD', count: 35 },
            { stage: 'SALE', count: 24 },
            { stage: 'REMAINING_AMT', count: 15 },
            { stage: 'ACCOUNT', count: 8 }
          ],
          'ROP': [
            { stage: 'NEW_LEAD', count: 60 },
            { stage: 'LOD', count: 50 },
            { stage: 'RRV', count: 40 },
            { stage: 'QUOTATION', count: 30 },
            { stage: 'DRAFTING', count: 20 },
            { stage: 'REGISTRATION', count: 12 },
            { stage: 'ACCOUNT', count: 6 }
          ]
        }
      };

      const dummyTableData = [
        {
          id: 1,
          accountNo: 'ACC001',
          allocationDate: '2024-01-15',
          agreementNo: 'AGR001',
          customerName: 'Rajesh Kumar',
          village: 'Village A',
          taluka: 'Taluka X',
          district: 'Mumbai',
          bankName: 'SBI',
          branchName: 'Andheri',
          contactName: 'Rajesh Kumar',
          department: 'PPO',
          product: 'Personal Loan',
          stage: 'Documentation',
          closingDate: '2024-02-15',
          amount: 500000,
          expenses: 5000,
          remarks: 'Regular customer',
          accountStatus: 'Active'
        },
        {
          id: 2,
          accountNo: 'ACC002',
          allocationDate: '2024-01-20',
          agreementNo: 'AGR002',
          customerName: 'Priya Sharma',
          village: 'Village B',
          taluka: 'Taluka Y',
          district: 'Pune',
          bankName: 'HDFC',
          branchName: 'Koregaon',
          contactName: 'Priya Sharma',
          department: 'PSD',
          product: 'Home Loan',
          stage: 'Verification',
          closingDate: '2024-03-20',
          amount: 350000,
          expenses: 3500,
          remarks: 'New application',
          accountStatus: 'Active'
        }
      ];

      const dummyFilterOptions = {
        departments: ['PPO', 'PSD', 'PPE', 'HHD'],
        talukas: ['Taluka X', 'Taluka Y', 'Taluka Z'],
        districts: ['Mumbai', 'Pune', 'Nashik', 'Nagpur'],
        banks: ['SBI', 'HDFC', 'ICICI', 'Axis'],
        branches: ['Andheri', 'Koregaon', 'Camp', 'Civil Lines'],
        customers: ['Rajesh Kumar', 'Priya Sharma', 'Amit Patel', 'Sneha Reddy'],
        allocations: ['North', 'South', 'East', 'West']
      };

      // ✅ Update chart data
      setChartData(dummyChartData);

      // ✅ Update table data
      setTableData(dummyTableData);
      setPagination({
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1
      });

      // ✅ Update filter options
      setFilterOptions(dummyFilterOptions);

    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      // Show error state
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH FILTER OPTIONS (removed - using dummy data)
  
  useEffect(() => {
    fetchDashboardData();
  }, []);

  // ✅ HANDLE FILTER CHANGE
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  // ✅ APPLY FILTERS
  const applyFilters = () => {
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
    fetchDashboardData();
  };

  // ✅ RESET FILTERS
  const resetFilters = () => {
    setFilters({
      dateRange: { start: '', end: '' },
      department: '',
      taluka: '',
      district: '',
      bankName: '',
      branchName: '',
      customerName: '',
      allocation: ''
    });
    setPagination(prev => ({ ...prev, page: 1 }));
    setTimeout(fetchDashboardData, 100);
  };

  // ✅ HANDLE PAGE CHANGE
  const handlePageChange = (newPage) => {
    setPagination(prev => ({ ...prev, page: newPage }));
    fetchDashboardData();
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* ✅ HEADER */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              CRM System - Yashraj
            </h1>
            <p className="text-gray-600 mt-1">
              Professional Analytics Dashboard for {userRole}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              <Download className="h-4 w-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* ✅ FILTERS SECTION */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-600" />
            <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
          </div>
          
          {/* ✅ Department Selector for ADMIN/MANAGER */}
          {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Department:</label>
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Departments</option>
                <option value="PPO">PPO</option>
                <option value="PSD">PSD</option>
                <option value="PPE">PPE</option>
                <option value="HHD">HHD</option>
              </select>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {/* Date Range */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={filters.dateRange.start}
              onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, start: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={filters.dateRange.end}
              onChange={(e) => handleFilterChange('dateRange', { ...filters.dateRange, end: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Department */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
            <select
              value={filters.department}
              onChange={(e) => handleFilterChange('department', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Departments</option>
              {filterOptions.departments?.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>

          {/* District */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">District</label>
            <select
              value={filters.district}
              onChange={(e) => handleFilterChange('district', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Districts</option>
              {filterOptions.districts?.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>

          {/* Bank Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Bank Name</label>
            <select
              value={filters.bankName}
              onChange={(e) => handleFilterChange('bankName', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">All Banks</option>
              {filterOptions.banks?.map(bank => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>

          {/* Additional filters can be added here */}
        </div>

        <div className="flex items-center gap-3 mt-4">
          <button
            onClick={applyFilters}
            disabled={loading}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            Apply Filters
          </button>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
        </div>
      </div>

      {/* ✅ CHARTS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6 mb-6">
        
        {/* ✅ FUNNEL CHART - NEW */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 lg:col-span-2 xl:col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Funnel Chart - Stage Wise Count
            </h3>
            
            {/* ✅ Department Dropdown for Funnel Chart */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Department:</label>
              <div className="relative">
                <select
                  value={selectedDepartment || 'ACCOUNT'}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="appearance-none px-4 py-2 pr-8 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>
          
          <FunnelChart 
            data={chartData.funnelData[selectedDepartment || 'ACCOUNT'] || []} 
            department={selectedDepartment || 'ACCOUNT'} 
            stages={getStagesForDepartment(selectedDepartment || 'ACCOUNT')}
          />
        </div>
        
        {/* Department by Amount - Horizontal Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department by Amount</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.departmentByAmount}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <Bar dataKey="amount" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Yashrqj Enterprises Branch by Amount - Horizontal Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Yashraj Enterprises Branch</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.yashrqjBranchByAmount}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="branch" />
              <YAxis />
              <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <Bar dataKey="amount" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Contact Wise Amount - Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Wise Amount</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.contactWiseAmount}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="contactName" />
              <YAxis />
              <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <Bar dataKey="amount" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Amount by Closing Date and Department - Horizontal Straight Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 lg:col-span-2 xl:col-span-3">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Amount by Closing Date and Department</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.amountByClosingDate}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="closingDate" />
              <YAxis />
              <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <RechartsLegend />
              <Bar dataKey="PPO" fill="#8884d8" />
              <Bar dataKey="PSD" fill="#82ca9d" />
              <Bar dataKey="PPE" fill="#ffc658" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Department Wise Stage - Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Wise Stage</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.departmentWiseStage}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="department" />
              <YAxis />
              <RechartsTooltip />
              <Bar dataKey="stageDuration" fill="#82ca9d" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Bank + Branch Wise Amount - Stacked Bar Chart */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 lg:col-span-2">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank + Branch Wise Amount</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData.bankBranchWiseAmount}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="bankName" />
              <YAxis />
              <RechartsTooltip formatter={(value) => `₹${value.toLocaleString()}`} />
              <RechartsLegend />
              <Bar dataKey="amount" fill="#8884d8" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ✅ DATA TABLE */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Account Details</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Account No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Allocation Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Agreement No</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Customer Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Village / Taluka / District</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Bank / Branch</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Contact Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Department</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Product</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Stage</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Closing Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Expenses</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Remarks</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Account Status</th>
                <th className="px-4 py-3 text-left font-medium text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {tableData.map((account, index) => (
                <tr key={account.id || index} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{account.accountNo}</td>
                  <td className="px-4 py-3">{account.allocationDate}</td>
                  <td className="px-4 py-3">{account.agreementNo}</td>
                  <td className="px-4 py-3 font-medium">{account.customerName}</td>
                  <td className="px-4 py-3 text-xs">
                    <div>{account.village}</div>
                    <div className="text-gray-500">{account.taluka} / {account.district}</div>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <div>{account.bankName}</div>
                    <div className="text-gray-500">{account.branchName}</div>
                  </td>
                  <td className="px-4 py-3">{account.contactName}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                      {account.department}
                    </span>
                  </td>
                  <td className="px-4 py-3">{account.product}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs">
                      {account.stage}
                    </span>
                  </td>
                  <td className="px-4 py-3">{account.closingDate}</td>
                  <td className="px-4 py-3 font-medium">₹{account.amount?.toLocaleString()}</td>
                  <td className="px-4 py-3">₹{account.expenses?.toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs max-w-xs truncate">{account.remarks}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs ${
                      account.accountStatus === 'Active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {account.accountStatus}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button className="text-indigo-600 hover:text-indigo-800">
                      <Eye className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ✅ PAGINATION */}
        <div className="p-4 border-t border-gray-200 flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {((pagination.page - 1) * pagination.limit) + 1} to{' '}
            {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
            {pagination.total} results
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => handlePageChange(pagination.page - 1)}
              disabled={pagination.page <= 1}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <span className="px-3 py-1 text-sm">
              Page {pagination.page} of {pagination.totalPages}
            </span>
            <button
              onClick={() => handlePageChange(pagination.page + 1)}
              disabled={pagination.page >= pagination.totalPages}
              className="px-3 py-1 border border-gray-300 rounded-md text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect, useMemo } from "react";
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
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";
import { broadcastActivity, createActivity } from "@/utils/activityBus";

// ✅ CHART COMPONENTS
import { PieChart as RechartsPieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend as RechartsLegend } from 'recharts';
import { ChevronDown } from 'lucide-react';
import { useStages } from '@/context/StageContext';
import { departmentApiService } from "@/services/departmentApi.service";

// ✅ FILTER COLORS
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

// ✅ Funnel Chart Component - Dynamic with Real Data
const FunnelChart = ({ data, department, stages }) => {
  // Always show funnel, even with 0 counts
  if (!stages || stages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-gray-500 text-center">
          <div className="text-lg font-medium mb-2">No stages configured</div>
          <div className="text-sm">Please configure stages for {department || 'this department'}</div>
        </div>
      </div>
    );
  }

  // Build display data - show ALL stages even if count is 0
  const displayData = stages.map(stage => ({
    stage: stage.stageName,
    count: data.find(d => d.stage === stage.stageCode)?.count || 0
  }));

  // Additional safety check
  if (!displayData || displayData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8">
        <div className="text-gray-500 text-center">
          <div className="text-lg font-medium mb-2">No display data available</div>
          <div className="text-sm">Department: {department || 'Unknown'}</div>
        </div>
      </div>
    );
  }

  const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316', '#06B6D4', '#84CC16'];
  
  // Dynamic height based on number of stages - smaller size
  const svgHeight = Math.max(250, displayData.length * 40);
  const stageHeight = svgHeight / displayData.length;
  
  return (
    <div className="flex flex-col items-center justify-center py-2">
      <svg width="100%" height={svgHeight} viewBox={`0 0 300 ${svgHeight}`} className="max-w-xs">
        {displayData.map((stage, index) => {
          const y = index * stageHeight;
          
          // Fixed funnel shape based on stage index, NOT count
          const totalStages = displayData.length;
          const maxWidth = 220; // Reduced from 300
          const minWidth = 40;  // Reduced from 60
          const step = (maxWidth - minWidth) / (totalStages - 1);
          
          const currentWidth = maxWidth - index * step;
          const nextWidth = index < totalStages - 1 
            ? maxWidth - (index + 1) * step
            : minWidth;
          
          const centerX = 150; // Adjusted for 300 viewBox width
          
          // Create smooth trapezoid path - single line to avoid Turbopack parsing issues
          const path = `M ${centerX - currentWidth/2} ${y} L ${centerX + currentWidth/2} ${y} L ${centerX + nextWidth/2} ${y + stageHeight} L ${centerX - nextWidth/2} ${y + stageHeight} Z`;
          
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
                d={`M ${centerX + currentWidth/2} ${y} L ${centerX + currentWidth/2 + 8} ${y} L ${centerX + nextWidth/2 + 8} ${y + stageHeight} L ${centerX + nextWidth/2} ${y + stageHeight} Z`}
                fill="rgba(0,0,0,0.15)"
              />
              
              {/* Stage count text */}
              <text
                x={centerX}
                y={y + stageHeight/2}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="white"
                fontSize="12" // Reduced from 14
                fontWeight="bold"
              >
                {stage.count}
              </text>
              
              {/* Stage label - positioned outside */}
              <text
                x={centerX + Math.max(currentWidth, nextWidth)/2 + 10} // Reduced spacing
                y={y + stageHeight/2}
                textAnchor="start"
                dominantBaseline="middle"
                fill="#374151"
                fontSize="10" // Reduced from 12
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
  // ✅ Get current logged-in user name for activities
  const currentUserName = getCurrentUserName();
  const currentUserRole = getCurrentUserRole();
  
  // ✅ Use real stage data
  const { departments, getStagesForDepartment, fetchStagesForDepartment, fetchDepartments } = useStages();
  
  // ✅ DATA STATES
  const [customers, setCustomers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [products, setProducts] = useState([]);
  const [bankRecords, setBankRecords] = useState([]);
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

  const [selectedDepartment, setSelectedDepartment] = useState('ALL');

  const [tableData, setTableData] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0
  });

  const [loading, setLoading] = useState(false);
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

  const funnelCounts = useMemo(() => {
    if (!deals.length) return [];

    if (selectedDepartment === 'ALL') {
      // Aggregate all deals by stageCode
      const stageMap = {};
      deals.forEach(deal => {
        const code = deal.stageCode || deal.stage || '';
        if (code) stageMap[code] = (stageMap[code] || 0) + 1;
      });
      return Object.entries(stageMap)
        .sort((a, b) => b[1] - a[1])
        .map(([stage, count]) => ({ stage, count }));
    }

    // Specific department
    const deptDeals = deals.filter(d => d.department === selectedDepartment);
    const stages = getStagesForDepartment(selectedDepartment) || [];

    if (!stages.length) {
      // No stage config — derive from actual deal data
      const stageMap = {};
      deptDeals.forEach(d => {
        const code = d.stageCode || d.stage || '';
        if (code) stageMap[code] = (stageMap[code] || 0) + 1;
      });
      return Object.entries(stageMap).map(([stage, count]) => ({ stage, count }));
    }

    // Match stageCode as-is (no uppercase transform — deals page doesn't transform)
    const stageMap = {};
    stages.forEach(s => { stageMap[s.stageCode] = 0; });
    deptDeals.forEach(deal => {
      const code = deal.stageCode || deal.stage || '';
      if (stageMap.hasOwnProperty(code)) stageMap[code]++;
      // Also try uppercase match as fallback
      else if (stageMap.hasOwnProperty(code.toUpperCase())) stageMap[code.toUpperCase()]++;
    });
    return stages.map(s => ({ stage: s.stageCode, count: stageMap[s.stageCode] || 0 }));
  }, [deals, selectedDepartment, getStagesForDepartment]);

  const bankDepartmentStats = useMemo(() => {
    if (!deals.length) return [];

    // One row per unique Bank + Branch + Taluka from actual deal data
    const rowMap = {};
    deals.forEach(d => {
      const bankName   = d.bankName || d.relatedBankName || '-';
      const branchName = d.branchName || d.branch || '-';
      const taluka     = d.taluka || '-';
      const district   = d.district || '-';
      const key = bankName + '||' + branchName + '||' + taluka + '||' + district;
      if (!rowMap[key]) {
        rowMap[key] = { bankName, branchName, taluka, district, totalDeals: 0, departments: {} };
        departments.forEach(dept => { rowMap[key].departments[dept] = 0; });
      }
      rowMap[key].totalDeals++;
      if (d.department && rowMap[key].departments.hasOwnProperty(d.department)) {
        rowMap[key].departments[d.department]++;
      }
    });

    return Object.values(rowMap)
      .sort((a, b) => a.bankName.localeCompare(b.bankName) || a.branchName.localeCompare(b.branchName));
  }, [deals, departments]);

  const dashboardStats = useMemo(() => {
    const totalValue = deals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0);
    const departmentStats = {};
    departments.forEach(dept => {
      const deptDeals = deals.filter(d => d.department === dept);
      departmentStats[dept] = {
        count: deptDeals.length,
        value: deptDeals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0)
      };
    });
    return { totalDeals: deals.length, totalValue, departmentStats };
  }, [deals, departments]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // Read auth user exactly like customers page does
      const getAuthUser = () => {
        try {
          let raw = null;
          if (typeof window !== 'undefined') {
            const tabId = sessionStorage.getItem('tab_id');
            if (tabId) raw = sessionStorage.getItem(`user_data_${tabId}`);
            if (!raw) raw = localStorage.getItem('user_data');
          }
          return raw ? JSON.parse(raw) : null;
        } catch { return null; }
      };
      const authUser = getAuthUser();

      const [customersData, dealsData, tasksData, productsData, bankData] = await Promise.all([
        departmentApiService.getCustomers().catch(() => []),
        // ✅ Use backendApi exactly like customers page - it auto-adds X-User headers
        backendApi.get("/deals/filtered", {
          headers: {
            "X-User-Role":       authUser?.role ?? "",
            "X-User-Department": authUser?.department ?? "",
          }
        }).catch(() => []),
        backendApi.get("/tasks").catch(() => []),
        backendApi.get("/products").catch(() => []),
        backendApi.get("/banks").catch(() => [])
      ]);

      const normalizeList = (res) => {
        if (!res) return [];
        if (Array.isArray(res)) return res;
        if (res.content && Array.isArray(res.content)) return res.content;
        return [];
      };

      const normalizedCustomers = normalizeList(customersData);
      const normalizedDealsList = normalizeList(dealsData);
      const normalizedTasks = normalizeList(tasksData);
      const normalizedProducts = normalizeList(productsData);
      const normalizedBanks = normalizeList(bankData);

      // Normalize deals exactly like customers page
      const allDeals = normalizedDealsList.map((d) => ({
        ...d,
        clientId: d.clientId ?? d.client_id ?? (typeof d.client === 'object' ? d.client?.id : d.client) ?? null,
        stageCode: d.stage || d.stageCode || "",
        department: d.department || "",
        valueAmount: d.calculatedValue ?? d.valueAmount ?? d.value_amount ?? 0,
      }));

      // Use ALL deals for stats (not deduplicated) so department counts are accurate
      setCustomers(normalizedCustomers);
      setDeals(allDeals);
      setProducts(normalizedProducts);
      setBankRecords(normalizedBanks);
      setTasks(normalizedTasks);

      setChartData({
        departmentByAmount: departments.map(dept => {
          const deptDeals = allDeals.filter(deal => deal.department === dept);
          return {
            department: dept,
            amount: deptDeals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0),
            count: deptDeals.length
          };
        })
      });

      const dynamicTableData = normalizedCustomers.slice(0, 10).map((customer, index) => ({
        id: customer.id || index + 1,
        customerName: customer.name || customer.customerName || 'Unknown',
        department: allDeals.find(d => String(d.clientId) === String(customer.id))?.department || 'Unassigned',
        stage: allDeals.find(d => String(d.clientId) === String(customer.id))?.stageCode || '',
        amount: allDeals.find(d => String(d.clientId) === String(customer.id))?.valueAmount || 0,
      }));
      setTableData(dynamicTableData);
      setPagination({ page: 1, limit: 10, total: normalizedCustomers.length, totalPages: Math.ceil(normalizedCustomers.length / 10) });
    } catch (error) {
      console.error('[DASHBOARD] Error fetching data:', error);
      setCustomers([]); setDeals([]); setTasks([]); setProducts([]); setBankRecords([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchDashboardData(),
        fetchDepartments(),
        fetchStagesForDepartment(selectedDepartment === 'ALL' ? departments[0] : selectedDepartment)
      ]);
    } catch (error) {
      console.error('[DASHBOARD] Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const interval = setInterval(() => fetchDashboardData(), 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('crm-updates');
      broadcastChannel.onmessage = (e) => {
        if (e.data?.type) fetchDashboardData();
      };
    }
    return () => { if (broadcastChannel) broadcastChannel.close(); };
  }, []);

  useEffect(() => {
    fetchAllData();
    const timeout = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(timeout);
  }, [selectedDepartment]);

  // ✅ HANDLE FILTER CHANGE
  const handleFilterChange = (filterName, value) => {
    setFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
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
  };

  // ✅ DYNAMIC DASHBOARD CARDS
  const dashboardCards = useMemo(() => [
    {
      title: "Total Customers",
      value: customers.length.toLocaleString(),
      icon: <Users className="h-6 w-6" />,
      color: "blue"
    },
    {
      title: "Total Deals",
      value: deals.length.toLocaleString(),
      subtitle: `across ${customers.length} customers`,
      icon: <BarChart3 className="h-6 w-6" />,
      color: "indigo"
    },
    {
      title: "Pipeline Value",
      value: `₹${(dashboardStats.totalValue / 100000).toFixed(1)}L`,
      icon: <DollarSign className="h-6 w-6" />,
      color: "green"
    },
    {
      title: "Departments",
      value: departments.length,
      icon: <Building2 className="h-6 w-6" />,
      color: "orange"
    }
  ], [dashboardStats, customers.length, deals.length, departments.length]);

  // ✅ HANDLE PAGE CHANGE
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">CRM System - Yashraj</h1>
          <p className="text-gray-600 mt-1">Welcome back, {userName || 'Admin User'}</p>
        </div>
        <button
          onClick={fetchDashboardData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {dashboardCards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-5 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-500">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{card.value}</p>
                {card.subtitle && <p className="text-xs text-gray-400 mt-0.5">{card.subtitle}</p>}
              </div>
              <div className={`p-3 rounded-lg bg-${card.color}-100 text-${card.color}-600`}>
                {card.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ROW 1: FUNNEL (left) + DEPARTMENT STATISTICS (right) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

        {/* Funnel Chart */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Pipeline Funnel</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium text-gray-600">Dept:</label>
              <div className="relative">
                <select value={selectedDepartment} onChange={e => setSelectedDepartment(e.target.value)}
                  className="appearance-none pl-3 pr-7 py-1.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                  <option value="ALL">All</option>
                  {departments.map(dept => <option key={dept} value={dept}>{dept}</option>)}
                </select>
                <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>
          <FunnelChart
            data={funnelCounts}
            department={selectedDepartment}
            stages={selectedDepartment === 'ALL'
              ? funnelCounts.map((fc, i) => ({ stageCode: fc.stage, stageName: fc.stage, stageOrder: i + 1 }))
              : (() => {
                  const s = getStagesForDepartment(selectedDepartment) || [];
                  return s.length > 0 ? s : funnelCounts.map((fc, i) => ({ stageCode: fc.stage, stageName: fc.stage, stageOrder: i + 1 }));
                })()
            }
          />
        </div>

        {/* Department Statistics */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Statistics</h3>
          <div className="space-y-3">
            {(() => {
              const deptStats = {};
              departments.forEach(dept => { deptStats[dept] = { count: 0, amount: 0 }; });
              deals.forEach(deal => {
                const d = deal.department;
                if (d) {
                  if (!deptStats[d]) deptStats[d] = { count: 0, amount: 0 };
                  deptStats[d].count++;
                  deptStats[d].amount += Number(deal.valueAmount) || 0;
                }
              });
              return Object.entries(deptStats).map(([dept, stats]) => (
                <div key={dept} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{dept}</p>
                    <p className="text-xs text-gray-500">{stats.count} deals</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-indigo-700">₹{stats.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">Total Value</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>

      {/* ROW 2: BANK-WISE TABLE — banks as rows, departments as columns */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900">Bank-wise Deal Count by Department</h3>
          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
            {bankDepartmentStats.length} banks with deals
          </span>
        </div>

        {bankDepartmentStats.length === 0 ? (
          <div className="py-12 text-center text-gray-400 text-sm">
            {deals.length === 0 ? 'Loading data...' : 'No bank data found. Ensure deals have bankId or bankName set.'}
          </div>
        ) : (
          <div style={{maxHeight:'480px',overflowY:'auto',overflowX:'auto'}}>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50" style={{position:'sticky',top:0,zIndex:30}}>
                <tr>
                  <th style={{position:'sticky',left:0,zIndex:20,background:'rgb(248 250 252)',minWidth:'160px'}}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    Bank
                  </th>
                  <th style={{position:'sticky',left:'160px',zIndex:20,background:'rgb(248 250 252)',minWidth:'130px'}}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    Branch
                  </th>
                  <th style={{position:'sticky',left:'290px',zIndex:20,background:'rgb(248 250 252)',minWidth:'120px'}}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    Taluka
                  </th>
                  <th style={{position:'sticky',left:'410px',zIndex:20,background:'rgb(248 250 252)',minWidth:'120px'}}
                    className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider border-r border-gray-200 whitespace-nowrap">
                    District
                  </th>
                  {departments.map(dept => (
                    <th key={dept} className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider whitespace-nowrap">{dept}</th>
                  ))}
                  <th className="px-4 py-3 text-center text-xs font-semibold text-indigo-700 uppercase tracking-wider bg-indigo-50 whitespace-nowrap">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {bankDepartmentStats.map(bank => (
                  <tr key={`${bank.bankName}||${bank.branchName}||${bank.taluka}||${bank.district}`} className="hover:bg-gray-50">
                    <td style={{position:'sticky',left:0,zIndex:10,background:'white',minWidth:'160px'}}
                      className="px-4 py-3 font-medium text-gray-900 border-r border-gray-100 whitespace-nowrap">
                      {bank.bankName}
                    </td>
                    <td style={{position:'sticky',left:'160px',zIndex:10,background:'white',minWidth:'130px'}}
                      className="px-4 py-3 text-xs text-gray-500 border-r border-gray-100 whitespace-nowrap">
                      {bank.branchName}
                    </td>
                    <td style={{position:'sticky',left:'290px',zIndex:10,background:'white',minWidth:'120px'}}
                      className="px-4 py-3 text-xs text-gray-500 border-r border-gray-100 whitespace-nowrap">
                      {bank.taluka}
                    </td>
                    <td style={{position:'sticky',left:'410px',zIndex:10,background:'white',minWidth:'120px'}}
                      className="px-4 py-3 text-xs text-gray-500 border-r border-gray-100 whitespace-nowrap">
                      {bank.district}
                    </td>
                    {departments.map(dept => (
                      <td key={dept} className="px-4 py-3 text-center">
                        {bank.departments[dept] > 0
                          ? <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-bold text-xs">{bank.departments[dept]}</span>
                          : <span className="text-gray-300 text-xs">—</span>
                        }
                      </td>
                    ))}
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center justify-center px-3 py-1 rounded-full bg-indigo-600 text-white font-bold text-xs">{bank.totalDeals}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-gray-200">
                <tr>
                  <td style={{position:'sticky',left:0,zIndex:10,background:'rgb(248 250 252)',minWidth:'160px'}}
                    className="px-4 py-3 font-bold text-gray-900 border-r border-gray-200">Total</td>
                  <td style={{position:'sticky',left:'160px',zIndex:10,background:'rgb(248 250 252)',minWidth:'130px'}}
                    className="px-4 py-3 border-r border-gray-200"></td>
                  <td style={{position:'sticky',left:'290px',zIndex:10,background:'rgb(248 250 252)',minWidth:'120px'}}
                    className="px-4 py-3 border-r border-gray-200"></td>
                  <td style={{position:'sticky',left:'410px',zIndex:10,background:'rgb(248 250 252)',minWidth:'120px'}}
                    className="px-4 py-3 border-r border-gray-200"></td>
                  {departments.map(dept => {
                    const total = bankDepartmentStats.reduce((s, b) => s + (b.departments[dept] || 0), 0);
                    return (
                      <td key={dept} className="px-4 py-3 text-center">
                        <span className="font-bold text-gray-800">{total || '—'}</span>
                      </td>
                    );
                  })}
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-indigo-700">
                      {bankDepartmentStats.reduce((s, b) => s + b.totalDeals, 0)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

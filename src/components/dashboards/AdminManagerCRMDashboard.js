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

  // ✅ DYNAMIC FUNNEL COUNTS - O(n) performance with useMemo
  const funnelCounts = useMemo(() => {
    console.log('🔥 [DASHBOARD] Computing funnel counts for department:', selectedDepartment);
    
    // Get stages for selected department
    let stages = getStagesForDepartment(selectedDepartment === 'ALL' ? departments[0] : selectedDepartment);
    
    // Fallback stages for ACCOUNT department
    if (!stages || stages.length === 0) {
      if (selectedDepartment === 'ACCOUNT' || (selectedDepartment === 'ALL' && departments[0] === 'ACCOUNT')) {
        console.log('🔥 [DASHBOARD] Using fallback stages for ACCOUNT department');
        stages = [
          { stageCode: 'INVENTORY', stageName: 'Inventory', stageOrder: 1 },
          { stageCode: 'MAKE_BILL', stageName: 'Make Bill', stageOrder: 2 },
          { stageCode: 'BILL_SUBMIT', stageName: 'Bill Submit', stageOrder: 3 },
          { stageCode: 'BILL_FOLLOWUP', stageName: 'Bill Followup', stageOrder: 4 },
          { stageCode: 'BILL_PASS', stageName: 'Bill Pass', stageOrder: 5 },
          { stageCode: 'CLOSE_WIN', stageName: 'Close Win', stageOrder: 6 },
          { stageCode: 'CLOSE_LOST', stageName: 'Close Lost', stageOrder: 7 }
        ];
      } else {
        // Generic fallback stages for other departments
        console.log('🔥 [DASHBOARD] Using generic fallback stages for department:', selectedDepartment);
        stages = [
          { stageCode: 'LEAD', stageName: 'Lead', stageOrder: 1 },
          { stageCode: 'CONTACTED', stageName: 'Contacted', stageOrder: 2 },
          { stageCode: 'QUALIFIED', stageName: 'Qualified', stageOrder: 3 },
          { stageCode: 'PROPOSAL', stageName: 'Proposal', stageOrder: 4 },
          { stageCode: 'NEGOTIATION', stageName: 'Negotiation', stageOrder: 5 },
          { stageCode: 'CLOSE_WIN', stageName: 'Close Win', stageOrder: 6 },
          { stageCode: 'CLOSE_LOST', stageName: 'Close Lost', stageOrder: 7 }
        ];
      }
    }

    // Filter deals by department
    const filteredDeals = selectedDepartment === 'ALL' 
      ? deals 
      : deals.filter(d => d.department === selectedDepartment);

    console.log('🔥 [DASHBOARD] Filtered deals:', filteredDeals.length, 'for department:', selectedDepartment);

    // O(n) stage counting using stageMap
    const stageMap = {};
    stages.forEach(stage => {
      stageMap[stage.stageCode] = 0;
    });

    filteredDeals.forEach(deal => {
      const stageCode = deal.stageCode || deal.stage;
      if (stageMap.hasOwnProperty(stageCode)) {
        stageMap[stageCode]++;
      }
    });

    // Convert to array format
    return Object.entries(stageMap).map(([stage, count]) => ({
      stage,
      count
    }));
  }, [deals, selectedDepartment, departments, getStagesForDepartment]);

  // ✅ BANK DEPARTMENT STATS - Calculate bank-wise deal distribution
  const bankDepartmentStats = useMemo(() => {
    console.log('🔥 [DASHBOARD] Computing bank department stats');
    
    if (!deals.length || !bankRecords.length) {
      console.log('🔥 [DASHBOARD] No deals or banks available for stats');
      return [];
    }

    const result = bankRecords.map(bank => {
      const deptCounts = {};
      
      // Initialize all departments with 0
      departments.forEach(dept => {
        deptCounts[dept] = deals.filter(
          d => d.bankId === bank.id && d.department === dept
        ).length;
      });

      const totalDeals = deals.filter(d => d.bankId === bank.id).length;

      return {
        bankName: bank.name || bank.bankName,
        bankId: bank.id,
        totalDeals,
        departments: deptCounts
      };
    });

    // Sort by total deals descending
    result.sort((a, b) => b.totalDeals - a.totalDeals);

    console.log('🔥 [DASHBOARD] Bank department stats calculated:', result);
    return result;
  }, [deals, bankRecords, departments]);

  // ✅ DYNAMIC DASHBOARD STATS - useMemo for performance
  const dashboardStats = useMemo(() => {
    if (!deals.length) return null;

    const stats = {
      totalDeals: deals.length,
      totalValue: deals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0),
      departmentStats: {},
      pipelineCounts: {}
    };

    // Calculate department-wise stats
    departments.forEach(dept => {
      const deptDeals = deals.filter(d => d.department === dept);
      stats.departmentStats[dept] = {
        count: deptDeals.length,
        value: deptDeals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0)
      };
    });

    console.log('🔥 [DASHBOARD] Dashboard stats computed:', stats);
    return stats;
  }, [deals, departments]);

  useEffect(() => {
    if (customers.length > 0 || deals.length > 0 || tasks.length > 0 || 
        products.length > 0 || bankRecords.length > 0) {
      console.log('🔥 [ADMIN DASHBOARD] Data loaded - activities section removed');
    }
  }, [customers, deals, tasks, products, bankRecords]);

  // 🔥 NEW: Fetch products for deals to calculate accurate values (like customers page)
  const fetchDealProducts = async (dealId) => {
    try {
      const res = await backendApi.get(`/deals/${dealId}/products`);
      const list = Array.isArray(res?.content) ? res.content : Array.isArray(res) ? res : [];
      
      // Adapt products like the customers page does
      const adaptedProducts = list.map((ln) => {
        const price = Number(ln.price ?? ln.unitPrice ?? 0) || 0;
        const qty = Number(ln.qty ?? ln.quantity ?? 1) || 1;
        const discount = Number(ln.discount ?? ln.discountAmount ?? 0) || 0;
        const tax = Number(ln.tax ?? ln.taxAmount ?? 0) || 0;
        
        return {
          id: ln.id,
          dealProductId: ln.id,
          productId: ln.productId ?? null,
          name: ln.productName || ln.name || "Unknown Product",
          price,
          qty,
          discount,
          tax,
          finalAmount: price * qty - discount + tax
        };
      });
      
      return adaptedProducts;
    } catch (err) {
      console.error(`Failed to fetch products for deal ${dealId}:`, err);
      return [];
    }
  };

  // 🔥 NEW: Calculate grand total from products (same as customers page)
  const calculateGrandTotal = (products) => {
    return products.reduce(
      (sum, p) => sum + (p.price * p.qty - (p.discount || 0) + (p.tax || 0)),
      0
    );
  };
  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      console.log('🔥 [DASHBOARD] Fetching all system data sources for:', userRole);
      
      // Fetch all data sources in parallel
      const [customersData, dealsData, tasksData, productsData, bankData] = await Promise.all([
        departmentApiService.getCustomers().catch(() => []),
        backendApi.get("/deals").catch(() => []),
        backendApi.get("/tasks").catch(() => []),
        backendApi.get("/products").catch(() => []),
        backendApi.get("/banks").catch(() => [])
      ]);

      // Normalize customers data
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

      // 🔥 CRITICAL: Calculate deal values from products (like customers page)
      const normalizedDeals = await Promise.all(normalizedDealsList.map(async (d) => {
        // Normalize basic fields first
        const basicDeal = {
          ...d,
          clientId: d.clientId ?? d.client_id ?? d.client ?? null,
          stageCode: d.stage || d.stageCode || "",
          department: d.department || userRole || 'ALL'
        };

        // 🔥 NEW: Fetch products and calculate actual value (like customers page)
        try {
          const products = await fetchDealProducts(d.id);
          const calculatedValue = calculateGrandTotal(products);
          
          console.log(`🔍 Deal ${d.id} (${d.name}): ${products.length} products, calculated value: ₹${calculatedValue}`);
          
          return {
            ...basicDeal,
            valueAmount: calculatedValue > 0 ? calculatedValue : d.valueAmount ?? d.value_amount ?? 0,
            _productCount: products.length,
            _calculatedValue: calculatedValue
          };
        } catch (productErr) {
          console.warn(`Failed to calculate value for deal ${d.id}, using fallback:`, productErr);
          return {
            ...basicDeal,
            valueAmount: d.valueAmount ?? d.value_amount ?? 0,
            _productCount: 0,
            _calculatedValue: 0
          };
        }
      }));

      console.log('🔥 [DASHBOARD] All system data loaded successfully:', {
        customers: normalizedCustomers.length,
        deals: normalizedDeals.length,
        tasks: normalizedTasks.length,
        products: normalizedProducts.length,
        banks: normalizedBanks.length
      });

      setCustomers(normalizedCustomers);
      setDeals(normalizedDeals);
      setTasks(normalizedTasks);
      setProducts(normalizedProducts);
      setBankRecords(normalizedBanks);
      
      // Build dynamic chart data from real data
      const dynamicChartData = {
        departmentByAmount: departments.map(dept => {
          const deptDeals = normalizedDeals.filter(deal => deal.department === dept);
          return {
            department: dept,
            amount: deptDeals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0),
            count: deptDeals.length
          };
        })
      };
      setChartData(dynamicChartData);

      // Build table data from real customers
      const dynamicTableData = normalizedCustomers.slice(0, 10).map((customer, index) => ({
        id: customer.id || index + 1,
        accountNo: customer.accountNo || `ACC${index + 1}`,
        customerName: customer.customerName || customer.fullName || 'Unknown',
        department: customer.department || 'Unassigned',
        stage: normalizedDeals.find(d => d.clientId === customer.id)?.stageCode || 'NEW_LEAD',
        amount: normalizedDeals.find(d => d.clientId === customer.id)?.valueAmount || 0,
        status: customer.status || 'Active'
      }));

      setTableData(dynamicTableData);
      setPagination({
        page: 1,
        limit: 10,
        total: normalizedCustomers.length,
        totalPages: Math.ceil(normalizedCustomers.length / 10)
      });
      
      // Activities are now loaded via shared activity system - no need to call fetchGlobalActivities
      
    } catch (error) {
      console.error('🔥 [DASHBOARD] Error fetching real data:', error);
      setCustomers([]);
      setDeals([]);
      setTasks([]);
      setProducts([]);
      setBankRecords([]);
    } finally {
      setLoading(false);
    }
  };

  // ✅ FETCH ALL DATA - Fixed condition
  const fetchAllData = async () => {
    setLoading(true);
    try {
      console.log('🔥 [DASHBOARD] Starting fetchAllData...');
      
      await Promise.all([
        fetchDashboardData(),
        fetchDepartments(),
        fetchStagesForDepartment(selectedDepartment === 'ALL' ? departments[0] : selectedDepartment)
      ]);
      console.log('🔥 [DASHBOARD] All data fetched successfully');
    } catch (error) {
      console.error('🔥 [DASHBOARD] Failed to fetch data:', error);
    } finally {
      console.log('🔥 [DASHBOARD] Setting loading to false');
      setLoading(false);
    }
  };

  // ✅ FETCH DEPARTMENTS AND STAGES
  const fetchDepartmentsAndStages = async () => {
    try {
      await fetchDepartments();
      
      // Fetch stages for all departments
      for (const dept of departments) {
        await fetchStagesForDepartment(dept);
      }
    } catch (error) {
      console.error('🔥 [DASHBOARD] Error fetching departments/stages:', error);
    }
  };

  // ✅ AUTO-REFRESH DASHBOARD DATA (not activities - activities use shared system)
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('🔄 [ADMIN DASHBOARD] Auto-refreshing dashboard data...');
      fetchDashboardData();
    }, 30000); // 30 seconds
    
    return () => clearInterval(interval);
  }, []); // Empty dependency - run once

  // ✅ REAL-TIME UPDATES - Enhanced for all data types
  useEffect(() => {
    let broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('crm-updates');
      broadcastChannel.onmessage = (e) => {
        console.log('🔄 [ADMIN DASHBOARD] Real-time update detected:', e.data?.type);
        
        // Refresh all data for any update
        if (e.data?.type) {
          console.log("🔄 [ADMIN DASHBOARD] Refreshing dashboard for:", e.data?.type);
          fetchDashboardData(); // This will refresh activities too
        }
      };
    }
    
    return () => {
      if (broadcastChannel) {
        broadcastChannel.close();
      }
    };
  }, []); // Empty dependency - run once

  // ✅ INITIAL DATA LOAD
  useEffect(() => {
    fetchAllData();
    
    // Safety timeout to prevent infinite loading
    const timeout = setTimeout(() => {
      console.log('🔥 [DASHBOARD] Safety timeout - forcing loading to false');
      setLoading(false);
    }, 10000); // 10 seconds timeout
    
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
  const dashboardCards = useMemo(() => {
    if (!dashboardStats) return [];

    return [
      {
        title: "Total Deals",
        value: dashboardStats.totalDeals.toLocaleString(),
        icon: <BarChart3 className="h-6 w-6" />,
        color: "blue"
      },
      {
        title: "Pipeline Value",
        value: `₹${(dashboardStats.totalValue / 100000).toFixed(1)}L`,
        icon: <DollarSign className="h-6 w-6" />,
        color: "green"
      },
      {
        title: "Active Customers",
        value: customers.length.toLocaleString(),
        icon: <Users className="h-6 w-6" />,
        color: "purple"
      },
      {
        title: "Departments",
        value: departments.length,
        icon: <Building2 className="h-6 w-6" />,
        color: "orange"
      }
    ];
  }, [dashboardStats, customers.length, departments.length]);

  // ✅ HANDLE PAGE CHANGE
  const handlePageChange = (newPage) => {
    setPagination(prev => ({
      ...prev,
      page: newPage
    }));
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
              Welcome back, {userName || 'Admin User'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchDashboardData}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* ✅ DYNAMIC DASHBOARD CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {dashboardCards.map((card, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{card.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{card.value}</p>
              </div>
              <div className={`p-3 rounded-lg bg-${card.color}-100`}>
                <span className="text-2xl text-${card.color}-600">{card.icon}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ✅ FILTERS SECTION */}
      <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-500" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
          </div>
          <button
            onClick={resetFilters}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Reset
          </button>
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

          {/* Department Filter */}
          {(userRole === 'ADMIN' || userRole === 'MANAGER') && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Department</label>
              <select
                value={filters.department}
                onChange={(e) => handleFilterChange('department', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Departments</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* ✅ ROW 1: FUNNEL CHART + DATA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Side - Funnel Chart */}
        <div className="bg-white rounded-xl shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Pipeline Funnel - Dynamic Counts
            </h3>
            
            {/* Department Dropdown for Funnel */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Department:</label>
              <div className="relative">
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="appearance-none px-3 py-1 pr-6 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-sm"
                >
                  <option value="ALL">All Departments</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-1 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-500 pointer-events-none" />
              </div>
            </div>
          </div>
          
          {/* Dynamic Funnel Chart with Real Counts */}
          <FunnelChart 
            data={funnelCounts} 
            department={selectedDepartment} 
            stages={(() => {
            let stages = selectedDepartment === 'ALL' 
              ? getStagesForDepartment(departments[0]) || []
              : getStagesForDepartment(selectedDepartment) || [];
            
            // Fallback stages for ACCOUNT department
            if (!stages || stages.length === 0) {
              if (selectedDepartment === 'ACCOUNT' || (selectedDepartment === 'ALL' && departments[0] === 'ACCOUNT')) {
                console.log('🔥 [DASHBOARD] Using fallback stages for ACCOUNT department');
                stages = [
                  { stageCode: 'INVENTORY', stageName: 'Inventory', stageOrder: 1 },
                  { stageCode: 'MAKE_BILL', stageName: 'Make Bill', stageOrder: 2 },
                  { stageCode: 'BILL_SUBMIT', stageName: 'Bill Submit', stageOrder: 3 },
                  { stageCode: 'BILL_FOLLOWUP', stageName: 'Bill Followup', stageOrder: 4 },
                  { stageCode: 'BILL_PASS', stageName: 'Bill Pass', stageOrder: 5 },
                  { stageCode: 'CLOSE_WIN', stageName: 'Close Win', stageOrder: 6 },
                  { stageCode: 'CLOSE_LOST', stageName: 'Close Lost', stageOrder: 7 }
                ];
              } else {
                // Generic fallback stages for other departments
                console.log('🔥 [DASHBOARD] Using generic fallback stages for department:', selectedDepartment);
                stages = [
                  { stageCode: 'LEAD', stageName: 'Lead', stageOrder: 1 },
                  { stageCode: 'CONTACTED', stageName: 'Contacted', stageOrder: 2 },
                  { stageCode: 'QUALIFIED', stageName: 'Qualified', stageOrder: 3 },
                  { stageCode: 'PROPOSAL', stageName: 'Proposal', stageOrder: 4 },
                  { stageCode: 'NEGOTIATION', stageName: 'Negotiation', stageOrder: 5 },
                  { stageCode: 'CLOSE_WIN', stageName: 'Close Win', stageOrder: 6 },
                  { stageCode: 'CLOSE_LOST', stageName: 'Close Lost', stageOrder: 7 }
                ];
              }
            }
            
            return stages;
          })()}
          />
        </div>

        {/* Right Side - Bank Pipeline Summary */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Bank Pipeline Summary
            </h3>
            <div className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
              {bankDepartmentStats.length} Banks
            </div>
          </div>
          
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {bankDepartmentStats.length > 0 ? (
              bankDepartmentStats.map((bank) => (
                <div
                  key={bank.bankId}
                  className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-semibold text-gray-900 text-base">
                      {bank.bankName}
                    </span>
                    <span className="text-sm text-gray-600 bg-white px-3 py-1 rounded-full border">
                      Total: {bank.totalDeals}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-xs">
                    {departments.map((dept) => (
                      <div
                        key={dept}
                        className={`flex justify-between items-center p-2 rounded border ${
                          bank.departments[dept] > 0 
                            ? 'bg-white border-indigo-200' 
                            : 'bg-gray-100 border-gray-200'
                        }`}
                      >
                        <span className="font-medium text-gray-700">{dept}</span>
                        <span className={`font-bold ${
                          bank.departments[dept] > 0 
                            ? 'text-indigo-600' 
                            : 'text-gray-400'
                        }`}>
                          {bank.departments[dept]}
                        </span>
                      </div>
                    ))}
                  </div>

                  {bank.totalDeals === 0 && (
                    <div className="text-center py-2 text-xs text-gray-500">
                      No deals in any department
                    </div>
                  )}
                </div>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="text-gray-500">
                  <div className="text-lg font-medium mb-2">No bank data available</div>
                  <div className="text-sm">Please ensure banks and deals are loaded</div>
                </div>
              </div>
            )}
          </div>
          
          {bankDepartmentStats.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="text-xs text-gray-500 text-center">
                Showing {bankDepartmentStats.length} banks • {departments.length} departments each
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ✅ ROW 2: GRAPHS + DATA */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* Left Side - Department by Amount Chart */}
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

        {/* Right Side - Department Stats Data */}
        <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Department Statistics</h3>
          <div className="space-y-4">
            {(() => {
              // 🔥 FIXED: Calculate department stats from deals data
              const deptStats = {};
              deals.forEach(deal => {
                if (deal.department) {
                  if (!deptStats[deal.department]) {
                    deptStats[deal.department] = { count: 0, amount: 0 };
                  }
                  deptStats[deal.department].count++;
                  deptStats[deal.department].amount += Number(deal.valueAmount) || 0;
                }
              });

              // Ensure all departments are shown even with 0 values
              departments.forEach(dept => {
                if (!deptStats[dept]) {
                  deptStats[dept] = { count: 0, amount: 0 };
                }
              });

              return Object.entries(deptStats).map(([dept, stats]) => (
                <div key={dept} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{dept}</p>
                    <p className="text-xs text-gray-500">{stats.count} deals</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-gray-900">₹{stats.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Total Value</p>
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}

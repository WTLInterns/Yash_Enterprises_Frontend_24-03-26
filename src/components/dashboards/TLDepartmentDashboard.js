"use client";

import { useState, useEffect, useMemo } from "react";
import { 
  UsersIcon, 
  BuildingOffice2Icon, 
  CheckCircleIcon, 
  BanknotesIcon,
  ClockIcon,
  ArrowTrendingUpIcon,
  CalendarIcon,
  TagIcon,
  ShoppingCartIcon,
  ClipboardDocumentListIcon
} from "@heroicons/react/24/outline";
import { departmentStatsService } from "@/services/departmentStats.service";
import { getAuthUser } from "@/utils/authUser";
import DepartmentStatsCard from "@/components/dashboard/DepartmentStatsCard";
import DepartmentPieChart from "@/components/charts/DepartmentPieChart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useStages } from '@/context/StageContext';
import { backendApi } from "@/services/api";
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";
import { broadcastActivity, createActivity } from "@/utils/activityBus";
import { departmentApiService } from "@/services/departmentApi.service";

// ✅ Funnel Chart Component for TL - Fixed Shape with Dynamic Counts
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

export default function TLDepartmentDashboard({ userName, userRole }) {
  // ✅ Enhanced state for all data sources
  const [customers, setCustomers] = useState([]);
  const [deals, setDeals] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [products, setProducts] = useState([]);
  const [bankRecords, setBankRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [departmentStats, setDepartmentStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null); // ✅ ADDED: Missing error state
  const [selectedDepartment, setSelectedDepartment] = useState('');
  
  const currentUser = getAuthUser();
  const authUserRole = getCurrentUserRole(); // ✅ FIXED: Use different name to avoid conflict
  const authUserName = currentUser?.fullName || currentUser?.name || 'Team Lead'; // ✅ FIXED: Use different name
  
  const { getStagesForDepartment, fetchStagesForDepartment } = useStages();
  
  const funnelCounts = useMemo(() => {
    if (!currentUser?.department || !deals.length) return [];

    const dept = currentUser.department;
    // API already returns only this dept's deals, but filter just in case
    const deptDeals = deals.filter(d => !d.department || d.department === dept);

    const stages = getStagesForDepartment(dept) || [];

    if (!stages.length) {
      // No stage config — derive from actual deal data
      const stageMap = {};
      deptDeals.forEach(d => {
        const code = d.stageCode || d.stage || '';
        if (code) stageMap[code] = (stageMap[code] || 0) + 1;
      });
      return Object.entries(stageMap).map(([stage, count]) => ({ stage, count }));
    }

    // Match stageCode as-is (same as customers page — no uppercase transform)
    const stageMap = {};
    stages.forEach(s => { stageMap[s.stageCode] = 0; });
    deptDeals.forEach(deal => {
      const code = deal.stageCode || deal.stage || '';
      if (stageMap.hasOwnProperty(code)) stageMap[code]++;
      else if (stageMap.hasOwnProperty(code.toUpperCase())) stageMap[code.toUpperCase()]++;
    });
    return stages.map(s => ({ stage: s.stageCode, count: stageMap[s.stageCode] || 0 }));
  }, [currentUser?.department, deals, getStagesForDepartment]);

  // ✅ Fetch real customers data
  const fetchCustomers = async () => {
    try {
      console.log('🔥 [TL DASHBOARD] Fetching customers for department:', currentUser?.department);
      const customersData = await departmentApiService.getCustomers();
      console.log('🔥 [TL DASHBOARD] Customers fetched:', customersData.length);
      setCustomers(customersData || []);
    } catch (error) {
      console.error('🔥 [TL DASHBOARD] Failed to fetch customers:', error);
      setCustomers([]);
    }
  };

  // ✅ Fetch deals exactly like customers page
  const fetchDeals = async () => {
    try {
      let authUser = null;
      try {
        const tabId = typeof window !== 'undefined' ? sessionStorage.getItem('tab_id') : null;
        let raw = tabId ? sessionStorage.getItem(`user_data_${tabId}`) : null;
        if (!raw) raw = localStorage.getItem('user_data');
        authUser = raw ? JSON.parse(raw) : null;
      } catch {}

      const res = await backendApi.get("/deals/filtered", {
        headers: {
          "X-User-Role":       authUser?.role ?? "",
          "X-User-Department": authUser?.department ?? "",
        }
      });
      const list = Array.isArray(res) ? res : (res?.content || []);
      const normalizedDeals = list.map(d => ({
        ...d,
        clientId: d.clientId ?? d.client_id ?? (typeof d.client === 'object' ? d.client?.id : d.client) ?? null,
        stageCode: d.stage || d.stageCode || "",
        department: d.department || "",
        valueAmount: d.calculatedValue ?? d.valueAmount ?? d.value_amount ?? 0,
      }));
      setDeals(normalizedDeals);
    } catch (error) {
      console.error('[TL DASHBOARD] Failed to fetch deals:', error);
      setDeals([]);
    }
  };

  const fetchTasks = async () => {
    try {
      const tasksData = await departmentApiService.getTasks();
      const tasksArray = Array.isArray(tasksData) ? tasksData : (tasksData?.content || []);
      setTasks(tasksArray);
    } catch (error) {
      console.error('🔥 [TL DASHBOARD] Failed to fetch tasks:', error);
      setTasks([]);
    }
  };

  // 🔥 NEW: Fetch products data - SAME APPROACH AS PRODUCTS PAGE
  const fetchProducts = async () => {
    try {
      console.log('🔥 [TL DASHBOARD] Fetching products...');
      // ✅ Use same approach as products page - direct backend API
      const res = await backendApi.get("/products");
      const productsData = Array.isArray(res) ? res : (res?.content || []);
      console.log('🔥 [TL DASHBOARD] Products fetched:', productsData.length);
      setProducts(productsData || []);
    } catch (error) {
      console.error('🔥 [TL DASHBOARD] Failed to fetch products:', error);
      setProducts([]);
    }
  };

  // 🔥 NEW: Fetch bank records data - SAME APPROACH AS BANK PAGE
  const fetchBankRecords = async () => {
    try {
      console.log('🔥 [TL DASHBOARD] Fetching bank records...');
      // ✅ Use same approach as bank page - direct backend API
      const res = await backendApi.get("/banks");
      const bankData = Array.isArray(res) ? res : (res?.content || []);
      console.log('🔥 [TL DASHBOARD] Bank records fetched:', bankData.length);
      setBankRecords(bankData || []);
    } catch (error) {
      console.error('🔥 [TL DASHBOARD] Failed to fetch bank records:', error);
      setBankRecords([]);
    }
  };

  // 🔥 NEW: Fetch employees data
  const fetchEmployees = async () => {
    try {
      console.log('🔥 [TL DASHBOARD] Fetching employees...');
      const employeesData = await backendApi.get('/employees');
      const employeesArray = Array.isArray(employeesData) ? employeesData : (employeesData?.content || []);
      console.log('🔥 [TL DASHBOARD] Employees fetched:', employeesArray.length);
      setEmployees(employeesArray || []);
    } catch (error) {
      console.error('🔥 [TL DASHBOARD] Failed to fetch employees:', error);
      setEmployees([]);
    }
  };

  // Activities section completely removed
  const comprehensiveStats = useMemo(() => {
    const dept = currentUser?.department || 'ALL';
    
    // 🔥 DEBUG: Log key info for debugging
    console.log('🔍 [DEBUG] Current user:', currentUser, 'Department:', dept);
    
    // 🔥 DEBUG: Check amount fields in customers and deals
    if (customers.length > 0) {
      console.log('🔍 [DEBUG] Customer amount fields:', Object.keys(customers[0]));
      console.log('🔍 [DEBUG] Sample customer ALL fields:', customers[0]);
    }
    if (deals.length > 0) {
      console.log('🔍 [DEBUG] Deal amount fields:', Object.keys(deals[0]));
      console.log('🔍 [DEBUG] Sample deal ALL fields:', deals[0]);
    }
    
    // 🔥 FIX: Handle department filtering correctly
    // For ADMIN users with null department, show all data
    // For TL users, filter by their department
    // 🔥 CRITICAL FIX: Customers and Bank records use "ownerName" field, not "department"
    // 🔥 ENHANCED: Include customers who have tasks in current department
    const deptCustomers = (currentUser?.role === 'ADMIN' || !dept || dept === 'ALL') 
      ? customers 
      : customers.filter(c => {
          // Direct department match
          const directMatch = c.ownerName === dept || c.department === dept || c.departmentName === dept || c.tlDepartmentName === dept;
          
          // Indirect match: customer has tasks in this department
          const customerTasks = tasks.filter(t => t.clientId === c.id || t.customerId === c.id || t.customerName === c.name);
          const hasTaskInDept = customerTasks.some(t => t.department === dept);
          
          // Indirect match: customer has deals in this department  
          const customerDeals = deals.filter(d => d.clientId === c.id || d.customerId === c.id || d.customerName === c.name);
          const hasDealInDept = customerDeals.some(d => d.department === dept);
          
          return directMatch || hasTaskInDept || hasDealInDept;
        });
      
    const deptDeals = (currentUser?.role === 'ADMIN' || !dept || dept === 'ALL') 
      ? deals 
      : deals.filter(d => d.department === dept || d.departmentName === dept || d.tlDepartmentName === dept || d.ownerName === dept);
      
    const deptTasks = (currentUser?.role === 'ADMIN' || !dept || dept === 'ALL') 
      ? tasks 
      : tasks.filter(t => t.department === dept || t.departmentName === dept || t.tlDepartmentName === dept);
      
    const deptEmployees = (currentUser?.role === 'ADMIN' || !dept || dept === 'ALL') 
      ? employees 
      : employees.filter(e => e.departmentName === dept || e.department === dept);
    
    // 🔥 ENHANCED: Bank filtering with association logic
    const deptBankRecords = (currentUser?.role === 'ADMIN' || !dept || dept === 'ALL') 
      ? bankRecords 
      : bankRecords.filter(b => {
          // Direct department match via ownerName
          const directMatch = b.ownerName === dept || b.department === dept || b.departmentName === dept || b.tlDepartmentName === dept;
          
          // Indirect match: bank associated with customers in this department
          const associatedCustomers = customers.filter(c => c.bankName === b.name || c.bankId === b.id);
          const hasCustomerInDept = associatedCustomers.some(c => deptCustomers.includes(c));
          
          // Indirect match: bank associated with tasks in this department
          const associatedTasks = tasks.filter(t => t.bankName === b.name || t.bankId === b.id);
          const hasTaskInDept = associatedTasks.some(t => deptTasks.includes(t));
          
          return directMatch || hasCustomerInDept || hasTaskInDept;
        });
    
    // 🔥 DEBUG: Log filtered results
    console.log('🔍 [DEBUG] Filtered results:', {
      customers: `${deptCustomers.length} of ${customers.length}`,
      bankRecords: `${deptBankRecords.length} of ${bankRecords.length}`,
      tasks: `${deptTasks.length} of ${tasks.length}`
    });
    
    // Calculate totals
    const totalCustomers = customers.length;
    const totalProducts = products.length;
    const totalTasks = tasks.length;
    const totalBankRecords = bankRecords.length;
    const totalEmployees = employees.length;
    
    // Calculate department-specific
    const deptCustomerCount = deptCustomers.length;
    const deptProductCount = totalProducts; // Products are usually global
    const deptTaskCount = deptTasks.length;
    const deptBankRecordCount = totalBankRecords; // Show total banks count for both metrics
    
    // Task status breakdown
    const completedTasks = deptTasks.filter(t => t.status === 'COMPLETED' || t.status === 'DONE').length;
    const pendingTasks = deptTasks.filter(t => t.status === 'PENDING' || t.status === 'TODO' || t.status === 'INQUIRY').length;
    const inProgressTasks = deptTasks.filter(t => t.status === 'IN_PROGRESS' || t.status === 'IN_PROGRESS').length;
    
    // Bank summary - calculate total amounts from customers/deals
    const dealsAmount = deals.reduce((sum, deal) => {
      const amount = Number(deal.valueAmount) || Number(deal.value_amount) || Number(deal.amount) || Number(deal.value) || 0;
      console.log(`🔍 [DEBUG] Deal "${deal.name}" amount: ${amount} (from valueAmount: ${deal.valueAmount})`);
      return sum + amount;
    }, 0);
    
    const customersAmount = customers.reduce((sum, customer) => {
      // Check all possible amount fields in customer
      const directFields = {
        totalAmount: Number(customer.totalAmount) || 0,
        amount: Number(customer.amount) || 0,
        value: Number(customer.value) || 0,
        dealValue: Number(customer.dealValue) || 0,
        valueAmount: Number(customer.valueAmount) || 0
      };
      
      // Check custom fields for amount
      let customAmount = 0;
      if (customer.customFields && typeof customer.customFields === 'object') {
        Object.values(customer.customFields).forEach(fieldValue => {
          const numValue = Number(fieldValue);
          if (!isNaN(numValue) && numValue > 0) {
            customAmount = Math.max(customAmount, numValue);
          }
        });
      }
      
      // Check all numeric fields in customer object
      let maxAmount = 0;
      let maxField = '';
      Object.keys(customer).forEach(key => {
        // Exclude ID fields, phone numbers, and other non-amount fields
        if (key !== 'id' && key !== 'name' && key !== 'email' && key !== 'phone' && 
            key !== 'contactPhone' && key !== 'contactNumber' && key !== 'pincode' && 
            !key.toLowerCase().includes('id') && !key.toLowerCase().includes('phone')) {
          const value = Number(customer[key]);
          // Only consider reasonable amount values (greater than 100 to avoid small IDs)
          if (!isNaN(value) && value > maxAmount && value > 100 && value < 999999) {
            maxAmount = value;
            maxField = key;
          }
        }
      });
      
      const finalAmount = Math.max(
        ...Object.values(directFields),
        customAmount,
        maxAmount
      );
      
      console.log(`🔍 [DEBUG] Customer "${customer.name}" amount breakdown:`, {
        directFields,
        customAmount,
        maxAmount,
        maxField,
        finalAmount
      });
      
      return sum + finalAmount;
    }, 0);
    
    const totalBankAmount = dealsAmount + customersAmount;
    
    console.log('🔍 [DEBUG] Final amount calculation:', {
      dealsAmount,
      customersAmount,
      totalBankAmount,
      dealsCount: deals.length,
      customersCount: customers.length
    });
    
    // Deal values - use filtered deals for correct department calculation
    const totalDealValue = deptDeals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0);
    
    console.log('🔥 [TL DASHBOARD] Comprehensive stats calculated:', {
      dept,
      totalCustomers,
      deptCustomerCount,
      totalProducts,
      totalTasks,
      deptTaskCount,
      completedTasks,
      pendingTasks,
      totalBankAmount,
      totalBankRecords,
      deptBankRecordCount // Now shows total banks
    });
    
    return {
      totalCustomers,
      deptCustomerCount,
      totalProducts,
      deptProductCount,
      totalTasks,
      deptTaskCount,
      completedTasks,
      pendingTasks,
      inProgressTasks,
      totalBankRecords,
      deptBankRecordCount,
      totalBankAmount,
      totalDealValue,
      totalEmployees,
      deptEmployeeCount: deptEmployees.length
    };
  }, [customers, deals, tasks, products, bankRecords, employees, currentUser?.department]);

  // 🔥 NEW: Calculate distribution data for charts
  const distributionData = useMemo(() => {
    const dept = currentUser?.department || 'ALL';
    
    // Customer distribution
    const customerDistribution = [
      { name: `${dept} Department`, value: comprehensiveStats.deptCustomerCount, percentage: comprehensiveStats.totalCustomers > 0 ? (comprehensiveStats.deptCustomerCount / comprehensiveStats.totalCustomers * 100).toFixed(1) : 0 },
      { name: 'Other Departments', value: comprehensiveStats.totalCustomers - comprehensiveStats.deptCustomerCount, percentage: comprehensiveStats.totalCustomers > 0 ? ((comprehensiveStats.totalCustomers - comprehensiveStats.deptCustomerCount) / comprehensiveStats.totalCustomers * 100).toFixed(1) : 0 }
    ];
    
    // Task distribution
    const taskDistribution = [
      { name: `${dept} Department`, value: comprehensiveStats.deptTaskCount, percentage: comprehensiveStats.totalTasks > 0 ? (comprehensiveStats.deptTaskCount / comprehensiveStats.totalTasks * 100).toFixed(1) : 0 },
      { name: 'Other Departments', value: comprehensiveStats.totalTasks - comprehensiveStats.deptTaskCount, percentage: comprehensiveStats.totalTasks > 0 ? ((comprehensiveStats.totalTasks - comprehensiveStats.deptTaskCount) / comprehensiveStats.totalTasks * 100).toFixed(1) : 0 }
    ];
    
    return {
      customerDistribution,
      taskDistribution
    };
  }, [comprehensiveStats]);

  // ✅ Fetch department-specific stats for TL
  const fetchDepartmentStats = async () => {
    // 🔥 FIX: Allow ADMIN users to get stats even without department
    if (!currentUser) {
      setDepartmentStats({
        error: true,
        message: 'No user information available'
      });
      return;
    }
    
    try {
      console.log('🔥 [TL DASHBOARD] Fetching department stats for:', currentUser.department || 'ALL (ADMIN)');
      
      // 🔥 FIX: Handle ADMIN users with null department
      const dept = currentUser?.department || 'ALL';
      const isAdmin = currentUser?.role === 'ADMIN';
      
      // 🔥 DEBUG: Log data structure for debugging
      console.log('🔍 [DEPT STATS DEBUG] User:', currentUser, 'Dept:', dept, 'IsAdmin:', isAdmin);
      console.log('🔍 [DEPT STATS DEBUG] Customers sample:', customers.slice(0, 1));
      console.log('🔍 [DEPT STATS DEBUG] Bank records sample:', bankRecords.slice(0, 1));
      
      // ✅ Use comprehensive real data with enhanced filtering
      const realStats = {
        customers: {
          department: isAdmin ? customers.length : customers.filter(c => c.ownerName === dept || c.department === dept || c.departmentName === dept || c.tlDepartmentName === dept).length,
          total: customers.length,
          percentage: isAdmin ? 100 : (customers.length > 0 ? (customers.filter(c => c.ownerName === dept || c.department === dept || c.departmentName === dept || c.tlDepartmentName === dept).length / customers.length * 100) : 0)
        },
        products: {
          department: products.length, // Products are usually global
          total: products.length,
          percentage: 100
        },
        tasks: {
          department: isAdmin ? tasks.length : tasks.filter(t => t.department === dept || t.departmentName === dept || t.tlDepartmentName === dept).length,
          total: tasks.length,
          percentage: isAdmin ? 100 : (tasks.length > 0 ? (tasks.filter(t => t.department === dept || t.departmentName === dept || t.tlDepartmentName === dept).length / tasks.length * 100) : 0),
          completed: isAdmin ? tasks.filter(t => t.status === 'COMPLETED' || t.status === 'DONE').length : tasks.filter(t => (t.department === dept || t.departmentName === dept || t.tlDepartmentName === dept) && (t.status === 'COMPLETED' || t.status === 'DONE')).length,
          pending: isAdmin ? tasks.filter(t => t.status === 'PENDING' || t.status === 'TODO' || t.status === 'INQUIRY').length : tasks.filter(t => (t.department === dept || t.departmentName === dept || t.tlDepartmentName === dept) && (t.status === 'PENDING' || t.status === 'TODO' || t.status === 'INQUIRY')).length
        },
        bank: {
          department: isAdmin ? bankRecords.length : bankRecords.filter(b => {
            // Direct department match via ownerName
            const directMatch = b.ownerName === dept || b.department === dept || b.departmentName === dept || b.tlDepartmentName === dept;
            
            // Indirect match: bank associated with customers in this department
            const associatedCustomers = customers.filter(c => c.bankName === b.name || c.bankId === b.id);
            const hasCustomerInDept = associatedCustomers.some(c => c.ownerName === dept || c.department === dept || c.departmentName === dept || c.tlDepartmentName === dept);
            
            // Indirect match: bank associated with tasks in this department
            const associatedTasks = tasks.filter(t => t.bankName === b.name || t.bankId === b.id);
            const hasTaskInDept = associatedTasks.some(t => t.department === dept);
            
            return directMatch || hasCustomerInDept || hasTaskInDept;
          }).length,
          total: bankRecords.length, // Show total banks count
          percentage: bankRecords.length > 0 ? Math.round((bankRecords.length / bankRecords.length) * 100) : 100, // Always 100% since total = total
          totalAmount: deals.reduce((sum, deal) => sum + (Number(deal.valueAmount) || 0), 0) +
                      customers.reduce((sum, customer) => sum + (Number(customer.totalAmount) || Number(customer.amount) || 0), 0)
        },
        recentActivity: [], // Will be populated with real activities
        funnelData: funnelCounts // Use real funnel counts
      };
      
      setDepartmentStats(realStats);
      console.log('🔥 [TL DASHBOARD] Department stats set:', realStats);
      
    } catch (error) {
      console.error('🔥 [TL DASHBOARD] Failed to fetch department stats:', error);
      setDepartmentStats({
        error: true,
        message: 'Failed to load department statistics'
      });
    }
  };

  // ✅ MAIN DATA FETCHING FUNCTION
  const fetchAllData = async () => {
    try {
      console.log('🔥 [TL DASHBOARD] Starting fetchAllData...');
      setLoading(true);
      
      // Fetch all data sources in parallel
      await Promise.all([
        fetchCustomers(),
        fetchDeals(),
        fetchTasks(),
        fetchProducts(),
        fetchBankRecords(),
        fetchEmployees()
      ]);
      
      console.log('🔥 [TL DASHBOARD] All data sources fetched successfully');
    } catch (error) {
      console.error('🔥 [TL DASHBOARD] Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
    const timeout = setTimeout(() => setLoading(false), 10000);
    return () => clearTimeout(timeout);
  }, []);

  // ✅ Real-time updates when deals change
  useEffect(() => {
    if (deals.length > 0) {
      fetchDepartmentStats();
    }
  }, [deals, funnelCounts]);

  // Show dashboard with partial data instead of infinite loading
  if (loading && !departmentStats && customers.length === 0 && deals.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  // 🔥 FIX: Allow ADMIN users to see dashboard even without department
  if (error || (!currentUser?.department && currentUser?.role !== 'ADMIN')) {
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
                  {authUserName || 'Team Lead'}
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
        // 🎯 PROFESSIONAL DYNAMIC TL DEPARTMENT DASHBOARD
        <>
          {/* ✅ DYNAMIC STATS CARDS ROW */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Total Customers Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Customers</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{comprehensiveStats.deptCustomerCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    of {comprehensiveStats.totalCustomers} total ({comprehensiveStats.totalCustomers > 0 ? (comprehensiveStats.deptCustomerCount / comprehensiveStats.totalCustomers * 100).toFixed(1) : 0}%)
                  </p>
                </div>
                <div className="p-3 bg-blue-100 rounded-lg">
                  <UsersIcon className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </div>

            {/* Total Products Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Products</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{comprehensiveStats.totalProducts}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    of {comprehensiveStats.totalProducts} total (100%)
                  </p>
                </div>
                <div className="p-3 bg-green-100 rounded-lg">
                  <ShoppingCartIcon className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </div>

            {/* Total Tasks Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Tasks</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{comprehensiveStats.deptTaskCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    of {comprehensiveStats.totalTasks} total ({comprehensiveStats.totalTasks > 0 ? (comprehensiveStats.deptTaskCount / comprehensiveStats.totalTasks * 100).toFixed(1) : 0}%)
                  </p>
                </div>
                <div className="p-3 bg-purple-100 rounded-lg">
                  <ClipboardDocumentListIcon className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </div>

            {/* Bank Records Card */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Bank Records</p>
                  <p className="text-2xl font-bold text-gray-900 mt-2">{comprehensiveStats.deptBankRecordCount}</p>
                  <p className="text-xs text-gray-500 mt-1">
                    of {comprehensiveStats.totalBankRecords} total ({comprehensiveStats.totalBankRecords > 0 ? (comprehensiveStats.deptBankRecordCount / comprehensiveStats.totalBankRecords * 100).toFixed(1) : 0}%)
                  </p>
                </div>
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <BanknotesIcon className="h-6 w-6 text-yellow-600" />
                </div>
              </div>
            </div>
          </div>

          {/* ✅ CHARTS ROW - CUSTOMERS & TASKS DISTRIBUTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Customers Distribution Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Customers Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData.customerDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#3B82F6" />
                    <Cell fill="#E5E7EB" />
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  {currentUser?.department} Department ({comprehensiveStats.deptCustomerCount}) vs Other Departments ({comprehensiveStats.totalCustomers - comprehensiveStats.deptCustomerCount})
                </p>
              </div>
            </div>

            {/* Tasks Distribution Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Tasks Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={distributionData.taskDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percentage }) => `${name} (${percentage}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    <Cell fill="#10B981" />
                    <Cell fill="#E5E7EB" />
                  </Pie>
                  <RechartsTooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600">
                  {currentUser?.department} Department ({comprehensiveStats.deptTaskCount}) vs Other Departments ({comprehensiveStats.totalTasks - comprehensiveStats.deptTaskCount})
                </p>
              </div>
            </div>
          </div>

          {/* ✅ FUNNEL CHART & TASK BREAKDOWN ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {/* Funnel Chart */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Funnel Chart - {currentUser?.department} Department
              </h3>
              <FunnelChart 
                data={funnelCounts} 
                department={currentUser?.department} 
                stages={(() => {
                  const s = getStagesForDepartment(currentUser?.department) || [];
                  if (s.length > 0) return s;
                  return funnelCounts.map((fc, i) => ({ stageCode: fc.stage, stageName: fc.stage, stageOrder: i + 1 }));
                })()}
              />
            </div>

            {/* Task Breakdown */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Task Breakdown - {currentUser?.department}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center gap-3">
                    <CheckCircleIcon className="h-5 w-5 text-green-600" />
                    <span className="text-sm font-medium text-gray-900">Completed Tasks</span>
                  </div>
                  <span className="text-lg font-bold text-green-600">{comprehensiveStats.completedTasks}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="flex items-center gap-3">
                    <ClockIcon className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-medium text-gray-900">In Progress Tasks</span>
                  </div>
                  <span className="text-lg font-bold text-blue-600">{comprehensiveStats.inProgressTasks}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <div className="flex items-center gap-3">
                    <CalendarIcon className="h-5 w-5 text-yellow-600" />
                    <span className="text-sm font-medium text-gray-900">Pending Tasks</span>
                  </div>
                  <span className="text-lg font-bold text-yellow-600">{comprehensiveStats.pendingTasks}</span>
                </div>
              </div>
            </div>
          </div>

          {/* ✅ BANK SUMMARY & RECENT ACTIVITY ROW */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bank Summary */}
            <div className="bg-white rounded-xl shadow-sm p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Bank Summary - {currentUser?.department}</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="flex items-center gap-3">
                    <BanknotesIcon className="h-5 w-5 text-indigo-600" />
                    <span className="text-sm font-medium text-gray-900">Total Transaction Amount</span>
                  </div>
                  <span className="text-lg font-bold text-indigo-600">₹{comprehensiveStats.totalBankAmount.toLocaleString()}</span>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex items-center gap-3">
                    <BuildingOffice2Icon className="h-5 w-5 text-gray-600" />
                    <span className="text-sm font-medium text-gray-900">Total Bank Records</span>
                  </div>
                  <span className="text-lg font-bold text-gray-600">{comprehensiveStats.deptBankRecordCount}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      ) : (
        // Loading state
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      )}
    </div>
  );

  }

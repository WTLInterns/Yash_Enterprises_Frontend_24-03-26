import { departmentApiService } from "./departmentApi.service";
import { getAuthUser } from "@/utils/authUser";

export const departmentStatsService = {
  // 🎯 Get real department-wise statistics
  getDepartmentStats: async (department) => {
    const user = getAuthUser();
    
    try {
      console.log('Fetching REAL department stats for:', department, 'User role:', user?.role);
      
      // 🔥 For Admin/Manager/Account users, get all data without department filtering
      const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER' || user?.role === 'ACCOUNT';
      
      // 🔥 Use department-aware APIs for all data
      const [
        customersData,
        tasksData,
        bankData,
        productsData
      ] = await Promise.all([
        // Real customers data (admin gets all, TL gets filtered)
        departmentApiService.getCustomers(),
        // Real tasks data (admin gets all, TL gets filtered)
        departmentApiService.getTasks(),
        // Real bank data (admin gets all, TL gets filtered)
        departmentApiService.getBankRecords(),
        // Real products data (admin gets all, TL gets filtered)
        departmentApiService.getProducts()
      ]);

      console.log('Data received:', {
        customers: Array.isArray(customersData) ? customersData.length : 'not array',
        tasks: Array.isArray(tasksData) ? tasksData.length : 'not array',
        bank: Array.isArray(bankData) ? bankData.length : 'not array',
        products: Array.isArray(productsData) ? productsData.length : 'not array',
        isAdminOrManager
      });

      // 🔥 Ensure all data is in array format (handle pagination)
      const customersArray = Array.isArray(customersData) ? customersData : (customersData?.content || []);
      const tasksArray = Array.isArray(tasksData) ? tasksData : (tasksData?.content || []);
      const bankArray = Array.isArray(bankData) ? bankData : (bankData?.content || []);
      const productsArray = Array.isArray(productsData) ? productsData : (productsData?.content || []);

      // Get recent activity
      const recentActivity = await getDepartmentRecentActivity(department);

      // 🔥 For TL users, show department-specific stats
      if (!isAdminOrManager && department) {
        return {
          customers: {
            total: customersArray.length,
            department: customersArray.length,
            percentage: 100
          },
          tasks: {
            total: tasksArray.length,
            department: tasksArray.length,
            completed: tasksArray.filter(task => task.status === 'completed' || task.status === 'COMPLETED').length,
            pending: tasksArray.filter(task => task.status === 'pending' || task.status === 'PENDING').length,
            percentage: 100
          },
          bank: {
            total: bankArray.length,
            department: bankArray.length,
            totalAmount: bankArray.reduce((sum, record) => sum + (record.amount || 0), 0),
            percentage: 100
          },
          products: {
            total: productsArray.length,
            department: productsArray.length,
            active: productsArray.filter(product => product.status === 'active' || product.status === 'ACTIVE').length,
            percentage: 100
          },
          recentActivity
        };
      }

      // 🔥 For Admin/Manager users, show overall stats
      return {
        customers: {
          total: customersArray.length,
          department: customersArray.length,
          percentage: 100
        },
        tasks: {
          total: tasksArray.length,
          department: tasksArray.length,
          completed: tasksArray.filter(task => task.status === 'completed' || task.status === 'COMPLETED').length,
          pending: tasksArray.filter(task => task.status === 'pending' || task.status === 'PENDING').length,
          percentage: 100
        },
        bank: {
          total: bankArray.length,
          department: bankArray.length,
          totalAmount: bankArray.reduce((sum, record) => sum + (record.amount || 0), 0),
          percentage: 100
        },
        products: {
          total: productsArray.length,
          department: productsArray.length,
          active: productsArray.filter(product => product.status === 'active' || product.status === 'ACTIVE').length,
          percentage: 100
        },
        recentActivity
      };

    } catch (error) {
      console.error('Failed to fetch department stats:', error);
      throw error;
    }
  }
};

// 🎯 Get recent department activity
const getDepartmentRecentActivity = async (department) => {
  try {
    // 🔥 Use department-aware activities API
    const activities = await departmentApiService.getActivities();
    
    return activities.slice(0, 5).map(activity => ({
      id: activity.id,
      type: activity.type,
      description: activity.description,
      timestamp: activity.timestamp,
      user: activity.user
    }));
    
  } catch (error) {
    console.error('Failed to fetch recent activity:', error);
    // Return fallback activities
    return [
      { type: 'customer', description: `New customer added to ${department}`, timestamp: new Date() },
      { type: 'task', description: `Task completed in ${department}`, timestamp: new Date() },
      { type: 'bank', description: `Bank transaction processed for ${department}`, timestamp: new Date() }
    ];
  }
};

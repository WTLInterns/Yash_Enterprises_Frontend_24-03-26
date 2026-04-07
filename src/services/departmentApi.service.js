import { backendApi } from "@/services/api";
import { getTabSafeItem } from "@/utils/tabSafeStorage";

// Checks sessionStorage (tab-safe) first, then localStorage
const getAuthUser = () => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = getTabSafeItem("user_data")
      || sessionStorage.getItem("user_data")
      || localStorage.getItem("user_data");
    if (!raw) return null;
    const user = JSON.parse(raw);
    user.role = user.role || user.roleName || null;
    user.department = user.department || user.departmentName || user.tlDepartmentName || null;
    if (!user.department) {
      user.department = getTabSafeItem("user_department") || localStorage.getItem("user_department") || null;
    }
    return user;
  } catch {
    return null;
  }
};

const isPrivileged = (user) =>
  !user || user.role === 'ADMIN' || user.role === 'MANAGER';

export const departmentApiService = {
  getCurrentDepartment: () => getAuthUser()?.department || null,

  getTasks: async (params = {}) => {
    const user = getAuthUser();
    if (isPrivileged(user)) {
      const qs = new URLSearchParams({ ...params }).toString();
      return (await backendApi.get(`/tasks${qs ? '?' + qs : ''}`)) || [];
    }
    if (!user.department) throw new Error('Department information required for tasks access');
    return (await backendApi.get(`/tasks?${new URLSearchParams({ department: user.department, ...params })}`)) || [];
  },

  getCustomers: async (params = {}) => {
    const user = getAuthUser();
    if (isPrivileged(user) || user?.role === 'HR') {
      const qs = new URLSearchParams({ ...params }).toString();
      return (await backendApi.get(`/clients${qs ? '?' + qs : ''}`)) || [];
    }
    const dept = user?.department;
    if (!dept) throw new Error('Department information required for customers access');
    return (await backendApi.get(`/clients?${new URLSearchParams({ department: dept, ...params })}`)) || [];
  },

  getProducts: async (params = {}) => {
    const user = getAuthUser();
    if (isPrivileged(user) || user?.role === 'ACCOUNT') {
      const qs = new URLSearchParams({ ...params }).toString();
      return (await backendApi.get(`/products${qs ? '?' + qs : ''}`)) || [];
    }
    if (!user?.department) throw new Error('Department information required for products access');
    return (await backendApi.get(`/products?${new URLSearchParams({ department: user.department, ...params })}`)) || [];
  },

  getBankRecords: async () => [],

  getEmployees: async (params = {}) => {
    const user = getAuthUser();
    if (isPrivileged(user) || user?.role === 'ACCOUNT') {
      const qs = new URLSearchParams({ ...params }).toString();
      return (await backendApi.get(`/employees${qs ? '?' + qs : ''}`)) || [];
    }
    if (!user?.department) throw new Error('Department information required for employees access');
    return (await backendApi.get(`/employees?${new URLSearchParams({ department: user.department, ...params })}`)) || [];
  },

  getActivities: async () => [],

  createTask: async (taskData) => {
    const user = getAuthUser();
    if (isPrivileged(user) || user?.role === 'ACCOUNT') {
      return backendApi.post('/tasks', taskData);
    }
    if (!user?.department) throw new Error('Department information required for task creation');
    return backendApi.post('/tasks', { ...taskData, department: user.department });
  },

  updateTask: async (id, taskData) => {
    const user = getAuthUser();
    if (isPrivileged(user) || user?.role === 'ACCOUNT') {
      return backendApi.put(`/tasks/${id}`, taskData);
    }
    if (!user?.department) throw new Error('Department information required for task update');
    return backendApi.put(`/tasks/${id}`, { ...taskData, department: user.department });
  },

  deleteTask: async (id) => {
    const user = getAuthUser();
    if (isPrivileged(user) || user?.role === 'ACCOUNT') {
      return backendApi.delete(`/tasks/${id}`);
    }
    if (!user?.department) throw new Error('Department information required for task deletion');
    return backendApi.delete(`/tasks/${id}?department=${user.department}`);
  },
};

export function createApiClient({ baseUrl = "" } = {}) {



  async function request(path, { method = "GET", body, customHeaders = {} } = {}) {

    // Get auth token and user data from sessionStorage first (most recent), then localStorage
    const token = sessionStorage.getItem("token") || localStorage.getItem("token") || localStorage.getItem("auth_token");
    
    // Try multiple sources for user data - prioritize sessionStorage
    let userData = sessionStorage.getItem("authUser") || localStorage.getItem("user_data") || localStorage.getItem("authUser");
    if (!userData) {
      userData = localStorage.getItem("authUser") || localStorage.getItem("user");
    }
    
    const user = sessionStorage.getItem("user") || localStorage.getItem("user");
    
    const userRole = sessionStorage.getItem("user_role") || localStorage.getItem("user_role");

    

    // 🔥 DEBUG: Log all storage sources
    console.log('🔍 [API] Storage sources:', {
      localStorage_token: localStorage.getItem("token"),
      sessionStorage_token: sessionStorage.getItem("token"),
      localStorage_userData: localStorage.getItem("user_data"),
      sessionStorage_authUser: sessionStorage.getItem("authUser"),
      localStorage_userRole: localStorage.getItem("user_role"),
      sessionStorage_userRole: sessionStorage.getItem("user_role")
    });
    
    // 🔥 GET USER INFO FOR DEPARTMENT ISOLATION
    const parsedUser = userData ? JSON.parse(userData) : (user ? JSON.parse(user) : null);

    const userId = parsedUser?.id || parsedUser?.userId || null;

    const userDepartment = parsedUser?.department || parsedUser?.departmentName || null;

    // 🔥 FIX: Extract role from parsed user data, not localStorage
    const actualUserRole = parsedUser?.role || parsedUser?.roleName || userRole;
    
    // 🔥 DEBUG: Log role extraction
    console.log('🔍 [API] User data extraction:', {
      parsedUser: parsedUser,
      parsedUserId: parsedUser?.id,
      parsedUserId_alt: parsedUser?.userId,
      finalUserId: userId,
      parsedUserRole: parsedUser?.role,
      parsedUserRoleName: parsedUser?.roleName,
      localStorageUserRole: userRole,
      finalActualUserRole: actualUserRole,
      path: path
    });



    const headers = {

      // 🔥 CRITICAL FIX: Don't set Content-Type for FormData - let browser set multipart boundary
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),

      Accept: "application/json",

      ...customHeaders

    };



    // Add auth token if available

    if (token) {

      headers["Authorization"] = `Bearer ${token}`;

    }



    // 🔥 ADD USER CONTEXT HEADERS FOR ALL CRM ENDPOINTS

    if (path.includes('/deals') || path.includes('/tasks') || path.includes('/clients') || path.includes('/activities') || path.includes('/notes') || path.includes('/expenses')) {

      if (userId) headers["X-User-Id"] = userId?.toString();

      if (actualUserRole) headers["X-User-Role"] = actualUserRole;

      if (userDepartment) headers["X-User-Department"] = userDepartment;

    }



    // Add role-based headers for admin endpoints

    if (path.includes('/tasks') && !path.includes('/employee/')) {

      // 🔥 Allow ADMIN, MANAGER, and TL roles to access tasks

      if (!['ADMIN', 'MANAGER', 'TL'].includes(actualUserRole)) {

        console.log('🔍 API Access check - actualUserRole:', actualUserRole, 'userRole:', userRole, 'parsedUser:', parsedUser, 'path:', path);

        throw new Error('Access denied: Admin, Manager, or TL role required');

      }

    }



    // Add user ID filter for sub-admins

    if (path.includes('/tasks') && actualUserRole === 'SUBADMIN' && userId) {

      // Modify URL to include createdBy filter for sub-admins

      const separator = path.includes('?') ? '&' : '?';

      path = `${path}${separator}createdBy=${userId}`;

    }



    const res = await fetch(baseUrl + path, {

      method,

      headers,

      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),

    });



    if (!res.ok) {

      const errorText = await res.text();

      // Create a custom error for client errors that won't log to console
      const error = new Error(errorText || `HTTP ${res.status}`);
      error.status = res.status;
      error.isClientError = res.status >= 400 && res.status < 500;
      error.isServerError = res.status >= 500;

      // Only log unexpected errors (5xx server errors, network issues)
      if (res.status >= 500) {
        console.error('Server Error:', res.status, errorText);
      } else if (res.status >= 400) {
        // Client errors (4xx) are expected and handled by frontend
        // No console.error - these are handled gracefully by components
      }

      throw error;

    }



    const text = await res.text();

    return text ? JSON.parse(text) : null;

  }



  return {

    get: (p) => request(p),

    post: (p, b) => request(p, { method: "POST", body: b }),

    put: (p, b) => request(p, { method: "PUT", body: b }),

    delete: (p) => request(p, { method: "DELETE" }),

  };

}



export const backendApi = createApiClient({

  baseUrl: "http://localhost:8080/api",

});



export function delay(ms) {

  return new Promise((resolve) => setTimeout(resolve, ms));

}


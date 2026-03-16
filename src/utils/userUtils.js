import { useState, useEffect } from "react";
import { getTabSafeItem } from "./tabSafeStorage";

// Utility functions for dynamic user data
export const getCurrentUser = () => {
  if (typeof window === "undefined") return null;
  try {
    // Priority: sessionStorage -> tabSafeStorage -> localStorage
    let userDataStr = sessionStorage.getItem('user_data');
    
    if (!userDataStr) {
      userDataStr = getTabSafeItem("user_data");
    }
    
    if (!userDataStr) {
      userDataStr = localStorage.getItem('user_data');
    }
    
    // Also try other common keys
    if (!userDataStr) {
      userDataStr = sessionStorage.getItem('authUser') || localStorage.getItem('authUser');
    }
    
    const userData = JSON.parse(userDataStr || "{}");
    
    // Debug log to help identify the issue
    console.log('🔍 [USER_UTILS] getCurrentUser result:', {
      sessionStorage_userData: sessionStorage.getItem('user_data'),
      localStorage_userData: localStorage.getItem('user_data'),
      sessionStorage_authUser: sessionStorage.getItem('authUser'),
      localStorage_authUser: localStorage.getItem('authUser'),
      finalUserData: userData
    });
    
    return userData;
  } catch (error) {
    console.error("Error parsing user data:", error);
    return null;
  }
};

export const getCurrentUserRole = () => {
  if (typeof window === "undefined") return "ADMIN";
  return getTabSafeItem("user_role") || "ADMIN";
};

export const getCurrentUserName = () => {
  const user = getCurrentUser();
  if (user && user.firstName) {
    return `${user.firstName} ${user.lastName || ""}`.trim();
  }
  return "Admin User";
};

export const getCurrentUserId = () => {
  const user = getCurrentUser();
  const userId = user?.id || user?.userId || null;
  
  console.log('🔍 [USER_UTILS] getCurrentUserId:', {
    user: user,
    userId: userId,
    // Note: ID 1 is actually valid in this system (it's the real user ID)
    hasValidId: !!userId
  });
  
  // Return the actual user ID (ID 1 is valid in this system)
  return userId;
};

// React hook version for components that need reactivity
export const useCurrentUser = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("ADMIN");

  useEffect(() => {
    if (typeof window === "undefined") return;

    const updateUser = () => {
      const userData = getCurrentUser();
      const userRole = getCurrentUserRole();
      setUser(userData);
      setRole(userRole);
    };

    updateUser();

    // Listen for storage changes
    const handleStorageChange = (e) => {
      if (e.key === "user_data" || e.key === "user_role") {
        updateUser();
      }
    };

    window.addEventListener("storage", handleStorageChange);
    return () => window.removeEventListener("storage", handleStorageChange);
  }, []);

  return { user, role, userName: getCurrentUserName(), userId: getCurrentUserId() };
};

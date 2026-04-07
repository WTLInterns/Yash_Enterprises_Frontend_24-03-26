// Auth service - sessionStorage only (no localStorage to prevent cross-tab loop)
export const authService = {
  getToken() {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("jwt_token");
  },

  getUserRole() {
    if (typeof window === "undefined") return null;
    return sessionStorage.getItem("user_role");
  },

  isAuthenticated() {
    if (typeof window === "undefined") return false;
    return !!sessionStorage.getItem("user_data");
  },

  logout() {
    if (typeof window === "undefined") return;
    sessionStorage.removeItem("jwt_token");
    sessionStorage.removeItem("user_role");
    sessionStorage.removeItem("user_data");
    // Also clear any stale localStorage
    localStorage.removeItem("jwt_token");
    localStorage.removeItem("user_role");
    localStorage.removeItem("user_data");
  },

  login() {
    return Promise.resolve({ success: true });
  }
};

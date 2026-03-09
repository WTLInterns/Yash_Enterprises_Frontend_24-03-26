/**
 * 🔐 UNIFIED AUTHENTICATION HELPER
 * Single source of truth for user data across the entire application
 * Eliminates role/department field inconsistencies
 * 🔥 CACHED to prevent infinite React loops
 */

import { getTabSafeItem } from "./tabSafeStorage";

let cachedUser = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds

export const getAuthUser = () => {
  if (typeof window === "undefined") return null;

  // 🔥 Return cached user if still valid
  const now = Date.now();
  if (cachedUser && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedUser;
  }

  try {
    const raw = getTabSafeItem("user_data");
    if (!raw) {
      cachedUser = null;
      return null;
    }

    const parsed = JSON.parse(raw);

    cachedUser = {
      id: parsed?.id,
      role: parsed?.role || parsed?.roleName,
      department: parsed?.department || parsed?.departmentName || null,
      name: parsed?.fullName || parsed?.name || "User",
    };

    cacheTimestamp = now;
    return cachedUser;
  } catch {
    cachedUser = null;
    return null;
  }
};

/**
 * 🛡️ Clear auth cache (call on login/logout)
 */
export const clearAuthUserCache = () => {
  cachedUser = null;
  cacheTimestamp = 0;
};

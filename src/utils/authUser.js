let cachedUser = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000;

export const getAuthUser = () => {
  if (typeof window === "undefined") return null;

  const now = Date.now();
  if (cachedUser && (now - cacheTimestamp) < CACHE_DURATION) return cachedUser;

  try {
    const raw = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");
    if (!raw) { cachedUser = null; return null; }

    const parsed = JSON.parse(raw);
    cachedUser = {
      id:         parsed?.id,
      role:       parsed?.role || parsed?.roleName,
      department: parsed?.department || parsed?.departmentName || null,
      name:       parsed?.fullName || parsed?.name || "User",
    };
    cacheTimestamp = now;
    return cachedUser;
  } catch {
    cachedUser = null;
    return null;
  }
};

export const clearAuthUserCache = () => {
  cachedUser = null;
  cacheTimestamp = 0;
};

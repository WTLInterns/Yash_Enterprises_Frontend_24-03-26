import { useState, useEffect } from "react";

function readUserData() {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem("user_data");
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export const getCurrentUser = () => readUserData();

export const getCurrentUserRole = () => {
  const u = readUserData();
  return u?.role || u?.roleName || "ADMIN";
};

export const getCurrentUserName = () => {
  const u = readUserData();
  if (!u) return "Admin User";
  return u.fullName || (u.firstName ? `${u.firstName} ${u.lastName || ""}`.trim() : u.name) || "Admin User";
};

export const getCurrentUserId = () => {
  const u = readUserData();
  return u?.id || u?.userId || null;
};

export const getAuthUser = () => readUserData();

export const useCurrentUser = () => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState("ADMIN");

  useEffect(() => {
    const update = () => {
      const u = readUserData();
      setUser(u);
      setRole(u?.role || "ADMIN");
    };
    update();
    window.addEventListener("storage", update);
    return () => window.removeEventListener("storage", update);
  }, []);

  return { user, role, userName: getCurrentUserName(), userId: getCurrentUserId() };
};

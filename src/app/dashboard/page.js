"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUserRole, getCurrentUserName } from "@/utils/userUtils";

// ✅ ROLE-BASED DASHBOARD COMPONENTS
import AdminManagerCRMDashboard from "@/components/dashboards/AdminManagerCRMDashboard";
import TLDepartmentDashboard from "@/components/dashboards/TLDepartmentDashboard";
import EmployeeDashboard from "@/components/dashboards/EmployeeDashboard";

export default function UnifiedDashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === "undefined") return;
    // sessionStorage ONLY — getTabSafeItem was returning null causing redirect loop
    const raw = sessionStorage.getItem("user_data");
    const user = raw ? JSON.parse(raw) : null;
    const role = user?.role || sessionStorage.getItem("user_role") || null;
    const name = user?.fullName || (user?.firstName ? `${user.firstName} ${user.lastName || ""}`.trim() : user?.name) || "User";

    setUserRole(role);
    setUserName(name);
    setLoading(false);

    if (!role) {
      router.replace("/login");
    }
  }, [router]);

  const renderDashboard = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
        </div>
      );
    }

    switch (userRole?.toUpperCase()) {
      case "ADMIN":
      case "MANAGER":
        return <AdminManagerCRMDashboard userName={userName} userRole={userRole} />;
      case "TL":
      case "ACCOUNT":
        return <TLDepartmentDashboard userName={userName} userRole={userRole} />;
      case "EMPLOYEE":
        return <EmployeeDashboard userName={userName} userRole={userRole} />;
      default:
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout
      header={{
        project: ["ADMIN", "MANAGER"].includes(userRole?.toUpperCase())
          ? "CRM System - Yashraj"
          : userRole?.toUpperCase() === "TL"
          ? "Department Dashboard"
          : "Employee Dashboard",
        user: { name: userName || "User", role: userRole || "Unknown" },
        tabs: [],
        activeTabKey: "dashboard"
      }}
    >
      {renderDashboard()}
    </DashboardLayout>
  );
}

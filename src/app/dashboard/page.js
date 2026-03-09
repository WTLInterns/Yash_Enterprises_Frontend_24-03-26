"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUserRole, getCurrentUserName } from "@/utils/userUtils";
import { getTabSafeItem } from "@/utils/tabSafeStorage";

// ✅ ROLE-BASED DASHBOARD COMPONENTS
import AdminManagerCRMDashboard from "@/components/dashboards/AdminManagerCRMDashboard";
import TLDepartmentDashboard from "@/components/dashboards/TLDepartmentDashboard";
import EmployeeDashboard from "@/components/dashboards/EmployeeDashboard";

export default function UnifiedDashboard() {
  const router = useRouter();
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState(null);
  const [loading, setLoading] = useState(true);

  // ✅ Get user role and name from tab-safe storage
  useEffect(() => {
    if (typeof window !== "undefined") {
      const role = getTabSafeItem("user_role");
      const name = getCurrentUserName();
      
      setUserRole(role);
      setUserName(name);
      setLoading(false);
      
      console.log('Unified Dashboard - Role:', role, 'Name:', name);
      console.log('📊 Dashboard loaded for tab with role:', role);
    }
  }, []);

  // ✅ Redirect unauthorized roles
  useEffect(() => {
    if (!loading && !userRole) {
      router.push("/login");
      return;
    }
  }, [userRole, loading, router]);

  // ✅ Redirect unrecognized roles
  useEffect(() => {
    if (!loading && userRole && !["ADMIN", "MANAGER", "TL", "EMPLOYEE"].includes(userRole?.toUpperCase())) {
      router.push("/login");
      return;
    }
  }, [userRole, loading, router]);

  // ✅ Render appropriate dashboard based on role
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
        return <TLDepartmentDashboard userName={userName} userRole={userRole} />;
      
      case "EMPLOYEE":
        return <EmployeeDashboard userName={userName} userRole={userRole} />;
      
      default:
        // Unrecognized role - will be handled by useEffect
        return (
          <div className="flex items-center justify-center min-h-screen">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Redirecting...</p>
            </div>
          </div>
        );
    }
  };

  return (
    <DashboardLayout
      header={{
        project: userRole?.toUpperCase() === "ADMIN" || userRole?.toUpperCase() === "MANAGER" 
          ? "CRM System - Yashraj" 
          : userRole?.toUpperCase() === "TL" 
          ? "Department Dashboard" 
          : "Employee Dashboard",
        user: {
          name: userName || "User",
          role: userRole || "Unknown"
        },
        tabs: [],
        activeTabKey: "dashboard"
      }}
    >
      {renderDashboard()}
    </DashboardLayout>
  );
}

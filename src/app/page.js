"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { getCurrentUserRole } from "@/utils/userUtils";

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    // REDIRECT TO ROLE-BASED DASHBOARD
    const userRole = getCurrentUserRole();
    
    if (userRole) {
      console.log('Redirecting to role-based dashboard for:', userRole);
      router.replace('/dashboard');
    } else {
      // No role found, redirect to login
      router.replace('/login');
    }
  }, [router]);

  // SHOW LOADING WHILE REDIRECTING
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to your dashboard...</p>
      </div>
    </div>
  );
}

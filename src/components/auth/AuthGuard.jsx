"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AuthGuard({ children, allowedRoles = [] }) {
  const router = useRouter();

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");
      const user = raw ? JSON.parse(raw) : null;

      if (!user?.id || !user?.role) {
        router.replace("/login");
        return;
      }

      if (allowedRoles.length && !allowedRoles.includes(user.role)) {
        router.replace("/login");
      }
    } catch {
      router.replace("/login");
    }
  }, [router, allowedRoles]);

  return <>{children}</>;
}

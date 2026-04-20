"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";

const PUBLIC_PATHS = ["/login", "/admin-register", "/addOrganization"];

export default function AuthGuard({ children, allowedRoles = [] }) {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (PUBLIC_PATHS.some((p) => pathname?.startsWith(p))) return;

    try {
      // sessionStorage ONLY — localStorage causes cross-tab loop
      const raw = sessionStorage.getItem("user_data");
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
  }, [router, pathname]);

  return <>{children}</>;
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { backendApi } from "@/services/api";
import { CheckCircle2 } from "lucide-react";

export default function ApprovalNavBadge({ userRole }) {
  const [pendingCount, setPendingCount] = useState(0);

  const fetchCount = async () => {
    if (userRole !== "ADMIN" && userRole !== "MANAGER") return;
    try {
      const data = await backendApi.get("/approvals/pending/count");
      setPendingCount(data?.count || 0);
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    fetchCount();
    // Auto-refresh every 60 seconds
    const interval = setInterval(fetchCount, 60000);

    // Listen for BroadcastChannel (when approval is processed)
    let bc = null;
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("crm-updates");
      bc.onmessage = (e) => {
        if (
          e.data?.type === "DEAL_APPROVAL_COMPLETED" ||
          e.data?.type === "DEAL_TRANSFER_REQUEST"
        ) {
          fetchCount();
        }
      };
    }

    return () => {
      clearInterval(interval);
      if (bc) bc.close();
    };
  }, [userRole]);

  if (userRole !== "ADMIN" && userRole !== "MANAGER") return null;

  return (
    <Link
      href="/approvals"
      className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-slate-700 hover:bg-slate-100 hover:text-slate-900 transition-colors"
    >
      <CheckCircle2 className="h-4 w-4 shrink-0" />
      <span>Approvals</span>
      {pendingCount > 0 && (
        <span className="ml-auto inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold px-1">
          {pendingCount > 99 ? "99+" : pendingCount}
        </span>
      )}
    </Link>
  );
}

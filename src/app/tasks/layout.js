"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";

const tabs = [
  { name: "Overview", href: "/tasks/overview" },
  { name: "Tasks Management", href: "/tasks/tasks-management" },
  { name: "Routes", href: "/tasks/routes" },
];

export default function TasksLayout({ children }) {
  const pathname = usePathname();

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">

        {/* 🔥 Sticky Tabs — sticks below the Topbar (top-0 since Topbar is sticky in its own container) */}
        <div className="sticky top-0 z-30 bg-white border-b border-slate-200 shadow-sm flex-shrink-0">
          <div className="flex gap-8 px-6">
            {tabs.map((tab) => {
              const active = pathname === tab.href;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`py-4 text-sm font-semibold border-b-2 transition whitespace-nowrap ${
                    active
                      ? "border-indigo-600 text-indigo-600"
                      : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {tab.name}
                </Link>
              );
            })}
          </div>
        </div>

        {/* 🔥 Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="py-6 px-6">
            {children}
          </div>
        </div>

      </div>
    </DashboardLayout>
  );
}

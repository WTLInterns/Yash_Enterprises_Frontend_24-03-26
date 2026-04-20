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
      <div className="flex flex-col">

        {/* 🔥 Sticky Tabs */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 shadow-sm flex-shrink-0 -mx-4 sm:-mx-6 px-4 sm:px-6">
          <div className="flex gap-8 overflow-x-auto">
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

        {/* 🔥 Content */}
        <div className="py-6">
          {children}
        </div>

      </div>
    </DashboardLayout>
  );
}

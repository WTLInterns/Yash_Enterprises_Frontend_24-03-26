"use client";



import { useEffect, useState } from "react";

import { useRouter, usePathname } from "next/navigation";

import { getAuthUser, getCurrentUserRole } from "@/utils/userUtils";
import { clearAuthUserCache } from "@/utils/authUser";

import { Menu, X } from "lucide-react";

import { AnimatePresence, motion } from "framer-motion";



import Sidebar, { SIDEBAR_WIDTH } from "@/components/layout/Sidebar";

import Topbar from "@/components/layout/Topbar";



// ✅ FIXED: Role-based sidebar sections with professional labels

const sidebarSections = [

  {

    key: "lead-management",

    label: "Lead Management",

    items: [

      { key: "zoho-dashboard", label: "Dashboard", href: "/dashboard", icon: "dashboard", accent: "indigo" },

      { key: "zoho-customers", label: "Customers", href: "/customers", icon: "client", accent: "emerald" },

      { key: "zoho-bank", label: "Bank", href: "/bank", icon: "bank", accent: "amber" },

      { key: "zoho-products", label: "Products", href: "/products", icon: "products", accent: "violet" },

      { key: "zoho-approvals", label: "Lead Approvals", href: "/approvals", icon: "tasks", accent: "orange", roleRestricted: ["MANAGER"] },

    ],

  },

  {

    key: "hrm",

    label: "HRM",

    items: [

      // ✅ REMOVED: Unolo dashboard for TL (will be handled by role-based routing)

      { key: "hrm-dashboard", label: "HRM Dashboard", href: "/hrm", icon: "dashboard", accent: "indigo" },

      { key: "unolo-attendance", label: "Attendance", href: "/attendance", icon: "attendance", accent: "cyan" },

      { key: "unolo-leave", label: "Leave", href: "/leaves", icon: "leaves", accent: "rose" },

      { key: "unolo-organization", label: "Organization", href: "/organization", icon: "org", accent: "slate" },

      { key: "unolo-form", label: "Form", href: "/form", icon: "form", accent: "teal" },

      { key: "unolo-sites", label: "Sites", href: "/sites", icon: "sites", accent: "lime" },

      { key: "tasks", label: "Tasks", href: "/tasks", icon: "tasks", accent: "indigo" },

    ],

  },

  {

    key: "address-management",

    label: "Address Management",

    items: [

      { key: "address-edit-requests", label: "Address Edit Requests", href: "/admin/address-edit-requests", icon: "edit", accent: "blue" },

    ],

  },

  {

    key: "accounts",

    label: "Accounts Department",

    items: [

      { key: "expenses-overview", label: "Overview", href: "/expenses", icon: "dashboard", accent: "green" },

      { key: "expenses-invoices", label: "Invoices", href: "/expenses/invoices", icon: "invoice", accent: "purple" },

    ],

  },

];



// navigationItems will be derived from filteredSections (after applying role/department filters)



export default function DashboardLayout({ header, children }) {

  const pathname = usePathname();

  const router = useRouter();

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);



  // ✅ Get user role AND department from sessionStorage
  const [userRole, setUserRole] = useState(null);
  const [userDept, setUserDept] = useState(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    // sessionStorage ONLY — getTabSafeItem was causing redirect loop
    const raw = sessionStorage.getItem("user_data");
    const u = raw ? JSON.parse(raw) : null;
    setUserRole(u?.role || sessionStorage.getItem("user_role") || null);
    setUserDept((u?.department || u?.departmentName || "").toUpperCase());
  }, []);



  // ✅ disable background scroll when menu open

  useEffect(() => {

    if (typeof window === "undefined") return;

    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";

    return () => (document.body.style.overflow = "");

  }, [mobileMenuOpen]);



  // Filter sidebar: hide HRM + Address Management for ACCOUNT dept users
  const isAccountDept = userDept === "ACCOUNT";
  const filteredSections = sidebarSections
    .filter(section => {
      if (isAccountDept && (section.key === "hrm" || section.key === "address-management")) return false;
      return true;
    })
    .map((section) => {
      if (section.key === "unolo" && userRole === "TL") {
        return { ...section, items: section.items.filter((item) => item.key !== "unolo-dashboard") };
      }
      return section;
    });



  // Build navigation items from filtered sections so active-key detection matches rendered menu

  const navigationItems = filteredSections.flatMap((s) => s.items);



  const handleLogout = () => {
    if (typeof window !== "undefined") {
      // Clear sessionStorage completely
      sessionStorage.removeItem("user_data");
      sessionStorage.removeItem("user_role");
      sessionStorage.removeItem("tab_id");
      // Clear any stale localStorage
      localStorage.removeItem("user_data");
      localStorage.removeItem("user_role");
      clearAuthUserCache();
    }
    router.push("/login");
  };



  const getActiveKey = () => {

    // Add SSR safety check

    if (typeof window === 'undefined') return "zoho-dashboard";

    

    const pathname = window.location.pathname;

    const activeItem = filteredSections

      .flatMap((section) => section.items)

      .find((item) => item.href && pathname.startsWith(item.href));

    return activeItem?.key || "zoho-dashboard"; // ✅ Fixed fallback key

  };



  const getActiveTabKey = () => {

    // Add SSR safety check

    if (typeof window === 'undefined') return null;

    

    if (!header?.tabs) return null;

    const pathname = window.location.pathname;

    const activeTab = header.tabs.find((tab) =>

      tab.href === "/" ? pathname === "/" : pathname.startsWith(tab.href)

    );

    return activeTab?.key || header?.activeTabKey;

  };



  return (

    <div className="min-h-screen bg-slate-50 flex">

      {/* MOBILE HAMBURGER - show only < md */}

      <button

        type="button"

        onClick={() => setMobileMenuOpen(true)}

        className="fixed top-4 left-4 z-[60] rounded-lg p-2 bg-white/85 backdrop-blur border border-slate-200 shadow-lg md:hidden"

        aria-label="Open menu"

      >

        <Menu className="h-5 w-5 text-slate-700" />

      </button>



      {/* Mobile Drawer */}

      <AnimatePresence>

        {mobileMenuOpen && (

          <>

            <motion.div

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              exit={{ opacity: 0 }}

              className="fixed inset-0 z-[60] bg-black/50 md:hidden"

              onClick={() => setMobileMenuOpen(false)}

            />



            <motion.div

              initial={{ x: "-100%" }}

              animate={{ x: 0 }}

              exit={{ x: "-100%" }}

              transition={{ duration: 0.25, ease: "easeInOut" }}

              className="fixed inset-y-0 left-0 z-[65] md:hidden"

            >

              <div className="relative h-[100dvh]">

                <button

                  type="button"

                  onClick={() => setMobileMenuOpen(false)}

                  className="absolute top-3 right-3 z-[80] rounded-xl p-2 bg-white/85 backdrop-blur border border-slate-200 shadow-lg"

                >

                  <X className="h-5 w-5 text-slate-800" />

                </button>



                <Sidebar

                  sections={filteredSections}

                  brand="Yash"

                  activeKey={getActiveKey()}

                  onLogout={handleLogout}

                  onNavigate={() => setMobileMenuOpen(false)}

                />

              </div>

            </motion.div>

          </>

        )}

      </AnimatePresence>

      {/* Desktop Sidebar: FIXED width, no shrinking */}
      <div className="hidden md:flex md:fixed md:left-0 md:top-0 md:h-[100dvh] md:z-20 md:w-64">
        <Sidebar
          sections={filteredSections}
          brand="Yash"
          activeKey={getActiveKey()}
          onLogout={handleLogout}
        />
      </div>

      {/* Main content: proper margin for fixed sidebar */}
      <div className="flex-1 h-screen main-content flex flex-col overflow-hidden">
        <Topbar
          tabs={header?.tabs || []}
          activeTabKey={getActiveTabKey()}
          onTabClick={(tab) => tab?.href && router.push(tab.href)}
        />
        <main className="flex-1 w-full max-w-[1600px] mx-auto px-4 sm:px-6 py-6 overflow-y-auto overflow-x-hidden">
          {children}
        </main>
      </div>

      {/* Fixed sidebar width styling */}
      <style jsx>{`
        /* Apply fixed margin-left for desktop, none for mobile */
        @media (min-width: 768px) {
          .main-content {
            margin-left: 16rem; /* 256px = w-64 */
            position: relative; /* Ensure proper positioning context */
          }
        }
        
        /* Ensure sidebar never shrinks */
        @media (min-width: 768px) {
          .md\:w-64 {
            width: 16rem !important;
            min-width: 16rem !important;
            max-width: 16rem !important;
          }
        }

        /* Prevent topbar from extending beyond main content */
        .main-content > div:first-child {
          position: relative;
          z-index: 10;
        }
      `}</style>
    </div>
  );
}

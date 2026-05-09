"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { backendApi } from "@/services/api";
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";

function initialForm() {
  return {
    siteName: "",
    siteId: "",
    address: "",
    email: "",
    description: "",
    contactPerson: "",
    contactNumber: "",
    latitude: "",
    longitude: "",
    city: "",
    pincode: "",
  };
}

export default function SitesPage() {
  const router = useRouter();
  
  // ✅ FIXED: Get dynamic user data
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState("list");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingSite, setEditingSite] = useState(null);
  const [form, setForm] = useState(initialForm);
  const [activeInnerTab, setActiveInnerTab] = useState("sites");
  const [selectedSiteOnMap, setSelectedSiteOnMap] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [viewSite, setViewSite] = useState(null);
  const importInputRef = useRef(null);

  useEffect(() => {
    let isMounted = true;
    async function load() {
      try {
        setLoading(true);
        setError("");
        const data = await backendApi.get("/sites");
        if (!isMounted) return;
        setSites(data || []);
      } catch (e) {
        console.error("Failed to load sites", e);
        if (isMounted) setError("Failed to load sites");
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    load();
    return () => {
      isMounted = false;
    };
  }, []);

  const filteredSites = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return sites;
    return sites.filter((s) => {
      const values = [
        s.siteName,
        s.siteId,
        s.address,
        s.city,
        s.pincode,
        s.contactPerson,
      ];
      return values.some((v) => (v || "").toLowerCase().includes(term));
    });
  }, [sites, search]);

  const totalPages = Math.max(1, Math.ceil(filteredSites.length / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    return filteredSites.slice(start, end);
  }, [filteredSites, currentPage, pageSize]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleOpenAdd = () => {
    setForm(initialForm());
    setIsAddOpen(true);
  };

  const handleOpenEdit = (Sites) => {
    setEditingSite(Sites);
    setForm({
      siteName: Sites.siteName || "",
      siteId: Sites.siteId || "",
      address: Sites.address || "",
      email: Sites.email || "",
      description: Sites.description || "",
      contactPerson: Sites.contactPerson || "",
      contactNumber: Sites.contactNumber || "",
      latitude: Sites.latitude ?? "",
      longitude: Sites.longitude ?? "",
      city: Sites.city || "",
      pincode: Sites.pincode || "",
    });
    setIsEditOpen(true);
  };

  const buildPayload = () => {
    return {
      siteName: form.siteName,
      siteId: form.siteId,
      address: form.address,
      email: form.email,
      description: form.description,
      contactPerson: form.contactPerson,
      contactNumber: form.contactNumber,
      latitude: form.latitude ? Number(form.latitude) : null,
      longitude: form.longitude ? Number(form.longitude) : null,
      city: form.city,
      pincode: form.pincode,
    };
  };

  const handleSubmitAdd = async (e) => {
    e.preventDefault();
    try {
      const payload = buildPayload();
      const created = await backendApi.post("/sites", payload);
      setSites((prev) => [...prev, created]);
      setIsAddOpen(false);
      setForm(initialForm());
    } catch (e) {
      console.error("Failed to add site", e);
      alert("Failed to add site");
    }
  };

  const handleSubmitEdit = async (e) => {
    e.preventDefault();
    if (!editingSite) return;
    try {
      const payload = buildPayload();
      const updated = await backendApi.put(`/sites/${editingSite.id}`, payload);
      setSites((prev) => prev.map((s) => (s.id === editingSite.id ? updated : s)));
      setIsEditOpen(false);
      setEditingSite(null);
    } catch (e) {
      console.error("Failed to update site", e);
      alert("Failed to update site");
    }
  };

  const handleDelete = async (site) => {
    if (!window.confirm("Delete this site?")) return;
    try {
      await backendApi.delete(`/sites/${site.id}`);
      setSites((prev) => prev.filter((s) => s.id !== site.id));
      setSelectedIds((prev) => prev.filter((id) => id !== site.id));
    } catch (e) {
      console.error("Failed to delete site", e);
      alert("Failed to delete site");
    }
  };

  const isRowSelected = (id) => selectedIds.includes(id);

  const handleToggleRow = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleToggleAllVisible = () => {
    const visibleIds = pageItems.map((s) => s.id).filter(Boolean);
    const allSelected =
      visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
    if (allSelected) {
      // Deselect visible rows only
      setSelectedIds((prev) => prev.filter((id) => !visibleIds.includes(id)));
    } else {
      // Select all visible rows, keeping any previously selected outside the page
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!window.confirm(`Delete ${selectedIds.length} selected site(s)?`)) return;

    try {
      const idsToDelete = [...selectedIds];
      await Promise.all(
        idsToDelete.map((id) => backendApi.delete(`/sites/${id}`).catch(() => null)),
      );
      setSites((prev) => prev.filter((s) => !idsToDelete.includes(s.id)));
      setSelectedIds([]);
    } catch (e) {
      console.error("Failed to bulk delete sites", e);
      alert("Failed to delete some sites");
    }
  };

  const handleImportClick = () => {
    if (importInputRef.current) {
      importInputRef.current.click();
    }
  };

  const handleImportChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("file", file);

      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

      // Use fetch directly so we can send FormData without JSON headers
      const res = await fetch("http://localhost:8080/api/sites/import", {
        method: "POST",
        body: formData,
        headers: {
          // Do NOT set Content-Type here; the browser will set multipart/form-data with boundary
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        console.error("Sites import failed", res.status, text);
        throw new Error(`Import failed with status ${res.status}`);
      }

      // Refresh list so imported data appears immediately
      const data = await backendApi.get("/sites");
      setSites(data || []);
      setSelectedIds([]);

      alert("Sites imported successfully.");
    } catch (e) {
      console.error("Failed to import sites", e);
      alert("Failed to import some or all rows from the Excel file.");
    } finally {
      // Clear file input so the same file can be selected again if needed
      event.target.value = "";
    }
  };

  const EyeIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        className="stroke-current"
        strokeWidth="1.8"
      />
    </svg>
  );

  const EditIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M12 20h9"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4 11.5-11.5Z"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );

  const TrashIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 7h16"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M10 11v6"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M14 11v6"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M6.5 7l1 14h9l1-14"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path
        d="M9 7V4h6v3"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );

  const SearchIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle
        cx="11"
        cy="11"
        r="6"
        className="stroke-current"
        strokeWidth="1.8"
      />
      <path
        d="M16 16l4 4"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

  const FilterIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M4 5h16l-5.5 6.5V18l-5 2v-8.5L4 5Z"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );

  const ExportIcon = ({ className }) => (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M8 12l4-4 4 4"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 8v9"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
      <path
        d="M5 20h14"
        className="stroke-current"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );

  return (
    <DashboardLayout
      header={{
        project: "Sites",
        user: { name: userName, role: userRole },
        notifications: [],
        tabs: [
          { key: "sites", label: "📍 Sites", href: "/sites" },
          { key: "geofences", label: "🧭 Geofences", href: "/geofences" },
        ],
        activeTabKey: "sites",
      }}
    >
      <div className="min-h-screen bg-slate-50/80 pb-6">
        <div className="mx-auto flex max-w-7xl flex-col gap-5 px-3 pt-2 sm:px-4">
          {/* Page title + Tabs + Primary CTA */}
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="mt-3 flex items-center gap-6 text-sm font-medium">
                <button
                  type="button"
                  onClick={() => setActiveInnerTab("sites")}
                  className={`inline-flex items-center gap-2 border-b-2 pb-1.5 transition-colors ${
                    activeInnerTab === "sites"
                      ? "border-emerald-500 text-emerald-600"
                      : "border-transparent text-slate-400 hover:text-slate-600"
                  }`}
                >
                  <span className="text-base">📍</span>
                  <span>Sites</span>
                  <span className="text-xs font-normal text-emerald-500/80">({sites.length})</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-start md:justify-end">
              <button
                type="button"
                onClick={handleOpenAdd}
                className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add Sites</span>
              </button>
            </div>
          </div>

          {/* Controls: View toggle + Filters/Export + Search */}
          <div className="flex flex-col gap-3 rounded-2xl bg-white/70 p-3 shadow-sm ring-1 ring-slate-100 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-1 items-center gap-3">
              <div className="inline-flex items-center rounded-full bg-slate-50 text-xs font-medium text-slate-500 shadow-sm ring-1 ring-slate-200/80">
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                    viewMode === "list"
                      ? "bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100"
                      : "text-slate-500 hover:text-emerald-600"
                  }`}
                >
                  <span className="text-sm">📋</span>
                  <span>List</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("map")}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition ${
                    viewMode === "map"
                      ? "bg-white text-emerald-600 shadow-sm ring-1 ring-emerald-100"
                      : "text-slate-500 hover:text-emerald-600"
                  }`}
                >
                  <span className="text-sm">🗺️</span>
                  <span>Map</span>
                </button>
              </div>

              <div className="flex items-center gap-2 pl-1">
                {/* <button
                  type="button"
                  title="Filter"
                  aria-label="Filter"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/80 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  onClick={() =>
                    alert(
                      "Filters are not yet wired to the backend. You can add client-side filters here.",
                    )
                  }
                >
                  <FilterIcon className="h-4 w-4" />
                </button> */}

                <button
                  type="button"
                  title="Import from Excel"
                  aria-label="Import from Excel"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-emerald-50/80 hover:text-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                  onClick={handleImportClick}
                >
                  <ExportIcon className="h-4 w-4 rotate-180" />
                </button>

                <button
                  type="button"
                  title="Export to Excel"
                  aria-label="Export to Excel"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:bg-sky-50/80 hover:text-sky-600 focus:outline-none focus:ring-2 focus:ring-sky-400/50"
                  onClick={async () => {
                    try {
                      const token = typeof window !== "undefined" ? localStorage.getItem("auth_token") : null;

                      const res = await fetch("http://localhost:8080/api/sites/export", {
                        method: "GET",
                        headers: {
                          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                          ...(token && { Authorization: `Bearer ${token}` }),
                        },
                      });

                      if (!res.ok) {
                        const text = await res.text().catch(() => "");
                        console.error("Failed to export sites", res.status, text);
                        alert("Failed to export sites");
                        return;
                      }

                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = "sites.xlsx";
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch (e) {
                      console.error("Failed to export sites", e);
                      alert("Failed to export sites");
                    }
                  }}
                >
                  <ExportIcon className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex flex-1 justify-center sm:justify-end">
              <div className="relative w-full max-w-md">
                <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center text-slate-400">
                  <SearchIcon className="h-4 w-4" />
                </span>
                <input
                  type="text"
                  placeholder="Search sites, city or pincode"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="w-full rounded-full border border-slate-200 bg-white px-11 py-2.5 text-sm text-slate-900 shadow-[0_4px_16px_rgba(15,23,42,0.08)] placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-emerald-400/60"
                />
              </div>
            </div>
          </div>

          {/* Hidden file input for Excel import */}
          <input
            ref={importInputRef}
            type="file"
            accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
            className="hidden"
            onChange={handleImportChange}
          />

          {/* Content */}
          {activeInnerTab === "pools" ? (
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
            Sites Pools view is not yet implemented.
          </div>
          ) : viewMode === "list" ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04),0_18px_45px_rgba(15,23,42,0.08)]">
            {selectedIds.length > 0 && (
              <div className="flex items-center justify-between gap-3 border-b border-indigo-100 bg-indigo-50/80 px-5 py-2 text-xs text-slate-700">
                <span className="font-medium">
                  {selectedIds.length} row{selectedIds.length > 1 ? "s" : ""} selected
                </span>
                <button
                  type="button"
                  onClick={handleBulkDelete}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-600 shadow-sm ring-1 ring-red-200 transition hover:bg-red-100 hover:text-red-700"
                >
                  <span className="text-sm">🗑️</span>
                  <span>DELETE</span>
                </button>
              </div>
            )}
            <div className="relative max-h-[520px] overflow-x-auto overflow-y-auto">
              <table className="min-w-full border-separate border-spacing-0 text-sm">
                <thead className="sticky top-0 z-10 bg-slate-100/90 backdrop-blur">
                  <tr>
                    <th className="w-10 px-4 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      <input
                        type="checkbox"
                        onChange={handleToggleAllVisible}
                        checked={
                          pageItems.length > 0 &&
                          pageItems
                            .map((s) => s.id)
                            .filter(Boolean)
                            .every((id) => selectedIds.includes(id))
                        }
                        className="h-4 w-4 rounded border-slate-300 text-indigo-500 shadow-sm transition focus:ring-indigo-400"
                      />
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Site
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Site ID
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Address
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Email
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Description
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Contact Person
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Contact Number
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Latitude
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Longitude
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      City
                    </th>
                    <th className="px-6 py-3.5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Pincode
                    </th>
                    <th className="px-6 py-3.5 text-center text-[11px] font-bold uppercase tracking-wider text-slate-600">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100/80 bg-white">
                  {loading ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-6 py-4 text-center text-sm text-slate-500"
                      >
                        Loading Sites...
                      </td>
                    </tr>
                  ) : pageItems.length === 0 ? (
                    <tr>
                      <td
                        colSpan={13}
                        className="px-6 py-4 text-center text-sm text-slate-500"
                      >
                        No Sites found.
                      </td>
                    </tr>
                  ) : (
                    pageItems.map((site) => {
                      const selected = isRowSelected(site.id);
                      return (
                      <tr
                        key={site.id}
                        className={`transition-colors ${
                          selected
                            ? "bg-indigo-50/70 hover:bg-indigo-50/70"
                            : "hover:bg-slate-50/70"
                        }`}
                      >
                        <td className="w-10 px-4 py-4">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => handleToggleRow(site.id)}
                            className="h-4 w-4 rounded border-slate-300 text-indigo-500 shadow-sm transition focus:ring-indigo-400"
                          />
                        </td>
                        <td className="max-w-[220px] px-6 py-4 text-slate-900">
                          <div className="truncate text-sm font-medium">{site.siteName || "-"}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">{site.siteId || "-"}</td>
                        <td className="max-w-[260px] px-6 py-4 text-slate-700">
                          <div className="truncate">{site.address || "-"}</div>
                        </td>
                        <td className="max-w-[220px] px-6 py-4 text-slate-700">
                          <div className="truncate">{site.email || "-"}</div>
                        </td>
                        <td className="max-w-[260px] px-6 py-4 text-slate-700">
                          <div className="truncate">{site.description || "-"}</div>
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                          {site.contactPerson || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                          {site.contactNumber || "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                          {site.latitude ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">
                          {site.longitude ?? "-"}
                        </td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">{site.city || "-"}</td>
                        <td className="whitespace-nowrap px-6 py-4 text-slate-700">{site.pincode || "-"}</td>
                        <td className="whitespace-nowrap px-6 py-4">
                          <div className="flex items-center justify-center gap-2">
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-slate-600 ring-1 ring-slate-200 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-400/20"
                              onClick={() => setViewSite(site)}
                              aria-label="View"
                            >
                              <EyeIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-indigo-600 ring-1 ring-indigo-200 shadow-sm transition hover:bg-indigo-50 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                              onClick={() => handleOpenEdit(site)}
                              aria-label="Edit"
                            >
                              <EditIcon className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-red-500 ring-1 ring-red-200 shadow-sm transition hover:bg-red-50 hover:text-red-600 focus:outline-none focus:ring-2 focus:ring-red-500/20"
                              onClick={() => handleDelete(site)}
                              aria-label="Delete"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )})
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination footer */}
            <div className="flex items-center justify-between border-t border-slate-200/70 px-6 py-3 text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>Rows per page:</span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="rounded-md border border-slate-200 bg-white px-2 py-1 text-xs shadow-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                >
                  <option value={10}>10</option>
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                </select>
              </div>
              <div className="flex items-center gap-4">
                <span>
                  {filteredSites.length === 0
                    ? "0 of 0"
                    : `${(currentPage - 1) * pageSize + 1}-${
                        Math.min(currentPage * pageSize, filteredSites.length)
                      } of ${filteredSites.length}`}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={currentPage === 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm disabled:opacity-40"
                  >
                    {"<"}
                  </button>
                  <button
                    type="button"
                    disabled={currentPage === totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className="rounded-md border border-slate-200 bg-white px-2 py-1 shadow-sm disabled:opacity-40"
                  >
                    {">"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="relative h-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-slate-100 shadow-sm">
            <div className="absolute inset-4 rounded-2xl border border-dashed border-slate-200 bg-white/70" />
            <div className="relative z-10 h-full w-full">
              <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,#e5e7eb_1px,transparent_0)] bg-[length:24px_24px] opacity-60" />
              <div className="relative z-10 flex h-full w-full items-center justify-center">
                <div className="relative h-full w-full max-w-5xl">
                  {pageItems.map((site, index) => {
                    const row = Math.floor(index / 4);
                    const col = index % 4;
                    const top = 12 + row * 22;
                    const left = 10 + col * 22;
                    return (
                      <button
                        key={site.id}
                        type="button"
                        style={{ top: `${top}%`, left: `${left}%` }}
                        className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white/90 px-2 py-1 text-xs shadow-sm backdrop-blur transition hover:shadow-md ${
                          selectedSiteOnMap?.id === site.id
                            ? "border-indigo-500 text-indigo-700"
                            : "border-slate-200 text-slate-700 hover:border-indigo-200"
                        }`}
                        onClick={() => setSelectedSiteOnMap(site)}
                      >
                        <span className="mr-1 inline-block h-2 w-2 rounded-full bg-indigo-500" />
                        {site.siteName || site.description || "Site"}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {selectedSiteOnMap && (
              <div className="pointer-events-auto absolute bottom-6 right-6 z-20 w-full max-w-sm rounded-2xl bg-white p-4 shadow-xl ring-1 ring-slate-200">
                <div className="mb-2 flex items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      {selectedSiteOnMap.siteName || selectedSiteOnMap.description || "Site"}
                    </div>
                    <div className="text-xs text-slate-500">
                      {selectedSiteOnMap.description}
                    </div>
                  </div>
                  <button
                    type="button"
                    className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                    onClick={() => setSelectedSiteOnMap(null)}
                  >
                    ✕
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
                  <div>
                    <div className="text-[11px] uppercase text-slate-400">Contact</div>
                    <div>{selectedSiteOnMap.contactPerson || "-"}</div>
                    <div className="text-slate-500">{selectedSiteOnMap.contactNumber || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-slate-400">Location</div>
                    <div>
                      {selectedSiteOnMap.city || "-"} {selectedSiteOnMap.pincode && `- ${selectedSiteOnMap.pincode}`}
                    </div>
                    <div className="text-slate-500">
                      Lat {selectedSiteOnMap.latitude ?? "-"}, Lng {selectedSiteOnMap.longitude ?? "-"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] uppercase text-slate-400">Radius</div>
                    <div>{selectedSiteOnMap.radius ?? "-"} m</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* View Site Details Modal */}
        {viewSite && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Site Details</h2>
                  <p className="text-xs text-slate-500">
                    Quick overview of this siteread only.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setViewSite(null)}
                  className="rounded-full bg-slate-50 px-2 py-1 text-xs text-slate-500 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 text-sm">
                {[ 
                  ["Site", viewSite.siteName],
                  ["Site ID", viewSite.siteId],
                  ["Address", viewSite.address],
                  ["Email", viewSite.email],
                  ["Description", viewSite.description],
                  ["Contact Person", viewSite.contactPerson],
                  ["Contact Number", viewSite.contactNumber],
                  ["Latitude", viewSite.latitude],
                  ["Longitude", viewSite.longitude],
                  ["City", viewSite.city],
                  ["Pincode", viewSite.pincode],
                ].map(([label, value]) => (
                  <div key={label} className="flex flex-col">
                    <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                      {label}
                    </span>
                    <span className="mt-1 rounded-md bg-slate-50 px-3 py-2 text-slate-800">
                      {value ?? "-"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Add Sites Modal */}
        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Add Sites</h2>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmitAdd} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  ["siteName", "Site"],
                  ["siteId", "Site ID"],
                  ["address", "Address"],
                  ["email", "Email"],
                  ["description", "Description"],
                  ["contactPerson", "Contact Person"],
                  ["contactNumber", "Contact Number"],
                  ["latitude", "Latitude"],
                  ["longitude", "Longitude"],
                  ["city", "City"],
                  ["pincode", "Pincode"],
                ].map(([name, label]) => (
                  <div key={name} className="flex flex-col">
                    <label className="text-xs font-medium text-slate-700">{label}</label>
                    <input
                      type="text"
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ))}
                <div className="col-span-full mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Sites Modal */}
        {isEditOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="w-full max-w-2xl rounded-2xl bg-white p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900">Edit Sites</h2>
                <button
                  type="button"
                  onClick={() => setIsEditOpen(false)}
                  className="text-slate-400 hover:text-slate-600"
                >
                  ✕
                </button>
              </div>
              <form onSubmit={handleSubmitEdit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {[
                  ["siteName", "Site"],
                  ["siteId", "Site ID"],
                  ["address", "Address"],
                  ["email", "Email"],
                  ["description", "Description"],
                  ["contactPerson", "Contact Person"],
                  ["contactNumber", "Contact Number"],
                  ["latitude", "Latitude"],
                  ["longitude", "Longitude"],
                  ["city", "City"],
                  ["pincode", "Pincode"],
                ].map(([name, label]) => (
                  <div key={name} className="flex flex-col">
                    <label className="text-xs font-medium text-slate-700">{label}</label>
                    <input
                      type="text"
                      name={name}
                      value={form[name]}
                      onChange={handleChange}
                      className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                ))}
                <div className="col-span-full mt-4 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEditOpen(false)}
                    className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
                  >
                    Save Changes
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        </div>
      </div>
    </DashboardLayout>
  );
}

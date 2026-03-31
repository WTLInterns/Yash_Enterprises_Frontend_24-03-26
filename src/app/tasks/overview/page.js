"use client";

import { useState, useEffect } from "react";
import { CheckCircle, AlertCircle, PlayCircle, Clock, Calendar, Building2 } from "lucide-react";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080";

const getCurrentUser = () => {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("user_data") || localStorage.getItem("user");
    const parsed = raw ? JSON.parse(raw) : null;
    return {
      role: (parsed?.roleName || parsed?.role || "USER").toUpperCase(),
      department: parsed?.departmentName || parsed?.department || null,
      id: parsed?.id || null,
    };
  } catch {
    return { role: "USER", department: null, id: null };
  }
};

const STATUS_CONFIG = {
  COMPLETED:  { label: "Completed",  color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200", icon: <CheckCircle className="h-4 w-4 text-emerald-600" /> },
  IN_PROGRESS:{ label: "In Progress",color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200",    icon: <PlayCircle  className="h-4 w-4 text-blue-600"    /> },
  DELAYED:    { label: "Delayed",    color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200",    icon: <AlertCircle className="h-4 w-4 text-rose-600"    /> },
  INQUIRY:    { label: "Inquiry",    color: "text-amber-700",   bg: "bg-amber-50",    border: "border-amber-200",   icon: <Clock       className="h-4 w-4 text-amber-600"   /> },
  CANCELLED:  { label: "Cancelled",  color: "text-slate-600",   bg: "bg-slate-50",    border: "border-slate-200",   icon: <AlertCircle className="h-4 w-4 text-slate-500"   /> },
};

function calcStats(tasks) {
  return {
    total:      tasks.length,
    completed:  tasks.filter(t => t.status === "COMPLETED").length,
    inProgress: tasks.filter(t => t.status === "IN_PROGRESS").length,
    delayed:    tasks.filter(t => t.status === "DELAYED").length,
    inquiry:    tasks.filter(t => t.status === "INQUIRY").length,
    cancelled:  tasks.filter(t => t.status === "CANCELLED").length,
  };
}

// Single department stats card
function DeptCard({ dept, tasks }) {
  const s = calcStats(tasks);
  const completionPct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-lg">
            <Building2 className="h-4 w-4 text-indigo-600" />
          </div>
          <span className="font-semibold text-slate-900">{dept}</span>
        </div>
        <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
          {s.total} tasks
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-slate-500 mb-1">
          <span>Completion</span>
          <span className="font-semibold text-slate-700">{completionPct}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-emerald-500 rounded-full transition-all"
            style={{ width: `${completionPct}%` }}
          />
        </div>
      </div>

      {/* Status grid */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { key: "completed",  val: s.completed,  ...STATUS_CONFIG.COMPLETED  },
          { key: "inProgress", val: s.inProgress, ...STATUS_CONFIG.IN_PROGRESS },
          { key: "delayed",    val: s.delayed,    ...STATUS_CONFIG.DELAYED    },
          { key: "cancelled",  val: s.cancelled,  ...STATUS_CONFIG.CANCELLED  },
        ].map(({ key, val, label, color, bg, border, icon }) => (
          <div key={key} className={`flex items-center gap-2 rounded-lg px-3 py-2 border ${bg} ${border}`}>
            {icon}
            <div>
              <div className={`text-sm font-bold ${color}`}>{val}</div>
              <div className="text-xs text-slate-500">{label}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Top summary bar (total across all shown tasks)
function SummaryBar({ tasks }) {
  const s = calcStats(tasks);
  const items = [
    { label: "Total",       val: s.total,      color: "text-slate-900",   bg: "bg-slate-50",    border: "border-slate-200" },
    { label: "Completed",   val: s.completed,  color: "text-emerald-700", bg: "bg-emerald-50",  border: "border-emerald-200" },
    { label: "In Progress", val: s.inProgress, color: "text-blue-700",    bg: "bg-blue-50",     border: "border-blue-200" },
    { label: "Delayed",     val: s.delayed,    color: "text-rose-700",    bg: "bg-rose-50",     border: "border-rose-200" },
    { label: "Cancelled",   val: s.cancelled,  color: "text-slate-600",   bg: "bg-slate-50",    border: "border-slate-200" },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
      {items.map(({ label, val, color, bg, border }) => (
        <div key={label} className={`rounded-xl border ${bg} ${border} p-4 text-center`}>
          <div className={`text-2xl font-bold ${color}`}>{val}</div>
          <div className="text-xs text-slate-500 mt-1">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function TasksOverviewPage() {
  const [tasks, setTasks]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [user, setUser]         = useState(null);
  const [departments, setDepts] = useState([]);

  useEffect(() => {
    const u = getCurrentUser();
    setUser(u);
    loadData(u);
  }, []);

  const loadData = async (u) => {
    if (!u) return;
    setLoading(true);
    try {
      // Fetch all tasks with auth headers
      const res = await fetch(`${API}/api/tasks`, {
        headers: {
          "X-User-Id":         String(u.id ?? ""),
          "X-User-Role":       u.role,
          "X-User-Department": u.department ?? "",
        },
      });
      const data = res.ok ? await res.json() : [];
      const list = Array.isArray(data) ? data : (data.content ?? []);
      setTasks(list);

      // Fetch department list for ADMIN/MANAGER
      if (u.role === "ADMIN" || u.role === "MANAGER") {
        const dr = await fetch(`${API}/api/stages/departments`);
        const depts = dr.ok ? await dr.json() : [];
        setDepts(depts || []);
      }
    } catch (e) {
      console.error("Failed to load overview data:", e);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin rounded-full h-8 w-8 border-4 border-slate-200 border-t-indigo-600" />
      </div>
    );
  }

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isTL = user?.role === "TL";

  // ── TL view: only their department ──────────────────────────────────────
  if (isTL) {
    const dept = user.department;
    const deptTasks = tasks.filter(t => t.department === dept);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks Overview</h1>
          <p className="text-sm text-slate-500 mt-1">
            Department: <span className="font-medium text-indigo-600">{dept || "—"}</span>
          </p>
        </div>
        <SummaryBar tasks={deptTasks} />
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Tasks — {dept}</h2>
          </div>
          {deptTasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No tasks found for {dept}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {deptTasks.slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, 20).map(task => {
                const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.INQUIRY;
                return (
                  <div key={task.id} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                    <div>
                      <p className="text-sm font-medium text-slate-900">{task.taskName || "—"}</p>
                      <p className="text-xs text-slate-500">{task.assignedToEmployeeName || "Unassigned"} · {task.clientName || "—"}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                      {cfg.icon}{cfg.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── ADMIN / MANAGER view: all departments ────────────────────────────────
  if (isAdminOrManager) {
    // Group tasks by department
    const tasksByDept = {};
    departments.forEach(d => { tasksByDept[d] = []; });
    tasks.forEach(t => {
      const d = t.department;
      if (d) {
        if (!tasksByDept[d]) tasksByDept[d] = [];
        tasksByDept[d].push(t);
      }
    });

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Tasks Overview</h1>
          <p className="text-sm text-slate-500 mt-1">All departments · {tasks.length} total tasks</p>
        </div>

        {/* Overall summary */}
        <SummaryBar tasks={tasks} />

        {/* Per-department cards */}
        <div>
          <h2 className="text-base font-semibold text-slate-700 mb-3">By Department</h2>
          {departments.length === 0 ? (
            <p className="text-sm text-slate-400">No departments found.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {departments.map(dept => (
                <DeptCard key={dept} dept={dept} tasks={tasksByDept[dept] ?? []} />
              ))}
            </div>
          )}
        </div>

        {/* Recent tasks table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="font-semibold text-slate-900">Recent Tasks (All Departments)</h2>
          </div>
          {tasks.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No tasks found</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-100">
                <thead className="bg-slate-50">
                  <tr>
                    {["Task Name", "Department", "Assigned To", "Client", "Status"].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {tasks.slice().sort((a, b) => (b.id ?? 0) - (a.id ?? 0)).slice(0, 30).map(task => {
                    const cfg = STATUS_CONFIG[task.status] ?? STATUS_CONFIG.INQUIRY;
                    return (
                      <tr key={task.id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 text-sm font-medium text-slate-900 whitespace-nowrap">{task.taskName || "—"}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className="inline-flex px-2 py-0.5 text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">{task.department || "—"}</span>
                        </td>
                        <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">{task.assignedToEmployeeName || "Unassigned"}</td>
                        <td className="px-5 py-3 text-sm text-slate-600 whitespace-nowrap">{task.clientName || "—"}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
                            {cfg.icon}{cfg.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Fallback (EMPLOYEE) ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-900">Tasks Overview</h1>
      <SummaryBar tasks={tasks} />
    </div>
  );
}

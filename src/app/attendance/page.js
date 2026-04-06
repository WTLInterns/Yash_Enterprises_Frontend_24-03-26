"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { backendApi } from "@/services/api";

// For now, use a fixed employeeId (e.g. 1). Later this can come from auth/user context.
// ✅ FIXED: Use dynamic user ID from localStorage
const EMPLOYEE_ID = (() => {
  if (typeof window !== "undefined") {
    const userData = JSON.parse(localStorage.getItem("user_data") || "{}");
    return userData.id || 1;
  }
  return 1;
})();

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function formatDateStr(d) {
  return dayjs(d).format("YYYY-MM-DD");
}

function getEmployeeDisplayName(emp) {
  if (!emp) return "";
  const fullName = (emp.fullName || "").trim();
  if (fullName) return fullName;

  const firstName = (emp.firstName || "").trim();
  const lastName = (emp.lastName || "").trim();
  const name = `${firstName} ${lastName}`.trim();
  if (name) return name;

  const fallback = (emp.name || emp.employeeId || emp.email || "").toString().trim();
  return fallback;
}

function getStatusStyle(status) {
  const s = (status || "").toString().toUpperCase();
  if (s === "PRESENT") return { bg: "bg-green-100", text: "text-green-800", dot: "bg-green-600" };
  if (s === "ABSENT") return { bg: "bg-red-100", text: "text-red-800", dot: "bg-red-600" };
  if (s === "HALF_DAY") return { bg: "bg-yellow-100", text: "text-yellow-900", dot: "bg-yellow-500" };
  if (s === "HOLIDAY") return { bg: "bg-blue-100", text: "text-blue-800", dot: "bg-blue-600" };
  if (s === "WEEKLY_OFF") return { bg: "bg-slate-200", text: "text-slate-700", dot: "bg-slate-600" };
  if (s === "ON_LEAVE") return { bg: "bg-purple-100", text: "text-purple-800", dot: "bg-purple-600" };
  if (s === "PENDING") return { bg: "bg-orange-100", text: "text-orange-800", dot: "bg-orange-600" };
  return { bg: "bg-white", text: "text-slate-700", dot: "bg-slate-300" };
}

export default function AttendancePage() {
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [employees, setEmployees] = useState([]);
  const [searchText, setSearchText] = useState("");
  const [showEmployeeDropdown, setShowEmployeeDropdown] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);

  const [selectedMonth, setSelectedMonth] = useState(() => dayjs());
  const [monthRecords, setMonthRecords] = useState([]);
  const [attendanceMap, setAttendanceMap] = useState({});
  const [monthRecordsByDate, setMonthRecordsByDate] = useState({});

  const [selectedDateStr, setSelectedDateStr] = useState(null);

  // Date range: last 7 days
  const today = new Date();
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);

  const from = formatDate(sevenDaysAgo);
  const to = formatDate(today);

  async function loadEmployees() {
    try {
      const data = await backendApi.get("/employees");
      setEmployees(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load employees", err);
    }
  }

  async function loadAttendance(employeeId) {
    try {
      setLoading(true);
      setError("");
      const data = await backendApi.get(`/attendance/${employeeId}?from=${from}&to=${to}`);
      setRecords(data || []);
    } catch (err) {
      console.error("Failed to load attendance", err);
      setError("Failed to load attendance records.");
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthAttendance(employeeId, month) {
    try {
      setLoading(true);
      setError("");
      const monthStart = dayjs(month).startOf("month").format("YYYY-MM-DD");
      const monthEnd = dayjs(month).endOf("month").format("YYYY-MM-DD");

      const data = await backendApi.get(`/attendance/${employeeId}?from=${monthStart}&to=${monthEnd}`);
      const list = Array.isArray(data) ? data : [];
      setMonthRecords(list);

      const byDate = {};
      const map = {};
      for (const r of list) {
        if (!r?.date) continue;
        const dateKey = r.date;
        byDate[dateKey] = r;
        map[dateKey] = (r.status || "").toString();
      }
      setMonthRecordsByDate(byDate);
      setAttendanceMap(map);
    } catch (err) {
      console.error("Failed to load month attendance", err);
      setError("Failed to load attendance records.");
      setMonthRecords([]);
      setMonthRecordsByDate({});
      setAttendanceMap({});
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    loadAttendance(selectedEmployeeId);
    loadMonthAttendance(selectedEmployeeId, selectedMonth);
    setSelectedDateStr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId]);

  useEffect(() => {
    if (!selectedEmployeeId) return;
    loadMonthAttendance(selectedEmployeeId, selectedMonth);
    setSelectedDateStr(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth]);

  async function punch(status) {
    try {
      setError("");
      const now = new Date().toISOString();

      const payload = {
        employeeId: EMPLOYEE_ID,
        date: formatDate(new Date()),
        status,
        // Use punchInTime or punchOutTime based on status
        punchInTime: status === "IN" ? now : null,
        punchOutTime: status === "OUT" ? now : null,
      };

      await backendApi.post("/attendance/punch-in", payload);
      if (selectedEmployeeId) {
        await loadAttendance(selectedEmployeeId);
        await loadMonthAttendance(selectedEmployeeId, selectedMonth);
      }
    } catch (err) {
      console.error("Failed to punch", err);
      setError("Failed to punch. Please try again.");
    }
  }

  const selectedEmployee = employees.find((e) => e?.id === selectedEmployeeId) || null;
  const selectedEmployeeName = selectedEmployee
    ? getEmployeeDisplayName(selectedEmployee)
    : selectedEmployeeId
      ? `#${selectedEmployeeId}`
      : "(no employee selected)";

  const filteredEmployees = employees
    .map((e) => ({ ...e, _display: getEmployeeDisplayName(e) }))
    .filter((e) => {
      if (!searchText.trim()) return true;
      const q = searchText.trim().toLowerCase();
      return (
        (e._display || "").toLowerCase().includes(q) ||
        (e.email || "").toString().toLowerCase().includes(q) ||
        (e.employeeId || "").toString().toLowerCase().includes(q)
      );
    })
    .slice(0, 25);

  const monthLabel = selectedMonth.format("MMMM YYYY");

  const monthStart = selectedMonth.startOf("month");
  const gridStart = monthStart.startOf("week");
  const days = Array.from({ length: 42 }, (_, i) => gridStart.add(i, "day"));

  function getEffectiveStatus(dateObj) {
    const dateKey = dateObj.format("YYYY-MM-DD");
    const inMonth = dateObj.month() === selectedMonth.month();
    if (!inMonth) return null;
    if (!selectedEmployeeId) return null;
    if (attendanceMap[dateKey]) return attendanceMap[dateKey];

    const isFuture = dateObj.isAfter(dayjs(), "day");
    if (isFuture) return null;
    return "ABSENT";
  }

  function handleSelectEmployee(emp) {
    if (!emp?.id) return;
    setSelectedEmployeeId(emp.id);
    setSearchText(getEmployeeDisplayName(emp));
    setShowEmployeeDropdown(false);
  }

  function handleDateClick(dateObj) {
    if (!selectedEmployeeId) return;
    const dateKey = dateObj.format("YYYY-MM-DD");
    if (dateObj.month() !== selectedMonth.month()) {
      setSelectedMonth(dateObj);
    }
    setSelectedDateStr(dateKey);
  }

  const selectedDayRecord = selectedDateStr ? monthRecordsByDate[selectedDateStr] : null;
  const selectedDayStatus = selectedDateStr ? (attendanceMap[selectedDateStr] || getEffectiveStatus(dayjs(selectedDateStr))) : null;

  return (
    <DashboardLayout
      header={{
        project: "Attendance",
        user: { name: "Admin User", role: "Administrator" },
        notifications: [],
      }}
    >
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-slate-900">Employee Attendance</h1>
            {/* <p className="mt-1 text-xs text-slate-500">
              Showing records for {selectedEmployeeName} from {from} to {to}.
            </p> */}
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => punch("IN")}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Punch In
            </button>
            <button
              onClick={() => punch("OUT")}
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
            >
              Punch Out
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="w-full md:max-w-xl">
              <label className="block text-xs font-medium text-slate-600">Search employee</label>
              <div className="relative mt-1">
                <input
                  value={searchText}
                  onChange={(e) => {
                    setSearchText(e.target.value);
                    setShowEmployeeDropdown(true);
                  }}
                  onFocus={() => setShowEmployeeDropdown(true)}
                  placeholder="Type a name (e.g. Arun)"
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm outline-none focus:border-slate-300"
                />
                {showEmployeeDropdown && filteredEmployees.length > 0 && (
                  <div className="absolute z-20 mt-2 max-h-72 w-full overflow-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {filteredEmployees.map((emp) => (
                      <button
                        key={emp.id}
                        type="button"
                        onClick={() => handleSelectEmployee(emp)}
                        className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                          emp.id === selectedEmployeeId ? "bg-slate-50" : ""
                        }`}
                      >
                        <span className="truncate text-slate-900">{emp._display || `Employee #${emp.id}`}</span>
                        <span className="shrink-0 text-xs text-slate-500">#{emp.id}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {!selectedEmployeeId && (
                <div className="mt-2 text-sm text-slate-600">Please select an employee to view attendance.</div>
              )}
            </div>

            <div className="flex w-full flex-col gap-2 md:w-auto md:items-end">
              <div className="text-xs font-medium text-slate-600">Month</div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMonth((m) => dayjs(m).subtract(1, "month"))}
                  disabled={!selectedEmployeeId}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Prev
                </button>
                <div className="min-w-[150px] text-center text-sm font-semibold text-slate-900">{monthLabel}</div>
                <button
                  type="button"
                  onClick={() => setSelectedMonth((m) => dayjs(m).add(1, "month"))}
                  disabled={!selectedEmployeeId}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Next
                </button>
              </div>
              {selectedEmployeeId && selectedEmployeeId !== EMPLOYEE_ID && (
                <div className="text-xs text-slate-500">
                  Punch buttons still apply to your own account (employee #{EMPLOYEE_ID}).
                </div>
              )}
            </div>
          </div>

          <div className={`relative mt-5 ${!selectedEmployeeId ? "opacity-60" : ""}`}>
            {!selectedEmployeeId && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-xl">
                <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                  Please select an employee to view attendance
                </div>
              </div>
            )}

            <div className="grid grid-cols-7 gap-2">
            {[
              "Sun",
              "Mon",
              "Tue",
              "Wed",
              "Thu",
              "Fri",
              "Sat",
            ].map((d) => (
              <div key={d} className="px-2 text-xs font-medium text-slate-500">
                {d}
              </div>
            ))}

            {days.map((d) => {
              const inMonth = d.month() === selectedMonth.month();
              const dateKey = d.format("YYYY-MM-DD");
              const effectiveStatus = getEffectiveStatus(d);
              const style = getStatusStyle(effectiveStatus);
              const isSelected = selectedDateStr === dateKey;
              return (
                <button
                  key={dateKey}
                  type="button"
                  onClick={() => handleDateClick(d)}
                  disabled={!selectedEmployeeId}
                  className={`group relative flex h-16 flex-col rounded-xl border px-2 py-2 text-left shadow-sm transition ${
                    inMonth ? "border-slate-200" : "border-slate-100"
                  } ${inMonth ? style.bg : "bg-slate-50"} ${isSelected ? "ring-2 ring-slate-400" : ""}`}
                >
                  <div className={`flex items-center justify-between ${inMonth ? "" : "opacity-50"}`}>
                    <span className={`text-sm font-semibold ${inMonth ? "text-slate-900" : "text-slate-500"}`}>
                      {d.date()}
                    </span>
                    {effectiveStatus ? (
                      <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-transparent" />
                    )}
                  </div>
                  <div className={`mt-1 line-clamp-1 text-[11px] font-medium ${style.text}`}>
                    {effectiveStatus ? effectiveStatus : ""}
                  </div>
                </button>
              );
            })}
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Selected date</div>
            {!selectedEmployeeId ? (
              <div className="mt-1 text-sm text-slate-600">Select an employee to enable date details.</div>
            ) : !selectedDateStr ? (
              <div className="mt-1 text-sm text-slate-600">Click any date to view details.</div>
            ) : (
              <div className="mt-2 grid grid-cols-1 gap-3 md:grid-cols-3">
                <div>
                  <div className="text-xs font-medium text-slate-500">Date</div>
                  <div className="text-sm text-slate-900">{selectedDateStr}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Status</div>
                  <div className="text-sm text-slate-900">{selectedDayStatus || "-"}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-slate-500">Punch</div>
                  <div className="text-sm text-slate-900">
                    {selectedDayRecord?.punchInTime ? new Date(selectedDayRecord.punchInTime).toLocaleTimeString() : "-"}
                    {" "}→{" "}
                    {selectedDayRecord?.punchOutTime ? new Date(selectedDayRecord.punchOutTime).toLocaleTimeString() : "-"}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {error && <div className="text-sm text-red-600">{error}</div>}

        {/* <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-slate-900">Recent Attendance</h2>
          </div>

          {!selectedEmployeeId ? (
            <div className="py-6 text-sm text-slate-500">Please select an employee to view attendance.</div>
          ) : loading ? (
            <div className="py-6 text-sm text-slate-500">Loading...</div>
          ) : records.length === 0 ? (
            <div className="py-6 text-sm text-slate-500">No attendance records for this period.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200 text-sm">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Date</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Punch In</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Punch Out</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Status</th>
                    <th className="px-4 py-2 text-left font-medium text-slate-500">Note</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {records.map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50">
                      <td className="px-4 py-2 text-slate-700">
                        {r.date}
                      </td>
                      <td className="px-4 py-2 text-slate-700 text-xs">
                        {r.punchInTime ? new Date(r.punchInTime).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-slate-700 text-xs">
                        {r.punchOutTime ? new Date(r.punchOutTime).toLocaleString() : "-"}
                      </td>
                      <td className="px-4 py-2 text-slate-700">
                        {r.status || "-"}
                      </td>
                      <td className="px-4 py-2 text-slate-400 text-xs max-w-[200px] truncate">
                        {r.note || ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div> */}
      </div>
    </DashboardLayout>
  );
}
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "react-toastify";
import { backendApi } from "@/services/api";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // If already logged in, redirect
    try {
      const raw = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");
      if (raw) {
        const u = JSON.parse(raw);
        if (u?.id && u?.role) { router.replace("/dashboard"); return; }
      }
    } catch {}
  }, [router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email)        { toast.error("Email is required"); return; }
    if (!email.includes("@")) { toast.error("Enter a valid email"); return; }
    if (!password)     { toast.error("Password is required"); return; }
    if (!organization) { toast.error("Organization is required"); return; }

    setLoading(true);
    try {
      const data = await backendApi.post("/auth/login", {
        email: email.trim(),
        password,
        organization: organization.trim(),
      });

      if (data?.role && data?.user) {
        const userDepartment = data.user?.departmentName || data.user?.department || null;

        const userData = {
          id:             data.user?.id || data.employeeId,
          name:           data.user?.fullName || data.user?.firstName || "User",
          fullName:       data.user?.fullName || data.user?.firstName,
          firstName:      data.user?.firstName,
          lastName:       data.user?.lastName,
          email:          data.user?.email,
          role:           data.role,
          roleName:       data.role,
          department:     userDepartment,
          departmentName: userDepartment,
          employeeId:     data.employeeId,
        };

        // Store in both sessionStorage and localStorage
        const json = JSON.stringify(userData);
        sessionStorage.setItem("user_data", json);
        sessionStorage.setItem("user_role", data.role);
        localStorage.setItem("user_data", json);
        localStorage.setItem("user_role", data.role);

        toast.success(`Welcome ${userData.fullName || userData.name}!`);
        router.replace("/dashboard");
      } else {
        toast.error(data?.error || data?.message || "Login failed");
      }
    } catch (error) {
      const msg = error?.message || "";
      if (msg.includes("Failed to fetch") || msg.includes("Network"))
        toast.error("Network error. Check your connection.");
      else if (msg.includes("400") || msg.includes("Invalid"))
        toast.error("Invalid email or password.");
      else
        toast.error("Login failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-white rounded-2xl shadow-lg mb-4">
            <div className="text-2xl font-bold text-slate-800">Y</div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Welcome Back</h1>
          <p className="text-slate-400 text-lg">Attendance Management System</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-slate-800/90 rounded-3xl shadow-2xl p-8 border border-slate-600 space-y-6">
          {/* Organization */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Organization</label>
            <select
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={organization}
              onChange={e => setOrganization(e.target.value)}
            >
              <option value="" disabled className="text-slate-400 bg-slate-800">Select organization</option>
              <option value="Yash Enterprises" className="bg-slate-800 text-white">Yash Enterprises</option>
            </select>
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
            <input
              type="email"
              placeholder="Enter your email"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={email}
              onChange={e => setEmail(e.target.value)}
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
            <input
              type="password"
              placeholder="Enter your password"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-4 text-white placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={password}
              onChange={e => setPassword(e.target.value)}
            />
          </div>

          <button
            disabled={loading}
            className="w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl py-4 font-semibold text-lg hover:from-blue-700 hover:to-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Signing in...
              </span>
            ) : "Sign In"}
          </button>

          <div className="text-center">
            <p className="text-slate-400 text-sm">
              Need help?{" "}
              <button type="button" className="text-blue-400 hover:text-blue-300 font-medium">Contact Support</button>
            </p>
          </div>
        </form>

        <div className="mt-8 text-center">
          <p className="text-slate-500 text-sm">© 2024 Yash Enterprises. All rights reserved.</p>
        </div>
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Building2, X, UserPlus, Trash, User } from "lucide-react";
import { backendApi } from "@/services/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";
import { toast } from "react-toastify";
import Link from "next/link";

const EMPTY_CONTACT = { fullName: "", email: "", position: "" };

export default function BanksPage() {
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();

  const [banks, setBanks] = useState([]);
  const [bankContacts, setBankContacts] = useState({});
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [selectedBank, setSelectedBank] = useState(null);
  const [form, setForm] = useState({ name: "", branch: "", website: "", address: "", district: "", taluka: "", pinCode: "" });
  const [contacts, setContacts] = useState([{ ...EMPTY_CONTACT }]);
  const [selectedBankIds, setSelectedBankIds] = useState([]);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // Max contact columns to show in table (dynamic)
  const maxContacts = Math.max(1, ...Object.values(bankContacts).map(c => c.length));

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/banks?size=9999");
      const list = Array.isArray(res) ? res : (res?.content || []);
      setBanks(list);

      // Fetch contacts for all banks in parallel
      const contactEntries = await Promise.all(
        list.map(async b => {
          const c = await backendApi.get(`/banks/${b.id}/contacts`).catch(() => []);
          return [b.id, Array.isArray(c) ? c : []];
        })
      );
      setBankContacts(Object.fromEntries(contactEntries));
    } catch (err) {
      console.error("Failed to fetch banks:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchBanks(); }, []);

  const filtered = banks.filter(b =>
    (b.name || "").toLowerCase().includes(search.toLowerCase()) ||
    (b.branchName || "").toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setSelectedBank(null);
    setForm({ name: "", branch: "", website: "", address: "", district: "", taluka: "", pinCode: "" });
    setContacts([{ ...EMPTY_CONTACT }]);
    setShowModal(true);
  };

  const openEdit = async (bank) => {
    try {
      const fresh = await backendApi.get(`/banks/${bank.id}`);
      const existing = await backendApi.get(`/banks/${bank.id}/contacts`).catch(() => []);
      setSelectedBank(fresh);
      setForm({ name: fresh.name || "", branch: fresh.branchName || "", website: fresh.website || "", address: fresh.address || "", district: fresh.district || "", taluka: fresh.taluka || "", pinCode: fresh.pinCode || "" });
      setContacts(existing.length > 0 ? existing.map(c => ({ id: c.id, fullName: c.fullName || "", email: c.email || "", position: c.position || "" })) : [{ ...EMPTY_CONTACT }]);
      setShowModal(true);
    } catch { toast.error("Failed to load bank"); }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error("Bank name is required"); return; }
    try {
      const payload = { name: form.name, branchName: form.branch, website: form.website, address: form.address, district: form.district, taluka: form.taluka, pinCode: form.pinCode, active: true };
      let bankId;
      if (selectedBank) {
        await backendApi.put(`/banks/${selectedBank.id}`, payload);
        bankId = selectedBank.id;
        toast.success("Bank updated");
      } else {
        const created = await backendApi.post("/banks", payload);
        bankId = created.id;
        toast.success("Bank created");
      }
      // Sync contacts
      if (selectedBank) {
        const existing = await backendApi.get(`/banks/${bankId}/contacts`).catch(() => []);
        await Promise.all(existing.map(c => backendApi.delete(`/banks/${bankId}/contacts/${c.id}`).catch(() => {})));
      }
      await Promise.all(contacts.filter(c => c.fullName?.trim()).map(c =>
        backendApi.post(`/banks/${bankId}/contacts`, { fullName: c.fullName, email: c.email, position: c.position })
      ));
      setShowModal(false);
      fetchBanks();
    } catch (err) { toast.error("Failed to save: " + (err?.message || "Unknown error")); }
  };

  const handleBulkDelete = async () => {
    if (selectedBankIds.length === 0) return;
    if (!confirm(`Delete ${selectedBankIds.length} selected bank(s)? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(selectedBankIds.map(id => backendApi.delete(`/banks/${id}`).catch(() => {})));
      toast.success(`${selectedBankIds.length} bank(s) deleted`);
      setSelectedBankIds([]);
      fetchBanks();
    } catch (err) {
      toast.error("Bulk delete failed");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this bank?")) return;
    try {
      await backendApi.delete(`/banks/${id}`);
      setBanks(prev => prev.filter(b => b.id !== id));
      toast.success("Bank deleted");
    } catch { toast.error("Failed to delete bank"); }
  };

  const addContact = () => setContacts(prev => [...prev, { ...EMPTY_CONTACT }]);
  const removeContact = (i) => setContacts(prev => prev.filter((_, idx) => idx !== i));
  const updateContact = (i, field, value) => setContacts(prev => prev.map((c, idx) => idx === i ? { ...c, [field]: value } : c));

  // Contact column headers: "Contact Person 1", "Contact Person 2", ...
  const contactColCount = Math.max(1, maxContacts);

  return (
    <DashboardLayout header={{ project: "Banks", user: { name: userName, role: userRole }, notifications: [] }}>
      <div className="flex flex-col h-[calc(100vh-80px)] overflow-hidden">

        {/* Header */}
        <div className="sticky top-0 z-20 bg-white pb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Banks</div>
            <p className="text-sm text-slate-500">{banks.length} bank branch{banks.length !== 1 ? "es" : ""}</p>
          </div>
          <div className="flex items-center gap-2">
            {selectedBankIds.length > 0 && (
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50">
                <Trash2 className="h-4 w-4" />
                {bulkDeleting ? "Deleting..." : `Delete ${selectedBankIds.length} Selected`}
              </button>
            )}
            <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm">
              <Plus className="h-4 w-4" /> Add Bank
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="sticky top-[60px] z-20 bg-white py-2 mb-2">
          <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 w-96 bg-white shadow-sm">
            <Search size={16} className="text-slate-400 shrink-0" />
            <input type="text" placeholder="Search bank or branch..." value={search} onChange={e => setSearch(e.target.value)} className="flex-1 outline-none text-sm bg-transparent" />
            {search && <button onClick={() => setSearch("")}><X className="h-3.5 w-3.5 text-slate-400" /></button>}
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-auto h-full">
            {loading ? (
              <div className="flex items-center justify-center h-32 text-slate-400 text-sm">Loading banks...</div>
            ) : (
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50" style={{ position: "sticky", top: 0, zIndex: 10 }}>
                  <tr>
                    {/* Checkbox */}
                    <th className="px-3 py-3" style={{ position: "sticky", left: 0, background: "rgb(248 250 252)", zIndex: 20, width: 40 }}>
                      <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                        checked={filtered.length > 0 && filtered.every(b => selectedBankIds.includes(b.id))}
                        onChange={e => e.target.checked ? setSelectedBankIds(filtered.map(b => b.id)) : setSelectedBankIds([])}
                      />
                    </th>
                    {/* ID */}
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                      style={{ position: "sticky", left: 40, background: "rgb(248 250 252)", zIndex: 20, minWidth: 80 }}>
                      ID
                    </th>
                    {/* Frozen: Branch */}
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                      style={{ position: "sticky", left: 120, background: "rgb(248 250 252)", zIndex: 20, borderRight: "1px solid #e2e8f0", minWidth: 160 }}>
                      Branch Name
                    </th>
                    {/* Frozen: Bank */}
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                      style={{ position: "sticky", left: 280, background: "rgb(248 250 252)", zIndex: 20, borderRight: "1px solid #e2e8f0", minWidth: 160 }}>
                      Bank Name
                    </th>
                    {Array.from({ length: contactColCount }, (_, i) => (
                      <th key={i} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                        Contact Person {i + 1}
                      </th>
                    ))}
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Owner</th>
                    <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Created</th>
                    <th className="px-5 py-3 text-center text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filtered.map(bank => {
                    const bContacts = bankContacts[bank.id] || [];
                    return (
                      <tr key={bank.id} className="hover:bg-slate-50 transition-colors">
                        {/* Checkbox */}
                        <td className="px-3 py-3" style={{ position: "sticky", left: 0, background: "white", zIndex: 5, width: 40 }}>
                          <input type="checkbox" className="h-4 w-4 rounded border-gray-300"
                            checked={selectedBankIds.includes(bank.id)}
                            onChange={e => e.target.checked
                              ? setSelectedBankIds(prev => [...prev, bank.id])
                              : setSelectedBankIds(prev => prev.filter(id => id !== bank.id))}
                          />
                        </td>
                        {/* ID */}
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-500"
                          style={{ position: "sticky", left: 40, background: "white", zIndex: 5, minWidth: 80 }}>
                          {bank.id}
                        </td>
                        {/* Frozen Branch */}
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium"
                          style={{ position: "sticky", left: 120, background: "white", zIndex: 5, borderRight: "1px solid #e2e8f0" }}>
                          <Link href={`/banks/${bank.id}`} className="flex items-center gap-1.5 text-indigo-600 hover:text-indigo-800 hover:underline">
                            <Building2 className="h-3.5 w-3.5 shrink-0" />
                            <span>{bank.branchName || "—"}</span>
                          </Link>
                        </td>
                        {/* Frozen Bank */}
                        <td className="px-5 py-3 whitespace-nowrap text-sm font-medium"
                          style={{ position: "sticky", left: 280, background: "white", zIndex: 5, borderRight: "1px solid #e2e8f0" }}>
                          <Link href={`/banks/${bank.id}`} className="text-indigo-600 hover:text-indigo-800 hover:underline">
                            {bank.name || "—"}
                          </Link>
                        </td>
                        {/* Dynamic contact cells */}
                        {Array.from({ length: contactColCount }, (_, i) => {
                          const c = bContacts[i];
                          return (
                            <td key={i} className="px-5 py-3 whitespace-nowrap text-sm text-slate-600">
                              {c ? (
                                <div className="flex items-center gap-1.5">
                                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo-100 shrink-0">
                                    <User className="h-3 w-3 text-indigo-600" />
                                  </div>
                                  <div>
                                    <div className="font-medium text-slate-800 text-xs">{c.fullName}</div>
                                    {c.position && <div className="text-xs text-slate-400">{c.position}</div>}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-600">{bank.ownerName || "—"}</td>
                        <td className="px-5 py-3 whitespace-nowrap text-sm text-slate-500">
                          {bank.createdAt ? new Date(bank.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                        </td>
                        <td className="px-5 py-3 whitespace-nowrap text-center">
                          <div className="flex items-center justify-center gap-2">
                            <button onClick={() => openEdit(bank)} className="p-1.5 rounded-md text-blue-600 hover:bg-blue-50" title="Edit"><Edit2 className="h-3.5 w-3.5" /></button>
                            <button onClick={() => handleDelete(bank.id)} className="p-1.5 rounded-md text-red-500 hover:bg-red-50" title="Delete"><Trash2 className="h-3.5 w-3.5" /></button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {!filtered.length && (
                    <tr><td colSpan={7 + contactColCount} className="px-6 py-12 text-center text-sm text-slate-400">No banks found</td></tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Modal */}
        {showModal && (
          <>
            <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowModal(false)} />
            <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
              <div className="relative w-full max-w-2xl h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 shrink-0 bg-gradient-to-r from-indigo-50 to-white">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">{selectedBank ? "Edit Bank" : "Add Bank"}</h2>
                    <p className="text-sm text-slate-500 mt-0.5">{selectedBank ? "Update bank branch information" : "Add a new bank branch to the system"}</p>
                  </div>
                  <button onClick={() => setShowModal(false)} className="rounded-full p-2 text-slate-400 hover:bg-white hover:shadow-sm"><X className="h-5 w-5" /></button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Bank Name <span className="text-rose-500">*</span></label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="e.g. State Bank of India" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Branch Name</label>
                      <input type="text" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                        placeholder="e.g. Main Branch" />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    {[["Taluka", "taluka", "Taluka"], ["District", "district", "District"], ["Pin Code", "pinCode", "Pin Code"]].map(([label, key, ph]) => (
                      <div key={key}>
                        <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">{label}</label>
                        <input type="text" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" placeholder={ph} />
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Address</label>
                      <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none resize-none" placeholder="Full address" />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1.5 uppercase tracking-wide">Website</label>
                      <input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                        className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm focus:border-indigo-500 focus:outline-none" placeholder="https://..." />
                    </div>
                  </div>

                  {/* Contact Persons */}
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
                        Contact Persons <span className="ml-1 text-indigo-600 font-bold">({contacts.length})</span>
                      </span>
                      <button onClick={addContact} className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md px-2.5 py-1 transition-colors">
                        <UserPlus className="h-3 w-3" /> Add Person
                      </button>
                    </div>
                    <div className="divide-y divide-slate-100">
                      {contacts.map((c, i) => (
                        <div key={i} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 shrink-0 text-xs font-bold text-indigo-600">{i + 1}</div>
                          <div className="grid grid-cols-3 gap-3 flex-1">
                            <input type="text" value={c.fullName} onChange={e => updateContact(i, "fullName", e.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Full name" />
                            <input type="email" value={c.email} onChange={e => updateContact(i, "email", e.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Email" />
                            <input type="text" value={c.position} onChange={e => updateContact(i, "position", e.target.value)}
                              className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none" placeholder="Position" />
                          </div>
                          {contacts.length > 1 && (
                            <button onClick={() => removeContact(i)} className="p-1.5 rounded-md text-red-400 hover:bg-red-50 shrink-0"><Trash className="h-4 w-4" /></button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 px-6 py-4 shrink-0 flex justify-end gap-3 bg-slate-50">
                  <button onClick={() => setShowModal(false)} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                  <button onClick={handleSave} className="rounded-lg bg-indigo-600 px-5 py-2 text-sm font-medium text-white hover:bg-indigo-700 shadow-sm">{selectedBank ? "Update Bank" : "Create Bank"}</button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

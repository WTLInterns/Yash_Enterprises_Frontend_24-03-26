"use client";

import { useState, useEffect } from "react";
import { Plus, Search, Edit2, Trash2, Building2, X, UserPlus, Trash, User, Upload } from "lucide-react";
import { backendApi } from "@/services/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";
import { toast } from "react-toastify";
import Link from "next/link";
import BankExcelUploadModal from "@/components/excel/BankExcelUploadModal";

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
  const [showExcelModal, setShowExcelModal] = useState(false);

  const normalizeList = (res) => {
    if (Array.isArray(res)) return res;
    if (res?.content && Array.isArray(res.content)) return res.content;
    return [];
  };

  const fetchBanks = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/banks?size=9999");
      const list = normalizeList(res);
      setBanks(list);
      const contactEntries = await Promise.all(
        list.map(async b => {
          const c = await backendApi.get(`/banks/${b.id}/contacts`).catch(() => []);
          return [b.id, normalizeList(c)];
        })
      );
      setBankContacts(Object.fromEntries(contactEntries));
    } catch (err) {
      console.error("Failed to fetch banks:", err);
      toast.error("Failed to load banks");
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
      setForm({
        name: fresh.name || "",
        branch: fresh.branchName || "",
        website: fresh.website || "",
        address: fresh.address || "",
        district: fresh.district || "",
        taluka: fresh.taluka || "",
        pinCode: fresh.pinCode || ""
      });
      const existingArr = normalizeList(existing);
      setContacts(existingArr.length > 0
        ? existingArr.map(c => ({ id: c.id, fullName: c.fullName || "", email: c.email || "", position: c.position || "" }))
        : [{ ...EMPTY_CONTACT }]);
      setShowModal(true);
    } catch { toast.error("Failed to load bank"); }
  };

  const handleSave = async () => {
    if (!form.name?.trim()) { toast.error("Bank name is required"); return; }
    // Case-insensitive duplicate check
    const normalizedInput = form.name.trim().toLowerCase();
    const duplicate = banks.find(b =>
      b.name?.trim().toLowerCase() === normalizedInput &&
      (!selectedBank || b.id !== selectedBank.id)
    );
    if (duplicate) { toast.error(`Bank "${duplicate.name}" already exists`); return; }
    try {
      const payload = {
        name: form.name.trim(), branchName: form.branch, website: form.website,
        address: form.address, district: form.district, taluka: form.taluka,
        pinCode: form.pinCode, active: true, isActive: true
      };
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
      if (selectedBank) {
        const existing = await backendApi.get(`/banks/${bankId}/contacts`).catch(() => []);
        const existingContacts = normalizeList(existing);
        await Promise.all(existingContacts.map(c => backendApi.delete(`/banks/${bankId}/contacts/${c.id}`).catch(() => {})));
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
    if (!confirm(`Delete ${selectedBankIds.length} selected bank(s)?`)) return;
    setBulkDeleting(true);
    try {
      await Promise.all(selectedBankIds.map(id => backendApi.delete(`/banks/${id}`).catch(() => {})));
      toast.success(`${selectedBankIds.length} bank(s) deleted`);
      setSelectedBankIds([]);
      fetchBanks();
    } catch { toast.error("Bulk delete failed"); }
    finally { setBulkDeleting(false); }
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

  const fmtDate = (val) => val ? new Date(val).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—";

  // ── Frozen column style helpers ──────────────────────────────────────────
  // borderCollapse:separate is REQUIRED for position:sticky to work on td/th
  const FROZEN_BG_HEAD = "#f8fafc";
  const FROZEN_BG_BODY = "#ffffff";

  const thFrozen = (left, width, borderRight = false) => ({
    position: "sticky",
    left,
    zIndex: 3,
    background: FROZEN_BG_HEAD,
    width,
    minWidth: width,
    padding: "10px 16px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#64748b",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #e2e8f0",
    ...(borderRight ? { borderRight: "2px solid #e2e8f0" } : {}),
  });

  const tdFrozen = (left, width, bg = FROZEN_BG_BODY, borderRight = false) => ({
    position: "sticky",
    left,
    zIndex: 2,
    background: bg,
    width,
    minWidth: width,
    padding: "10px 16px",
    fontSize: 13,
    color: "#0f172a",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #f1f5f9",
    ...(borderRight ? { borderRight: "2px solid #e2e8f0" } : {}),
  });

  const thNormal = () => ({
    padding: "10px 16px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    color: "#64748b",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #e2e8f0",
    background: FROZEN_BG_HEAD,
  });

  const tdNormal = () => ({
    padding: "10px 16px",
    fontSize: 13,
    color: "#475569",
    whiteSpace: "nowrap",
    borderBottom: "1px solid #f1f5f9",
  });

  return (
    <DashboardLayout header={{ project: "Banks", user: { name: userName, role: userRole }, notifications: [] }}>
      <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 80px)", overflow: "hidden" }}>

        {/* ── Header ── */}
        <div style={{ flexShrink: 0, background: "#fff", paddingBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#0f172a" }}>Banks</div>
            <div style={{ fontSize: 13, color: "#64748b" }}>{banks.length} bank branch{banks.length !== 1 ? "es" : ""}</div>
          </div>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {selectedBankIds.length > 0 && (
              <button onClick={handleBulkDelete} disabled={bulkDeleting}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#dc2626", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", opacity: bulkDeleting ? 0.5 : 1 }}>
                <Trash2 size={14} />
                {bulkDeleting ? "Deleting..." : `Delete ${selectedBankIds.length} Selected`}
              </button>
            )}
            <button onClick={() => setShowExcelModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#16a34a", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              <Upload size={14} /> Upload Excel
            </button>
            <button onClick={openCreate}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "#4f46e5", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer" }}>
              <Plus size={14} /> Add Bank
            </button>
          </div>
        </div>

        {/* ── Search ── */}
        <div style={{ flexShrink: 0, paddingBottom: 8 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 12px", width: 320, background: "#fff" }}>
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search bank or branch..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, border: "none", outline: "none", fontSize: 13, background: "transparent" }}
            />
            {search && <button onClick={() => setSearch("")} style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}><X size={13} color="#94a3b8" /></button>}
          </div>
        </div>

        {/* ── Table ── */}
        <div style={{ flex: 1, overflow: "auto", border: "1px solid #e2e8f0", borderRadius: 12, background: "#fff" }}>
          {loading ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: 120, color: "#94a3b8", fontSize: 14 }}>
              Loading banks...
            </div>
          ) : (
<table style={{ borderCollapse: "separate", borderSpacing: 0, width: "100%", minWidth: 1400 }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  {/* Frozen: Checkbox */}
                  <th style={{ ...thFrozen(0, 40), textAlign: "center", padding: "10px 12px" }}>
                    <input type="checkbox"
                      checked={filtered.length > 0 && filtered.every(b => selectedBankIds.includes(b.id))}
                      onChange={e => e.target.checked ? setSelectedBankIds(filtered.map(b => b.id)) : setSelectedBankIds([])}
                    />
                  </th>
                  {/* Frozen: ID */}
                  <th style={thFrozen(40, 60)}>ID</th>
                  {/* Frozen: Branch Name */}
                  <th style={thFrozen(100, 180, true)}>Branch Name</th>
                  {/* Frozen: Bank Name */}
                  <th style={thFrozen(280, 180, true)}>Bank Name</th>
                  {/* Scrollable headers */}
                  {["Address", "Taluka", "District", "Pin Code", "Website", "Contact Person", "Owner", "Created At", "Updated At", "Actions"].map(h => (
                    <th key={h} style={thNormal()}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={14} style={{ padding: "48px 24px", textAlign: "center", color: "#94a3b8", fontSize: 14 }}>
                      No banks found
                    </td>
                  </tr>
                ) : filtered.map((bank, rowIdx) => {
                  const bContacts = bankContacts[bank.id] || [];
                  const contactStr = bContacts.map(c => c.fullName).filter(Boolean).join(", ") || "—";
                  const rowBg = "#fff";
                  const rowHover = "#f8fafc";
                  return (
                    <tr key={bank.id}
                      onMouseEnter={e => {
                        const tds = e.currentTarget.querySelectorAll("td");
                        tds.forEach(td => { td.style.background = rowHover; });
                      }}
                      onMouseLeave={e => {
                        const tds = e.currentTarget.querySelectorAll("td");
                        tds.forEach(td => { td.style.background = rowBg; });
                      }}>
                      {/* Frozen: Checkbox */}
                      <td style={{ ...tdFrozen(0, 40, rowBg), textAlign: "center", padding: "10px 12px" }}>
                        <input type="checkbox"
                          checked={selectedBankIds.includes(bank.id)}
                          onChange={e => e.target.checked
                            ? setSelectedBankIds(prev => [...prev, bank.id])
                            : setSelectedBankIds(prev => prev.filter(id => id !== bank.id))}
                        />
                      </td>
                      {/* Frozen: ID */}
                      <td style={{ ...tdFrozen(40, 60, rowBg), color: "#94a3b8", fontSize: 12 }}>{bank.id}</td>
                      {/* Frozen: Branch Name */}
                      <td style={tdFrozen(100, 180, rowBg, true)}>
                        <Link href={`/banks/${bank.id}`} style={{ display: "flex", alignItems: "center", gap: 6, color: "#4f46e5", textDecoration: "none", fontSize: 13, fontWeight: 500 }}>
                          <Building2 size={13} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{bank.branchName || "—"}</span>
                        </Link>
                      </td>
                      {/* Frozen: Bank Name */}
                      <td style={tdFrozen(280, 180, rowBg, true)}>
                        <Link href={`/banks/${bank.id}`} style={{ color: "#4f46e5", textDecoration: "none", fontSize: 13, fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block", maxWidth: 160 }}>
                          {bank.name || "—"}
                        </Link>
                      </td>
                      {/* Scrollable: Address */}
                      <td style={{ ...tdNormal(), maxWidth: 180 }}>
                        <span title={bank.address || ""} style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 160 }}>
                          {bank.address || "—"}
                        </span>
                      </td>
                      {/* Taluka */}
                      <td style={tdNormal()}>{bank.taluka || "—"}</td>
                      {/* District */}
                      <td style={tdNormal()}>{bank.district || "—"}</td>
                      {/* Pin Code */}
                      <td style={tdNormal()}>{bank.pinCode || "—"}</td>
                      {/* Website */}
                      <td style={tdNormal()}>
                        {bank.website
                          ? <a href={bank.website} target="_blank" rel="noopener noreferrer" style={{ color: "#4f46e5", fontSize: 12 }}>{bank.website.replace(/^https?:\/\//, "")}</a>
                          : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      {/* Contact Person */}
                      <td style={{ ...tdNormal(), maxWidth: 180 }}>
                        {bContacts.length > 0 ? (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <User size={11} color="#4f46e5" />
                            </div>
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }} title={contactStr}>{contactStr}</span>
                          </div>
                        ) : <span style={{ color: "#cbd5e1" }}>—</span>}
                      </td>
                      {/* Owner */}
                      <td style={tdNormal()}>{bank.ownerName || "—"}</td>
                      {/* Created At */}
                      <td style={tdNormal()}>{fmtDate(bank.createdAt)}</td>
                      {/* Updated At */}
                      <td style={tdNormal()}>{fmtDate(bank.updatedAt)}</td>
                      {/* Actions */}
                      <td style={{ ...tdNormal(), textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button onClick={() => openEdit(bank)} title="Edit"
                            style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#3b82f6" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#eff6ff"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <Edit2 size={14} />
                          </button>
                          <button onClick={() => handleDelete(bank.id)} title="Delete"
                            style={{ padding: 6, borderRadius: 6, border: "none", background: "transparent", cursor: "pointer", color: "#ef4444" }}
                            onMouseEnter={e => e.currentTarget.style.background = "#fef2f2"}
                            onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Modal ── */}
        {showModal && (
          <>
            <div onClick={() => setShowModal(false)}
              style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.55)", zIndex: 60 }} />
            <div style={{ position: "fixed", inset: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "center", padding: "24px 16px" }}>
              <div style={{ background: "#fff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "90vh", display: "flex", flexDirection: "column", boxShadow: "0 25px 50px rgba(0,0,0,0.25)", overflow: "hidden" }}>
                {/* Modal Header */}
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", padding: "20px 24px", borderBottom: "1px solid #e2e8f0", background: "linear-gradient(to right, #eef2ff, #fff)", flexShrink: 0 }}>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: "#0f172a" }}>{selectedBank ? "Edit Bank" : "Add Bank"}</div>
                    <div style={{ fontSize: 13, color: "#64748b", marginTop: 2 }}>{selectedBank ? "Update bank branch information" : "Add a new bank branch"}</div>
                  </div>
                  <button onClick={() => setShowModal(false)}
                    style={{ border: "none", background: "none", cursor: "pointer", padding: 6, borderRadius: "50%", color: "#94a3b8" }}>
                    <X size={18} />
                  </button>
                </div>

                {/* Modal Body */}
                <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Bank + Branch */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Bank Name <span style={{ color: "#f43f5e" }}>*</span></label>
                      <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                        placeholder="e.g. State Bank of India"
                        style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Branch Name</label>
                      <input type="text" value={form.branch} onChange={e => setForm({ ...form, branch: e.target.value })}
                        placeholder="e.g. Main Branch"
                        style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>

                  {/* Taluka + District + Pin */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                    {[["Taluka", "taluka", "Taluka"], ["District", "district", "District"], ["Pin Code", "pinCode", "Pin Code"]].map(([label, key, ph]) => (
                      <div key={key}>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>{label}</label>
                        <input type="text" value={form[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}
                          placeholder={ph}
                          style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                      </div>
                    ))}
                  </div>

                  {/* Address + Website */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Address</label>
                      <textarea value={form.address} onChange={e => setForm({ ...form, address: e.target.value })} rows={2}
                        placeholder="Full address"
                        style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", resize: "none", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 6 }}>Website</label>
                      <input type="url" value={form.website} onChange={e => setForm({ ...form, website: e.target.value })}
                        placeholder="https://..."
                        style={{ width: "100%", border: "1px solid #cbd5e1", borderRadius: 8, padding: "9px 12px", fontSize: 13, outline: "none", boxSizing: "border-box" }} />
                    </div>
                  </div>

                  {/* Contact Persons */}
                  <div style={{ border: "1px solid #e2e8f0", borderRadius: 10, overflow: "hidden" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: 11, fontWeight: 600, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                        Contact Persons <span style={{ color: "#4f46e5", fontWeight: 700 }}>({contacts.length})</span>
                      </span>
                      <button onClick={addContact}
                        style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: "#4f46e5", background: "#eef2ff", border: "1px solid #c7d2fe", borderRadius: 6, padding: "4px 10px", cursor: "pointer" }}>
                        <UserPlus size={12} /> Add Person
                      </button>
                    </div>
                    {contacts.map((c, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 16px", borderBottom: i < contacts.length - 1 ? "1px solid #f1f5f9" : "none" }}>
                        <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#e0e7ff", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 11, fontWeight: 700, color: "#4f46e5" }}>{i + 1}</div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, flex: 1 }}>
                          <input type="text" value={c.fullName} onChange={e => updateContact(i, "fullName", e.target.value)}
                            placeholder="Full name"
                            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none" }} />
                          <input type="email" value={c.email} onChange={e => updateContact(i, "email", e.target.value)}
                            placeholder="Email"
                            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none" }} />
                          <input type="text" value={c.position} onChange={e => updateContact(i, "position", e.target.value)}
                            placeholder="Position"
                            style={{ border: "1px solid #cbd5e1", borderRadius: 6, padding: "7px 10px", fontSize: 13, outline: "none" }} />
                        </div>
                        {contacts.length > 1 && (
                          <button onClick={() => removeContact(i)}
                            style={{ border: "none", background: "none", cursor: "pointer", color: "#f87171", padding: 4, borderRadius: 4, flexShrink: 0 }}>
                            <Trash size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Modal Footer */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 24px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", flexShrink: 0 }}>
                  <button onClick={() => setShowModal(false)}
                    style={{ border: "1px solid #cbd5e1", background: "#fff", borderRadius: 8, padding: "8px 18px", fontSize: 13, fontWeight: 500, color: "#374151", cursor: "pointer" }}>
                    Cancel
                  </button>
                  <button onClick={handleSave}
                    style={{ border: "none", background: "#4f46e5", borderRadius: 8, padding: "8px 20px", fontSize: 13, fontWeight: 500, color: "#fff", cursor: "pointer" }}>
                    {selectedBank ? "Update Bank" : "Create Bank"}
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <BankExcelUploadModal
        isOpen={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onUploadSuccess={() => {
          setShowExcelModal(false);
          fetchBanks();
        }}
      />
    </DashboardLayout>
  );
}

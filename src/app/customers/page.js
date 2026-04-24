"use client";


import React, { useState, useEffect, useMemo, useRef, useCallback, useDeferredValue } from 'react';



import { Search, Edit2, Trash2, Eye, Settings, X, Plus, Calendar, DollarSign, Building, User, Phone, Mail, MapPin, Map as MapIcon, Home, Shield, Upload, Download } from "lucide-react";
import Link from "next/link";



import { backendApi } from "@/services/api";



import { clientApi } from "@/services/clientApi";

import { departmentApiService } from "@/services/departmentApi.service";



import DashboardLayout from "@/components/layout/DashboardLayout";



import DynamicFieldsSection from "@/components/dynamic-fields/DynamicFieldsSection";



import { useToast } from "@/components/common/ToastProvider";



import { getLoggedInUser } from "@/utils/auth";

import { getAuthUser } from "@/utils/authUser";

import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";

import { getTabSafeItem } from "@/utils/tabSafeStorage";

import { broadcastActivity, createActivity } from "@/utils/activityBus";



import { useCustomerAddressSync } from "@/context/CustomerAddressContext";



import { useStages } from "@/context/StageContext";



import CustomerExcelUploadModal from "@/components/excel/CustomerExcelUploadModal";

import AccountTransferDialog from "@/components/common/AccountTransferDialog";



export default function CustomersPage() {

  const { addToast } = useToast();



  const { version } = useCustomerAddressSync();



  const { departments, getStagesForDepartment, fetchStagesForDepartment, fetchDepartments } = useStages();



  //  CRITICAL FIX: Use tab-safe storage for multi-tab login isolation

  const [userName, setUserName] = useState(() => {

    if (typeof window === 'undefined') return "Admin User";

    try {

      let rawUserData = getTabSafeItem("user_data");

      if (!rawUserData) {

        rawUserData = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");

      }

      const user = rawUserData ? JSON.parse(rawUserData) : null;

      return user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Admin User";

    } catch {

      return "Admin User";

    }

  });



  const [userRole, setUserRole] = useState(() => {

    if (typeof window === 'undefined') return "";

    try {

      let role = getTabSafeItem("user_role");

      if (!role) {

        role = sessionStorage.getItem("user_role") || localStorage.getItem("user_role");

      }

      return role || "";

    } catch {

      return "";

    }

  });



  //  CRITICAL: Cross-tab user data sync

  useEffect(() => {

    if (typeof window === 'undefined') return;



    const handleStorageChange = (e) => {

      if (e.key === 'user_data' || e.key === 'user_role') {

        // Update local state when user data changes in another tab

        try {

          let rawUserData = getTabSafeItem("user_data");

          if (!rawUserData) {

            rawUserData = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");

          }

          const user = rawUserData ? JSON.parse(rawUserData) : null;

          setUserName(user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Admin User");



          let role = getTabSafeItem("user_role");

          if (!role) {

            role = sessionStorage.getItem("user_role") || localStorage.getItem("user_role");

          }

          setUserRole(role || "");

        } catch (error) {

        }

      }

    };



    // Listen for BroadcastChannel messages for real-time updates

    let broadcastChannel = null;

    if (typeof BroadcastChannel !== 'undefined') {

      broadcastChannel = new BroadcastChannel('crm-updates');

      broadcastChannel.onmessage = (e) => {

        if (e.data?.type === 'CUSTOMER_UPDATED') {

          fetchCustomers();

        }



        if (e.data?.type === 'DEAL_STAGE_CHANGED') {

          fetchDeals();

        }

      };

    }



    window.addEventListener('storage', handleStorageChange);



    return () => {

      window.removeEventListener('storage', handleStorageChange);

      if (broadcastChannel) {

        broadcastChannel.close();

      }

    };

  }, []);



  //  CRITICAL: Tab-safe auth user function  memoized to avoid JSON.parse on every render
  const authUserRef = useRef(null);
  const getTabSafeAuthUser = useCallback(() => {
    if (typeof window === 'undefined') return null;
    if (authUserRef.current) return authUserRef.current;
    try {
      let rawUserData = getTabSafeItem("user_data");
      if (!rawUserData) rawUserData = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");
      const user = rawUserData ? JSON.parse(rawUserData) : null;
      authUserRef.current = user;
      return user;
    } catch { return null; }
  }, []);

  // Clear auth cache on storage change
  useEffect(() => {
    const clear = () => { authUserRef.current = null; };
    window.addEventListener('storage', clear);
    return () => window.removeEventListener('storage', clear);
  }, []);





  const [customers, setCustomers] = useState([]);
  const [banks, setBanks] = useState([]);
  const [deals, setDeals] = useState([]);
  const [selectedDealIds, setSelectedDealIds] = useState([]);  // array, not Set  avoids stale reference bug
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [search, setSearch] = useState("");
  // useDeferredValue: input stays instant, heavy filtering deferred by React scheduler
  const debouncedSearch = useDeferredValue(search);

  const [loading, setLoading] = useState(true);

  // Column filter state variables
  const [columnFilters, setColumnFilters] = useState({});       // { bank: Set(['Aavas',...]), stage: Set([...]) }
  const [openFilterCol, setOpenFilterCol] = useState(null);     // which column dropdown is open
  const [filterSearch, setFilterSearch] = useState({});         // search text inside each column's dropdown
  const [sortConfig, setSortConfig] = useState({ key: null, dir: 'asc' }); // column sort

  // Virtual scrolling state
  const [visibleStart, setVisibleStart] = useState(0);
  const ROW_HEIGHT = 72;      // px per row - actual row height with addresses/stage badges
  const VISIBLE_ROWS = 30;    // render more rows at once
  const OVERSCAN = 8;         // extra rows above/below for smooth scroll

  const tbodyRef = useRef(null);

  // Virtual scrolling useEffect
  // IMPORTANT: dep=[loading] so it re-attaches AFTER table renders (when loading becomes false)
  // With dep=[] it ran at mount when loading=true  tbody not rendered  tbodyRef=null  no scroll
  useEffect(() => {
    if (loading) return; // table not rendered yet
    // small delay to let React finish rendering the tbody
    const timer = setTimeout(() => {
      const el = tbodyRef.current?.closest('.overflow-auto');
      if (!el) return;
      const onScroll = () => {
        const scrollTop = el.scrollTop;
        setVisibleStart(Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN));
      };
      el.addEventListener('scroll', onScroll, { passive: true });
      // store cleanup on the element itself so we can remove it
      el._scrollCleanup = () => el.removeEventListener('scroll', onScroll);
    }, 50);
    return () => {
      clearTimeout(timer);
      // cleanup any previously attached listener
      const el = tbodyRef.current?.closest('.overflow-auto');
      if (el?._scrollCleanup) {
        el._scrollCleanup();
        delete el._scrollCleanup;
      }
    };
  }, [loading]); // re-run when loading changes from true  false



  const [showCreateDrawer, setShowCreateDrawer] = useState(false);



  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);



  const [selectedCustomer, setSelectedCustomer] = useState(null);



  const [dynamicColumns, setDynamicColumns] = useState([]);



  const [clientFieldDefinitions, setClientFieldDefinitions] = useState([]);



  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);



  //  Account transfer dialog state

  const [showAccountTransferDialog, setShowAccountTransferDialog] = useState(false);

  const [pendingStageChange, setPendingStageChange] = useState(null);







  // For table filters



  const [filterDepartment, setFilterDepartment] = useState("");



  const [filterStage, setFilterStage] = useState("");



  const [filterAvailableStages, setFilterAvailableStages] = useState([]);

  //  NEW: Top department filter (Admin/Manager only)
  const [topDepartmentFilter, setTopDepartmentFilter] = useState("");
  const [allDepartments, setAllDepartments] = useState([]);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true); // Mark as mounted after hydration
    const _ud = (() => { try { return JSON.parse(sessionStorage.getItem('user_data') || localStorage.getItem('user_data') || '{}'); } catch { return {}; } })();
    fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8080"}/api/stages/departments`, {
      headers: { 'X-User-Id': String(_ud?.id ?? ''), 'X-User-Role': _ud?.role ?? '' }
    })
      .then(r => r.ok ? r.json() : [])
      .then(data => setAllDepartments(data || []))
      .catch(() => {});
  }, []);







  // For create/edit form  these are passed to the drawer component
  // They are kept here so openEdit/openCreate can set them
  const [formDepartment, setFormDepartment] = useState("");
  const [availableStages, setAvailableStages] = useState([]);
  const [deptSearch, setDeptSearch] = useState("");

  const EMPTY_ADDR = (enabled = false) => ({
    enabled, id: null, addressLine: "", city: "", state: "", pincode: "",
    taluka: "", district: "", latitude: "", longitude: "",
  });
  const makeEmptyForm = () => ({
    name: "", email: "", phone: "",
    addresses: {
      primary: EMPTY_ADDR(true),
      branch:  EMPTY_ADDR(false),
      police:  EMPTY_ADDR(false),
      tahsil:  EMPTY_ADDR(false),
    },
    contactName: "", contactNumber: "", bankId: "", branchName: "",
    stage: "", valueAmount: "", closingDate: "", description: "", customFields: {}
  });
  const [form, setForm] = useState(makeEmptyForm);

  // Load stages for deal form when department changes (create/edit)
  useEffect(() => {
    if (!formDepartment) { setAvailableStages([]); setForm(prev => ({ ...prev, stage: "" })); return; }
    let cancelled = false;
    fetchStagesForDepartment(formDepartment).then(stages => { if (!cancelled) setAvailableStages(stages || []); }).catch(() => { if (!cancelled) setAvailableStages([]); });
    return () => { cancelled = true; };
  }, [formDepartment]);







  //  Normalize backend response



  const normalizeList = (res) => {



    if (Array.isArray(res)) return res;



    if (res?.content && Array.isArray(res.content)) return res.content;



    return [];



  };







  //  Extract status from various error shapes



  const getStatusFromError = (err) => {



    if (!err) return null;



    if (err?.response?.status) return err.response.status;



    if (err?.status) return err.status;



    if (err?.data?.status) return err.data.status;



    const msg = (err?.message || "").toString();



    if (/404|not\s*found/i.test(msg)) return 404;



    return null;



  };








  const fetchCustomers = async (silent = false) => {
    await loadAllData(silent);
  };

  const fetchDeals = async () => {
    await loadAllData(true);
  };







  const fetchClientFields = async () => {
    try {
      const res = await backendApi.get("/client-fields");
      setClientFieldDefinitions(res);
    } catch (err) {

    }
  };

  // Load client fields once on mount
  useEffect(() => { fetchClientFields(); }, []);

  // Fetch full banks list when drawer opens (needed for branch dropdown)
  useEffect(() => {
    if (!showCreateDrawer) return;
    backendApi.get('/banks?size=9999').then(res => {
      const list = Array.isArray(res) ? res : (res?.content || []);
      if (list.length > 0) setBanks(list);
    }).catch(() => {});
  }, [showCreateDrawer]);








  useEffect(() => {
    loadAllData(false);
  }, []);

  const loadAllData = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      // Single API call  returns clients + all deals + all addresses + bank info
      // Replaces 3 separate calls + N per-row address fetches
      const data = await backendApi.get('/clients/with-deals').catch(() => []);
      const rows = Array.isArray(data) ? data : [];

      const customersData = rows.map(r => ({
        id: r.id,
        name: r.name,
        email: r.email,
        contactPhone: r.contactPhone,
        contactName: r.contactName,
        contactNumber: r.contactNumber,
        ownerName: r.ownerName,
        ownerId: r.ownerId,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        addresses: Array.isArray(r.addresses) ? r.addresses : [],
        customFields: r.customFields || {},
        // fallback flat address fields if backend sends them
        addressLine: r.addressLine || r.address || "",
        city: r.city || "",
        state: r.state || "",
        pincode: r.pincode || "",
      }));

      const allDeals = rows.flatMap(r =>
        (r.deals || []).map(d => ({
          ...d,
          clientId: r.id,
          stageCode: (d.stageCode || '').toUpperCase(),
          valueAmount: d.calculatedValue ?? d.valueAmount ?? 0,
          calculatedValue: d.calculatedValue ?? d.valueAmount ?? null,
          movedToApproval: d.movedToApproval ?? false,
          dealCode: d.dealCode ?? null,
          productNames: d.productNames || [],
        }))
      );

      // Build banks list from deal data (for branch dropdown in form)
      const banksMap = {};
      allDeals.forEach(d => {
        if (d.bankId && !banksMap[d.bankId]) {
          banksMap[d.bankId] = {
            id: d.bankId,
            name: d.bankName || '',
            branchName: d.branchName || '',
            taluka: d.taluka || '',
            district: d.district || '',
          };
        }
      });

      const keys = new Set();
      customersData.forEach(c => {
        if (c.customFields && typeof c.customFields === 'object') {
          Object.keys(c.customFields).forEach(k => keys.add(k));
        }
      });

      setCustomers(customersData);
      setDeals(allDeals);
      setBanks(Object.values(banksMap));
      setDynamicColumns([...keys]);

    } catch (err) {

      if (!silent) addToast('Failed to load customers', 'error');
    } finally {
      if (!silent) setLoading(false);
    }
  };

    // Detect edit query param and open edit drawer  runs ONCE when customers first load
  const editOpenedRef = useRef(false);
  const customersRef = useRef([]);
  useEffect(() => { customersRef.current = customers; }, [customers]);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (editOpenedRef.current) return;
    const params = new URLSearchParams(window.location.search);
    const editId = params.get('edit');
    if (!editId) return;
    // Poll until customers are loaded
    const interval = setInterval(() => {
      if (customersRef.current.length === 0) return;
      clearInterval(interval);
      const found = customersRef.current.find(c => String(c.id) === editId);
      if (found && !editOpenedRef.current) {
        editOpenedRef.current = true;
        openEdit(found).then(() => window.history.replaceState({}, '', '/customers'));
      }
    }, 200);
    return () => clearInterval(interval);
  }, []); // runs once on mount  no customers dep = no loop

  // Close column filter dropdown when clicking outside
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.col-filter-th')) {
        setOpenFilterCol(null);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const formatLabel = (key) => {

    return key

      .replace(/([A-Z])/g, " $1")

      .replace(/^./, (str) => str.toUpperCase());

  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };







  // Helper function to get address type display name



  const getAddressTypeDisplayName = (addressType) => {

    const displayNames = {

      'PRIMARY': 'Primary Address',

      'POLICE': 'Police Station Address',

      'BRANCH': 'Branch Address',

      'TAHSIL': 'Tahsil Address',

      'HEADOFFICE': 'Head Office Address'

    };

    return displayNames[addressType] || addressType;

  };


  // Helper function to get all unique address types from customers



  const getAllAddressTypes = () => {



    const addressTypes = new Set();



    customers.forEach(customer => {



      if (customer.addresses && customer.addresses.length > 0) {



        customer.addresses.forEach(addr => {



          addressTypes.add(addr.addressType);



        });



      }



    });



    return Array.from(addressTypes).sort((a, b) => {



      const order = ["PRIMARY", "POLICE", "BRANCH", "TAHSIL"];



      return order.indexOf(a) - order.indexOf(b);



    });



  };







  // Helper function to get deal stage color and styling



  const getDealStageStyle = (stage, department) => {



    const stages = getStagesForDepartment(department);



    const stageData = stages.find(s => s.stageCode === stage);







    if (stageData?.isTerminal) {



      return { bg: 'bg-slate-100', text: 'text-slate-800', border: 'border-slate-200' };



    }







    // Default styling for non-terminal stages



    return { bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200' };



  };







  // Helper function to get stage display name

  const getStageDisplayName = (stage, department) => {

    if (!stage || !department) return stage || "-";

    const stages = getStagesForDepartment(department) || [];

    const s = stages.find(x => x.stageCode === stage);

    return s?.stageName || stage;

  };







  // Helper function to format owner display with role



  const formatOwnerDisplay = (customer) => {



    //  FIX: Handle different possible data structures



    if (!customer) return "-";



    //  FIX: First try deal ownerName (from backend API)

    if (customer.ownerName) {

      return customer.ownerName;

    }



    // Case 1: Owner object with fullName

    if (customer.owner && customer.owner.fullName) {

      return customer.owner.fullName;

    }



    // Case 2: Owner object with firstName and lastName

    if (customer.owner && customer.owner.firstName) {

      const { firstName, lastName } = customer.owner;

      return lastName ? `${firstName} ${lastName}` : firstName;

    }



    // Case 3: Owner object with simple structure

    if (customer.owner && customer.owner.fullName) {

      return customer.owner.fullName;

    }



    return "-";



  };



  const formatAddressForTable = (address) => {



    if (!address) return "-";



    const parts = [address.addressLine, address.city, address.pincode].filter(Boolean);



    return parts.join(", ");



  };



  const getAddressTypeIcon = (addressType) => {



    switch (addressType) {



      case 'PRIMARY': return <Home className="h-3 w-3" />;



      case 'POLICE': return <Shield className="h-3 w-3" />;



      case 'BRANCH': return <Building className="h-3 w-3" />;



      case 'TAHSIL': return <MapPin className="h-3 w-3" />;



      default: return <MapPin className="h-3 w-3" />;



    }



  };







  const handleAddressToggle = (addressType, enabled) => {



    setForm({



      ...form,



      addresses: {



        ...form.addresses,



        [addressType]: {



          ...form.addresses[addressType],



          enabled: enabled,



          // Reset fields when disabled



          ...(enabled ? {} : {



            addressLine: "",



            city: "",



            pincode: "",



            latitude: "",



            longitude: ""



          })



        }



      }



    });



  };







  const handleAddressFieldChange = (addressType, field, value) => {



    setForm(prev => ({



      ...prev,



      addresses: {



        ...prev.addresses,



        [addressType]: {



          ...prev.addresses[addressType],



          [field]: value



        }



      }



    }));



  };







  const handleAddressGeocode = async (addressType) => {



    const address = form.addresses[addressType];







    if (!address.addressLine || address.addressLine.trim().length < 3) {



      addToast("Please enter a complete address first", "warning");



      return;



    }







    try {



      const response = await fetch('http://localhost:8080/api/clients/geocode', {



        method: 'POST',



        headers: {



          'Content-Type': 'application/json',



        },



        body: JSON.stringify({



          addressLine: address.addressLine,



          city: address.city,



          pincode: address.pincode,



          state: address.state,        //  DYNAMIC STATE



          country: "India"           //  FIXED: Country (can be dynamic later)



        })



      });







      const data = await response.json();







      if (data.success) {



        setForm(prev => ({



          ...prev,



          addresses: {



            ...prev.addresses,



            [addressType]: {



              ...prev.addresses[addressType],



              latitude: data.latitude.toString(),



              longitude: data.longitude.toString()



            }



          }



        }));



        addToast(`${addressType.charAt(0).toUpperCase() + addressType.slice(1)} address geocoded successfully!`, "success");



      } else {

        // Show improved error message for geocoding failures



        const errorMessage = data.message || 'Could not geocode address';



        const improvedMessage = errorMessage.includes('Unable to determine coordinates')



          ? ' Location Not Found\n\nWe could not detect exact coordinates for this address.\n\nPlease refine address or include a nearby landmark.'



          : errorMessage;







        addToast(improvedMessage, "warning");



      }



    } catch (error) {

      addToast('Failed to geocode address', "error");



    }



  };







  const handleReverseGeocode = async (addressType) => {



    const address = form.addresses[addressType];



    const lat = parseFloat(address.latitude);



    const lng = parseFloat(address.longitude);







    if (!lat || !lng) {



      addToast("Please enter latitude and longitude first", "warning");



      return;



    }







    try {



      const response = await fetch('http://localhost:8080/api/clients/reverse-geocode', {



        method: 'POST',



        headers: {



          'Content-Type': 'application/json',



        },



        body: JSON.stringify({ latitude: lat, longitude: lng })



      });







      const data = await response.json();







      if (data.success) {



        // Parse the returned address to update form fields



        const addressParts = data.address.split(',');



        if (addressParts.length >= 2) {



          handleAddressFieldChange(addressType, 'addressLine', addressParts[0].trim());



          handleAddressFieldChange(addressType, 'city', addressParts[1].trim());



          addToast(` Address updated from coordinates!`, "success");



        }



      } else {

        addToast(data.message || 'Could not reverse geocode coordinates', "warning");



      }



    } catch (error) {

      addToast('Failed to reverse geocode coordinates', "error");



    }



  };







  // O(1) bank lookup map  must be defined before getBankDetails
  const banksMap = useMemo(() => {
    const m = {};
    banks.forEach(b => { m[Number(b.id)] = b; });
    return m;
  }, [banks]);

  const getBankDetails = useCallback((deal) => {
    const bankObj = deal?.bankId ? banksMap[Number(deal.bankId)] : null;
    return {
      name: deal?.bankName || deal?.relatedBankName || bankObj?.name || "-",
      branch: deal?.branchName || bankObj?.branchName || "-",
    };
  }, [banksMap]);

  const getCustomerLocation = useCallback((customer) => {
    const primary = customer?.addresses?.find(a => a?.addressType === 'PRIMARY') || customer?.addresses?.[0];
    return {
      taluka:   primary?.taluka   || "-",
      district: primary?.district || "-",
    };
  }, []);

  // Full address from customer PRIMARY address
  const getFullAddress = (customer) => {
    if (!customer?.addresses?.length) {
      // Fallback to direct address fields if available
      const parts = [
        customer?.addressLine,
        customer?.city, 
        customer?.state, 
        customer?.pincode
      ].filter(Boolean);
      return parts.length > 0 ? parts.join(", ") : "-";
    }
    const primary = customer.addresses.find(a => a?.addressType === 'PRIMARY') || customer.addresses[0];
    if (!primary) return "-";
    const parts = [primary?.addressLine, primary?.city, primary?.state, primary?.pincode].filter(Boolean);
    return parts.join(", ") || "-";
  };

  // Column filter helper functions
  const getUniqueColValues = (colKey) => {
    const vals = new Set();
    customers.forEach(customer => {
      const deal = latestDealByClient.get(Number(customer.id)) ?? null;
      const bankDetails = getBankDetails(deal);
      const loc = getCustomerLocation(customer);
      const valueMap = {
        name:       customer.name || null,
        bankName:   bankDetails.name !== '-' ? bankDetails.name : null,
        branchName: bankDetails.branch !== '-' ? bankDetails.branch : null,
        taluka:     loc.taluka !== '-' ? loc.taluka : null,
        district:   loc.district !== '-' ? loc.district : null,
        stageCode:  deal?.stageCode ? deal.stageCode.toUpperCase() : null,
        department: deal?.department ? deal.department.trim() : null,
        ownerName:  customer.ownerName || null,
        createdAt:  customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
        updatedAt:  customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : null,
      };
      const v = valueMap[colKey];
      if (v) vals.add(v);
    });
    return [...vals].sort();
  };

  const toggleColFilterValue = (colKey, value) => {
    setColumnFilters(prev => {
      const allVals = getUniqueColValues(colKey);
      const current = prev[colKey] ?? new Set(allVals); // default = all selected
      const next = new Set(current);
      if (next.has(value)) {
        next.delete(value);
      } else {
        next.add(value);
      }
      return { ...prev, [colKey]: next };
    });
  };

  const selectAllColValues = (colKey) => {
    const all = getUniqueColValues(colKey);
    setColumnFilters(prev => ({ ...prev, [colKey]: new Set(all) }));
  };

  const clearAllColValues = (colKey) => {
    setColumnFilters(prev => ({ ...prev, [colKey]: new Set() }));
  };

  const isColFilterActive = (colKey) => {
    if (!columnFilters[colKey]) return false;
    const all = getUniqueColValues(colKey);
    return columnFilters[colKey].size !== all.length;
  };

  const handleColSort = (colKey) => {
    setSortConfig(prev =>
      prev.key === colKey
        ? { key: colKey, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
        : { key: colKey, dir: 'asc' }
    );
  };

  // Build clientId  latest deal map at component scope for table rows

  // Pre-index deals by clientId  O(n) once, reused everywhere
  const dealsByClientMap = useMemo(() => {
    const map = new Map();
    for (const d of deals) {
      const cid = Number(d.clientId ?? d.client_id ?? (typeof d.client === 'object' ? d.client?.id : d.client) ?? null);
      if (!cid) continue;
      if (!map.has(cid)) map.set(cid, []);
      map.get(cid).push(d);
    }
    return map;
  }, [deals]);

  // Pre-compute latest deal per client  O(n) once
  const latestDealByClient = useMemo(() => {
    const map = new Map();
    for (const [cid, list] of dealsByClientMap.entries()) {
      const latest = list.reduce((best, d) => {
        if (!best) return d;
        const td = new Date(d.createdAt) - new Date(best.createdAt);
        return (td > 0 || (td === 0 && Number(d.id) > Number(best.id))) ? d : best;
      }, null);
      map.set(cid, latest);
    }
    return map;
  }, [dealsByClientMap]);

  // Legacy single-entry map (kept for getBankDetails calls in table rows)
  const dealByClient = latestDealByClient;


  // Cache auth user â€” avoids JSON.parse on every filtered/flatRows recompute
  const cachedAuthUser = useMemo(() => getTabSafeAuthUser(), [userRole]);
  const cachedRole = useMemo(() => (cachedAuthUser?.role || userRole || "").toUpperCase(), [cachedAuthUser, userRole]);
  const cachedUserDept = useMemo(() => (cachedAuthUser?.department || cachedAuthUser?.departmentName || cachedAuthUser?.tlDepartmentName || "").toUpperCase().trim(), [cachedAuthUser]);
  const isPrivilegedUser = useMemo(() => cachedRole === "ADMIN" || cachedRole === "MANAGER" || cachedRole === "HR", [cachedRole]);

  const filtered = useMemo(() => {
    const authUser = getTabSafeAuthUser();
    const role = (authUser?.role || userRole || "").toUpperCase();
    const userDept = (authUser?.department || authUser?.departmentName || authUser?.tlDepartmentName || "").toUpperCase().trim();
    const isPrivileged = role === "ADMIN" || role === "MANAGER" || role === "HR";
    const q = debouncedSearch.toLowerCase();

    let result = customers.filter((customer) => {
      // text search
      const textMatch =
        !q ||
        (customer.name || "").toLowerCase().includes(q) ||
        (customer.email || "").toLowerCase().includes(q) ||
        (customer.contactPhone || "").toLowerCase().includes(q);
      if (!textMatch) return false;

      if (isPrivileged) return true;

      if (userDept) {
        const clientDeals = dealsByClientMap.get(Number(customer.id)) || [];
        if (clientDeals.length === 0) return false;
        const deptDeals = clientDeals.filter(d => (d?.department || "").toUpperCase() === userDept);
        if (deptDeals.length === 0) return false;
        if (userDept === "ACCOUNT") {
          return deptDeals.some(d => {
            const stage = (d?.stageCode || "").toUpperCase().replace(/ /g, "_");
            return !d?.movedToApproval && stage !== "CLOSE_WIN" && stage !== "CLOSE_LOST";
          });
        }
        return true;
      }
      return false;
    });

    // legacy dept/stage dropdown filters
    if (filterDepartment || filterStage) {
      result = result.filter(customer => {
        const clientDeals = dealsByClientMap.get(Number(customer.id)) || [];
        if (filterDepartment && filterStage) return clientDeals.some(d => d.department === filterDepartment && d.stageCode === filterStage);
        if (filterDepartment) return clientDeals.some(d => d.department === filterDepartment);
        return clientDeals.some(d => d.stageCode === filterStage);
      });
    }

    // top department filter
    if (topDepartmentFilter && isPrivileged) {
      result = result.filter(customer =>
        (dealsByClientMap.get(Number(customer.id)) || []).some(d => d?.department === topDepartmentFilter)
      );
    }

    // per-column filters
    Object.entries(columnFilters).forEach(([colKey, allowedSet]) => {
      if (!allowedSet || allowedSet.size === 0) { result = []; return; }
      result = result.filter(customer => {
        const deal = latestDealByClient.get(Number(customer.id)) ?? null;
        const bankDetails = getBankDetails(deal);
        const loc = getCustomerLocation(customer);
        const valueMap = {
          name:       customer.name || '',
          bankName:   bankDetails.name !== '-' ? bankDetails.name : '',
          branchName: bankDetails.branch !== '-' ? bankDetails.branch : '',
          taluka:     loc.taluka !== '-' ? loc.taluka : '',
          district:   loc.district !== '-' ? loc.district : '',
          stageCode:  deal?.stageCode ? deal.stageCode.toUpperCase() : '',
          department: deal?.department ? deal.department.trim() : '',
          ownerName:  customer.ownerName || '',
          createdAt:  customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
          updatedAt:  customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
        };
        const val = valueMap[colKey];
        return val ? allowedSet.has(val) : allowedSet.has('(Empty)');
      });
    });

    // column sort
    if (sortConfig.key) {
      result = [...result].sort((a, b) => {
        const getVal = (customer) => {
          const deal = latestDealByClient.get(Number(customer.id)) ?? null;
          const bd = getBankDetails(deal);
          const loc = getCustomerLocation(customer);
          const vm = {
            name:       customer.name || '',
            bankName:   bd.name !== '-' ? bd.name : '',
            branchName: bd.branch !== '-' ? bd.branch : '',
            taluka:     loc.taluka !== '-' ? loc.taluka : '',
            district:   loc.district !== '-' ? loc.district : '',
            stageCode:  deal?.stageCode || '',
            department: deal?.department || '',
            ownerName:  customer.ownerName || '',
            createdAt:  customer.createdAt || '',
            updatedAt:  customer.updatedAt || '',
          };
          return vm[sortConfig.key] || '';
        };
        const va = getVal(a).toLowerCase();
        const vb = getVal(b).toLowerCase();
        return sortConfig.dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
      });
    }

    return result;
  }, [customers, dealsByClientMap, latestDealByClient, debouncedSearch, filterDepartment, filterStage, columnFilters, sortConfig, cachedRole, cachedUserDept, isPrivilegedUser, topDepartmentFilter]);

  // One row per deal  uses pre-indexed map, no deals.filter() per customer
  const flatRows = useMemo(() => {
    const authUser = getTabSafeAuthUser();
    const role = (authUser?.role || userRole || "").toUpperCase();
    const userDept = (authUser?.department || authUser?.departmentName || authUser?.tlDepartmentName || "").toUpperCase().trim();
    const isPrivileged = role === "ADMIN" || role === "MANAGER" || role === "HR";
    const rows = [];

    filtered.forEach(customer => {
      let clientDeals = dealsByClientMap.get(Number(customer.id)) || [];

      if (topDepartmentFilter && isPrivileged) {
        clientDeals = clientDeals.filter(d => d?.department === topDepartmentFilter);
      } else if (userDept && !isPrivileged) {
        clientDeals = clientDeals.filter(d => (d?.department || "").toUpperCase() === userDept);
        if (userDept === "ACCOUNT") {
          clientDeals = clientDeals.filter(d => {
            const stage = (d?.stageCode || "").toUpperCase().replace(/ /g, "_");
            return !d?.movedToApproval && stage !== "CLOSE_WIN" && stage !== "CLOSE_LOST";
          });
        }
      }

      if (clientDeals.length === 0) {
        if (!isPrivileged) return;
        rows.push({ customer, deal: null });
      } else {
        const sorted = clientDeals.slice().sort((a, b) => {
          const td = new Date(b.createdAt) - new Date(a.createdAt);
          return td !== 0 ? td : (Number(b.id) || 0) - (Number(a.id) || 0);
        });
        sorted.forEach(deal => rows.push({ customer, deal }));
      }
    });
    return rows;
  }, [filtered, dealsByClientMap, topDepartmentFilter, cachedRole, cachedUserDept, isPrivilegedUser]);


  // Add column filter props for reuse
  const colFilterProps = {
    openFilterCol, setOpenFilterCol,
    columnFilters, filterSearch, setFilterSearch,
    getUniqueColValues, toggleColFilterValue,
    selectAllColValues, clearAllColValues,
    isColFilterActive, handleColSort, sortConfig,
  };

  //  Reset modal and open create
  const openCreate = () => {
    setSelectedCustomer(null);
    setForm(makeEmptyForm());
    setFormDepartment("");
    setAvailableStages([]);
    setShowCreateDrawer(true);
  };








  // Edit: always fetch fresh data

  /**
   * Converts backend addresses ARRAY  form addresses OBJECT.
   *
   * API shape  : [{ addressType:"PRIMARY", addressLine, city, state,
   *                 pincode, latitude, longitude, id }, ...]
   * Form shape : { primary: { enabled, id, addressLine, ... },
   *                branch:  { enabled, id, addressLine, ... }, ... }
   */
  const mapAddressesToForm = (addresses = []) => {
    const result = {
      primary: { enabled: true,  id: null, addressLine: "", city: "", state: "", pincode: "", taluka: "", district: "", latitude: "", longitude: "" },
      branch:  { enabled: false, id: null, addressLine: "", city: "", state: "", pincode: "", taluka: "", district: "", latitude: "", longitude: "" },
      police:  { enabled: false, id: null, addressLine: "", city: "", state: "", pincode: "", taluka: "", district: "", latitude: "", longitude: "" },
      tahsil:  { enabled: false, id: null, addressLine: "", city: "", state: "", pincode: "", taluka: "", district: "", latitude: "", longitude: "" },
    };
    if (!Array.isArray(addresses)) return result;
    addresses.forEach(addr => {
      const key = (addr.addressType ?? "").toLowerCase();
      if (!(key in result)) return;
      result[key] = {
        enabled:     true,
        id:          addr.id ?? null,
        addressLine: addr.addressLine ?? "",
        city:        addr.city        ?? "",
        state:       addr.state       ?? "",
        pincode:     addr.pincode     ?? "",
        taluka:      addr.taluka      ?? "",
        district:    addr.district    ?? "",
        latitude:    addr.latitude  != null ? String(addr.latitude)  : "",
        longitude:   addr.longitude != null ? String(addr.longitude) : "",
      };
    });
    return result;
  };

  const openEdit = async (customer) => {
    try {
      // 1 Fresh customer data
      const freshCustomer = await clientApi.getById(customer.id);

      // 2 All deals for this customer
      const dealsRes = await backendApi.get(`/deals?clientId=${customer.id}`).catch(() => []);
      const allDeals = normalizeList(dealsRes);

      // 3 Pick LATEST deal by createdAt DESC + id DESC tiebreaker (same logic as table)
      // Handles Excel uploads where ALL deals have the SAME createdAt
      const latestDeal = allDeals
        .slice()
        .sort((a, b) => {
          const timeDiff = new Date(b.createdAt) - new Date(a.createdAt);
          if (timeDiff !== 0) return timeDiff;
          return (Number(b.id) || 0) - (Number(a.id) || 0); // tiebreaker
        })[0] ?? null;
      

      // 4 Normalise stage code to UPPERCASE (same as table)
      const rawStageCode = latestDeal?.stageCode ?? latestDeal?.stage ?? "";
      const normStageCode = rawStageCode.toUpperCase();

      // FIX 1: fetch addresses using fetch() not backendApi
      // backendApi already adds /api prefix  /api/clients is correct
      // but backendApi.get("/api/clients/...") becomes /api/api/clients/...  500!
      const authUser = getTabSafeAuthUser();
      const addrResponse = await fetch(
        `http://localhost:8080/api/clients/${customer.id}/addresses`,
        {
          headers: {
            "X-User-Id": String(authUser?.id ?? ""),
            "X-User-Role": authUser?.role ?? "",
            "X-User-Department": authUser?.department ?? "",
          },
        }
      ).catch(() => null);
      const addressesRes = addrResponse?.ok ? await addrResponse.json() : [];
      const mappedAddresses = mapAddressesToForm(addressesRes);

      // 6 Prefill form with ALL fields
      setSelectedCustomer(freshCustomer);
      setForm({
        name: freshCustomer.name ?? "",
        email: freshCustomer.email ?? "",
        phone: freshCustomer.contactPhone ?? "",
        contactName: freshCustomer.contactName ?? "",
        contactNumber: freshCustomer.contactNumber ?? "",

        // Deal fields
        bankId: latestDeal?.bankId ?? "",
        branchName: latestDeal?.branchName ?? "",
        valueAmount: latestDeal?.valueAmount ?? 0,
        closingDate: latestDeal?.closingDate ?? "",
        stage: normStageCode,                     //  UPPERCASE
        department: latestDeal?.department ?? "",
        description: latestDeal?.description ?? "",

        // Addresses (already in form shape)
        addresses: mappedAddresses,

        customFields: {}
      });

      // 7 Department & stage handling (exact copy of detail page)
      if (latestDeal?.department && departments.includes(latestDeal.department)) {
        setFormDepartment(latestDeal.department);
        const stages = await fetchStagesForDepartment(latestDeal.department);
        setAvailableStages(stages || []);
        setForm(prev => ({
          ...prev,
          stage: stages?.some(s => (s.stageCode ?? "").toUpperCase() === normStageCode) ? normStageCode : ""
        }));
      } else {
        // No department  reset department dropdown
        setFormDepartment("");
        setAvailableStages([]);
      }

      setShowCreateDrawer(true);
    } catch (err) {

      addToast("Failed to load customer details", "error");
    }
  };





  const openDetails = async (customer) => {
    setSelectedCustomer(customer);
    setShowDetailsDrawer(true);

    // Fetch addresses if not already loaded
    if (!customer.addresses || customer.addresses.length === 0) {
      try {
        const authUser = getTabSafeAuthUser();
        const res = await fetch(`http://localhost:8080/api/clients/${customer.id}/addresses`, {
          headers: {
            "X-User-Id": String(authUser?.id ?? ""),
            "X-User-Role": authUser?.role ?? "",
          },
        });
        if (res.ok) {
          const addresses = await res.json();
          setSelectedCustomer(prev => ({ ...prev, addresses }));
          // Also update the customers list so table Address column shows data
          setCustomers(prev =>
            prev.map(c => c.id === customer.id ? { ...c, addresses } : c)
          );
        }
      } catch {}
    }
  };







  const handleCreateOrUpdate = async () => {



    try {



      if (!form.name?.trim()) {



        addToast("Customer Name is required", "error");



        return;



      }







      // Validate primary address



      if (!form.addresses.primary.enabled || !form.addresses.primary.addressLine?.trim() || !form.addresses.primary.city?.trim()) {



        addToast("Primary address is required", "error");



        return;



      }







      if (!form.addresses.primary.enabled || !form.addresses.primary.latitude || !form.addresses.primary.longitude) {



        addToast("Primary address latitude and longitude are required", "error");



        return;



      }







      // Validate department and stage (CRITICAL)



      if (!formDepartment?.trim()) {



        addToast("Department is required", "error");



        return;



      }







      if (!form.stage?.trim()) {



        addToast("Deal Stage is required", "error");



        return;



      }







      // Get logged in user for owner fields using tab-safe storage



      const user = getTabSafeAuthUser();







      const buildAddr = (type, typeConst, isPrimary) => ({
        id:          form.addresses[type].id || null,
        addressType: typeConst,
        addressLine: form.addresses[type].addressLine.trim(),
        city:        form.addresses[type].city?.trim()     || "",
        state:       form.addresses[type].state?.trim()    || "",
        pincode:     form.addresses[type].pincode?.trim()  || "",
        taluka:      form.addresses[type].taluka?.trim()   || "",
        district:    form.addresses[type].district?.trim() || "",
        latitude:    parseFloat(form.addresses[type].latitude)  || null,
        longitude:   parseFloat(form.addresses[type].longitude) || null,
        isPrimary,
      });

      const addresses = [];
      if (form.addresses.primary.enabled) addresses.push(buildAddr("primary", "PRIMARY", true));
      if (form.addresses.branch.enabled)  addresses.push(buildAddr("branch",  "BRANCH",  false));
      if (form.addresses.police.enabled)  addresses.push(buildAddr("police",  "POLICE",  false));
      if (form.addresses.tahsil.enabled)  addresses.push(buildAddr("tahsil",  "TAHSIL",  false));







      // Create/Update Customer



      const customerPayload = {



        name: form.name?.trim(),



        email: form.email?.trim() || null,



        contactPhone: form.phone?.trim() || null,



        contactName: form.contactName || "",



        contactNumber: form.contactNumber?.trim() || null,



        // Include owner fields for backend auto-population



        ownerId: user?.id ?? null,



        createdBy: user?.id ?? null,



      };







      let savedCustomer;



      if (selectedCustomer?.id) {



        savedCustomer = await clientApi.update(selectedCustomer.id, customerPayload);



        //  Broadcast customer update activity

        broadcastActivity(createActivity(

          'CUSTOMER',

          `updated customer (${savedCustomer.name || savedCustomer.customerName || 'Unknown'})`,

          getCurrentUserName(),

          savedCustomer.department || savedCustomer.ownerName || 'Unassigned',

          { id: `customer_${savedCustomer.id}` }

        ));



        // Update addresses using POST for existing customer (backend uses upsert)



        await fetch(`http://localhost:8080/api/clients/${savedCustomer.id}/addresses`, {



          method: 'POST',



          headers: { 'Content-Type': 'application/json' },



          body: JSON.stringify(addresses)



        });



      } else {



        // Create customer first



        savedCustomer = await clientApi.create(customerPayload);



        //  Broadcast customer creation activity

        broadcastActivity(createActivity(

          'CUSTOMER',

          `created customer (${savedCustomer.name || savedCustomer.customerName || 'Unknown'})`,

          getCurrentUserName(),

          savedCustomer.department || savedCustomer.ownerName || 'Unassigned',

          { id: `customer_${savedCustomer.id}` }

        ));



        // Then create addresses using POST for new customer



        await fetch(`http://localhost:8080/api/clients/${savedCustomer.id}/addresses`, {



          method: 'POST',



          headers: { 'Content-Type': 'application/json' },



          body: JSON.stringify(addresses)



        });



      }







      // Save custom field values using our new API



      if (form.customFields && Object.keys(form.customFields).length > 0) {



        await clientApi.bulkUpdateFieldValues(savedCustomer.id, form.customFields);



      }







      // Create/Update associated Deal



      const bankIdNum = form.bankId ? Number(form.bankId) : null;



      const selectedBank = bankIdNum ? banks.find((b) => Number(b?.id) === bankIdNum) : null;







      const dealPayload = {



        name: form.name.trim(),



        clientId: Number(savedCustomer.id),



        bankId: bankIdNum,



        branchName: form.branchName || "",



        relatedBankName: selectedBank?.name || "",



        contactName: form.contactName || "",



        stageCode: form.stage,



        department: formDepartment, //  FIX



        valueAmount: Number(form.valueAmount) || 0,



        closingDate: form.closingDate || null,



        description: form.description || ""



      };







      if (selectedCustomer?.id) {



        //  CRITICAL FIX: Normalize clientId mapping for deal lookup

        const existingDeal = deals.find((deal) => Number(deal?.clientId ?? deal?.client_id) === Number(selectedCustomer.id));



        let savedDeal;

        if (existingDeal) {



          savedDeal = await backendApi.put(`/deals/${existingDeal.id}`, dealPayload);



          //  Broadcast deal update activity

          broadcastActivity(createActivity(

            'DEAL',

            `updated deal (${savedDeal.name || 'Unknown'} - ${savedDeal.clientName || 'Unknown'})`,

            getCurrentUserName(),

            savedDeal.department || savedDeal.ownerName || 'Unassigned',

            { id: `deal_${savedDeal.id}` }

          ));



        } else {



          savedDeal = await backendApi.post("/deals", dealPayload);



          //  Broadcast deal creation activity

          broadcastActivity(createActivity(

            'DEAL',

            `created deal (${savedDeal.name || 'Unknown'} - ${savedDeal.clientName || 'Unknown'})`,

            getCurrentUserName(),

            savedDeal.department || savedDeal.ownerName || 'Unassigned',

            { id: `deal_${savedDeal.id}` }

          ));



        }



        //  Broadcast deal stage change if stage changed

        if (form.stage && existingDeal?.stageCode !== form.stage) {

          broadcastActivity(createActivity(

            'DEAL',

            `Deal stage changed to ${form.stage}`,

            getCurrentUserName(),

            dealPayload.department || dealPayload.ownerName || 'Unassigned',

            { id: `deal_stage_${savedDeal.id || existingDeal.id}` }

          ));

        }



      } else {



        const newDeal = await backendApi.post("/deals", dealPayload);



        //  Broadcast deal creation activity for new customer

        broadcastActivity(createActivity(

          'DEAL',

          `created deal (${newDeal.name || 'Unknown'} - ${newDeal.clientName || 'Unknown'})`,

          getCurrentUserName(),

          newDeal.department || newDeal.ownerName || 'Unassigned',

          { id: `deal_${newDeal.id}` }

        ));



      }







      addToast(selectedCustomer?.id ? "Customer updated successfully" : "Customer created successfully", "success");

      // Reload all data silently after save (single API call)
      await loadAllData(true).catch(() => {});

      // Broadcast to other tabs
      if (typeof window !== 'undefined') {
        const customerId = selectedCustomer?.id || savedCustomer?.id;
        if (customerId && typeof BroadcastChannel !== 'undefined') {
          const channel = new BroadcastChannel('crm-updates');
          channel.postMessage({ type: 'CUSTOMER_UPDATED', customerId, action: selectedCustomer?.id ? 'updated' : 'created', userId: getTabSafeAuthUser()?.id });
          channel.close();
        }
      }







      setForm(makeEmptyForm());







      setFormDepartment("");



      setAvailableStages([]);



      setShowCreateDrawer(false);



      setSelectedCustomer(null);



    } catch (err) {

      const status = getStatusFromError(err);



      if (status === 404) {



        addToast("Customer not found. Reloading list...", "error");



        await fetchCustomers(true);



        setFormDepartment("");



        setAvailableStages([]);



        setShowCreateDrawer(false);



        setSelectedCustomer(null);



        return;



      }



      const errorMsg = err?.data?.message || err?.message || "Unknown error";



      addToast(`Failed to save customer: ${errorMsg}`, "error");



    }



  };









  const handleBulkDelete = async () => {
    if (selectedDealIds.length === 0) return;
    const count = selectedDealIds.length;
    if (!confirm(`Delete ${count} selected customer(s) and all their deals? This cannot be undone.`)) return;
    setBulkDeleting(true);
    try {
      const authUser = getTabSafeAuthUser();
      const res = await fetch('http://localhost:8080/api/clients/bulk', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-User-Id': String(authUser?.id || ''),
          'X-User-Role': authUser?.role || '',
        },
        body: JSON.stringify({ ids: selectedDealIds })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server error ${res.status}`);
      }
      addToast(`${count} customer(s) deleted successfully`, 'success');
      setSelectedDealIds([]);
      await loadAllData(true);
    } catch (err) {
      addToast('Failed to delete: ' + err.message, 'error');
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExportData = () => {
    if (!flatRows.length) { addToast('No data to export', 'error'); return; }

    const headers = [
      'Deal ID', 'Customer Name', 'Email', 'Phone',
      'Contact Person', 'Contact Number',
      'Primary Address', 'City', 'State', 'Pincode',
      'Bank', 'Branch', 'Taluka', 'District',
      'Deal Stage', 'Department', 'Deal Value',
      'Products', 'Closing Date', 'Owner',
      'Created At', 'Updated At',
    ];

    const rows = flatRows.map(({ customer, deal }) => {
      // Deal ID (dealCode like PPE1 or dept+id fallback)
      const dealId = deal?.dealCode
        ? deal.dealCode
        : deal?.department && deal?.id
          ? `${deal.department.toLowerCase()}${deal.id}`
          : deal?.id ? String(deal.id) : '';

      // Bank details
      const bankObj = deal?.bankId ? banks.find(b => Number(b.id) === Number(deal.bankId)) : null;
      const bankName   = deal?.bankName || deal?.relatedBankName || bankObj?.name || '';
      const branchName = deal?.branchName || bankObj?.branchName || '';

      // Primary address (taluka + district now live here)
      const primaryAddr = customer.addresses?.find(a => a.addressType === 'PRIMARY') || customer.addresses?.[0];
      const addressLine = primaryAddr?.addressLine || '';
      const city        = primaryAddr?.city        || '';
      const state       = primaryAddr?.state       || '';
      const pincode     = primaryAddr?.pincode     || '';
      const taluka      = primaryAddr?.taluka      || '';
      const district    = primaryAddr?.district    || '';

      // Stage display name
      const dept = (deal?.department || '').trim();
      const stageCode = (deal?.stageCode || '').toUpperCase();
      const stageStages = getStagesForDepartment(dept) || [];
      const stageObj = stageStages.find(s => s.stageCode === stageCode);
      const stageName = stageObj?.stageName || stageCode;

      // Products  from productNames array returned by /deals/all
      const products = (deal?.productNames || []).join(', ');

      // Deal value
      const dealValue = (deal?.calculatedValue ?? deal?.valueAmount) ? String(deal.calculatedValue ?? deal.valueAmount) : '';

      // Closing date
      const closingDate = deal?.closingDate
        ? new Date(deal.closingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

      // Owner
      const owner = customer.ownerName || '';

      // Dates  formatted as text to prevent Excel treating as date serial (#)
      const fmt = (d) => {
        if (!d) return '';
        const dt = new Date(d);
        const dd = String(dt.getDate()).padStart(2, '0');
        const mm = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][dt.getMonth()];
        return dd + '-' + mm + '-' + dt.getFullYear();
      };
      const createdAt = fmt(customer.createdAt);
      const updatedAt = fmt(customer.updatedAt);

      return [
        dealId,
        customer.name ?? '',
        customer.email ?? '',
        customer.contactPhone ?? '',
        customer.contactName ?? '',
        customer.contactNumber ?? '',
        addressLine,
        city,
        state,
        pincode,
        bankName,
        branchName,
        taluka,
        district,
        stageName,
        dept,
        dealValue,
        products,
        closingDate,
        owner,
        createdAt,
        updatedAt,
      ];
    });

    const csv = [headers, ...rows]
      .map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addToast('Exported ' + flatRows.length + ' records', 'success');
  };

    const handleDelete = async (id) => {



    if (!confirm("Delete this customer?")) return;







    try {



      await clientApi.delete(id);







      // Optimistic remove



      setCustomers((prev) => prev.filter((c) => c.id !== id));







      // Remove associated deal



      //  CRITICAL FIX: Normalize clientId mapping for deal lookup

      const customerDeal = deals.find(deal => Number(deal?.clientId ?? deal?.client_id) === Number(id));



      if (customerDeal) {



        await backendApi.delete(`/deals/${customerDeal.id}`);



        setDeals((prev) => prev.filter((d) => d.id !== customerDeal.id));



      }







      // If editing same customer, close drawer



      if (selectedCustomer?.id === id) {



        setSelectedCustomer(null);



        setShowCreateDrawer(false);



      }







      addToast("Customer deleted successfully", "success");
      // Optimistic  already removed from state above, no full reload needed



    } catch (err) {

      const status = getStatusFromError(err);







      if (status === 404) {



        addToast("Customer already deleted. Refreshing list...", "info");



        setCustomers((prev) => prev.filter((c) => c.id !== id));



        //  CRITICAL FIX: Normalize clientId mapping for deal filtering

        setDeals((prev) => prev.filter((d) => Number(d?.clientId ?? d?.client_id) !== Number(id)));







        if (selectedCustomer?.id === id) {



          setSelectedCustomer(null);



          setShowCreateDrawer(false);



        }







        await loadAllData(true);

        return;



      }







      addToast("Failed to delete customer", "error");



    }



  };







  return (



    <DashboardLayout



      header={{



        project: "Customers",



        user: { name: userName, role: userRole },



        notifications: [],



      }}



    >



      <div className="flex flex-col space-y-4">



        {/* HEADER */}



        <div className="flex flex-wrap items-center justify-between gap-3">



          <div>



            <div className="text-lg font-semibold text-slate-900">Customers</div>



            <p className="text-sm text-slate-500">All customers and deals</p>



          </div>







          <div className="flex items-center gap-3">

            {selectedDealIds.length > 0 && (
              <button
                onClick={handleBulkDelete}
                disabled={bulkDeleting}
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
                <span>{bulkDeleting ? 'Deleting...' : `Delete ${selectedDealIds.length} Selected`}</span>
              </button>
            )}

            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              <Plus className="h-4 w-4" />
              <span>Add Customer</span>
            </button>

            <button
              onClick={handleExportData}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-600 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
            >
              <Download className="h-4 w-4" />
              <span>Export Data</span>
            </button>

            <button
              onClick={() => setShowExcelUploadModal(true)}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              <Upload className="h-4 w-4" />
              <span>Upload Excel</span>
            </button>

          </div>   {/* closes "flex items-center gap-3" */}
        </div>     {/* closes "flex flex-wrap items-center justify-between gap-3" */}

        {/* FILTERS */}
        <div className="space-y-2 mb-2">
          {/* Top row: search + record count */}
          <div className="flex flex-wrap items-center gap-3">
            <SearchBar value={search} onChange={setSearch} />

            {/* Top Department Filter  Admin/Manager only */}
            {isMounted && (userRole === "ADMIN" || userRole === "MANAGER") && (
              <div className="flex items-center gap-2">
                <select
                  value={topDepartmentFilter}
                  onChange={(e) => setTopDepartmentFilter(e.target.value)}
                  className="border border-slate-200 rounded-lg px-3 py-2 text-sm bg-white shadow-sm"
                >
                  <option value="">All Departments</option>
                  {allDepartments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
                {topDepartmentFilter && (
                  <button
                    onClick={() => setTopDepartmentFilter("")}
                    className="text-xs text-red-500 border border-red-200 px-2 py-1 rounded"
                  >
                    Clear
                  </button>
                )}
              </div>
            )}

            {/* Record count badge */}
            <div className="text-sm text-slate-500 shrink-0">
              <span className="font-medium text-slate-700">{flatRows.length}</span>
              {flatRows.length !== deals.length && (
                <span> of {deals.length}</span>
              )} deals
            </div>

            {/* Clear all filters button */}
            {(Object.values(columnFilters).some(s => s && s.size > 0) || search) && (
              <button
                onClick={() => { setColumnFilters({}); setSearch(""); }}
                className="text-xs text-red-500 hover:text-red-700 border border-red-200 hover:border-red-300 rounded-md px-2.5 py-1.5 transition-colors"
              >
                Clear all filters
              </button>
            )}
          </div>

          {/* Active filter chips */}
          {Object.entries(columnFilters).some(([colKey, set]) => {
            if (!set) return false;
            const all = getUniqueColValues(colKey);
            return set.size !== all.length;
          }) && (
              <div className="flex flex-wrap gap-1.5 items-center">
                <span className="text-xs text-slate-400 mr-1">Active:</span>
                {Object.entries(columnFilters).map(([colKey, set]) => {
                  if (!set) return null;
                  const all = getUniqueColValues(colKey);
                  if (set.size === all.length) return null;
                  const labelMap = {
                    name: 'Name', bankName: 'Bank', branchName: 'Branch',
                    taluka: 'Taluka', district: 'District', stageCode: 'Stage',
                    department: 'Dept', ownerName: 'Owner', createdAt: 'Created',
                  };
                  const label = labelMap[colKey] || colKey;
                  return (
                    <span
                      key={colKey}
                      className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs px-2.5 py-1 cursor-pointer hover:bg-blue-100 transition-colors"
                      onClick={() => setColumnFilters(prev => {
                        const n = { ...prev };
                        delete n[colKey];
                        return n;
                      })}
                    >
                      {label}: {set.size} selected
                      <X className="h-3 w-3 opacity-60" />
                    </span>
                  );
                })}
              </div>
            )}
        </div>

        {/* TABLE */}
        {(() => {
          // Compute virtual window
          const maxStart = Math.max(0, flatRows.length - VISIBLE_ROWS);
          const clampedStart = Math.min(Math.max(0, visibleStart), maxStart);
          const visibleEnd = Math.min(flatRows.length, clampedStart + VISIBLE_ROWS + OVERSCAN * 2);
          const paddingTop = clampedStart * ROW_HEIGHT;
          const paddingBottom = Math.max(0, (flatRows.length - visibleEnd) * ROW_HEIGHT);

          return loading ? (
            <div className="text-center py-8">Loading...</div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">


              <div className="overflow-auto" style={{ maxHeight: 'calc(100vh - 220px)' }}>
                <table className="min-w-full divide-y divide-slate-200" style={{ position: 'relative' }}>


                  <thead className="bg-slate-50" style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                    <tr>
                      {/* Select all checkbox */}
                      <th className="px-3 py-3 sticky left-0 bg-slate-50 z-20" style={{ position: 'sticky', left: 0, backgroundColor: 'rgb(248 250 252)', zIndex: 20, width: 40 }}>
                        <input
                          type="checkbox"
                          checked={flatRows.length > 0 && flatRows.every(r => selectedDealIds.includes(r.customer.id))}
                          onChange={e => {
                            const pageIds = flatRows.map(r => r.customer.id);
                            if (e.target.checked) {
                              setSelectedDealIds(prev => [...new Set([...prev, ...pageIds])]);
                            } else {
                              setSelectedDealIds(prev => prev.filter(id => !pageIds.includes(id)));
                            }
                          }}
                          className="cursor-pointer"
                        />
                      </th>
                      {/* Sticky ID column */}
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sticky left-[40px] bg-slate-50 z-20 border-r border-slate-200" style={{ position: 'sticky', left: '40px', backgroundColor: 'rgb(248 250 252)', zIndex: 20 }}>ID</th>

                      {/* Sticky Customer Name column */}
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500 sticky left-[72px] bg-slate-50 z-20 border-r border-slate-200" style={{ position: 'sticky', left: '72px', backgroundColor: 'rgb(248 250 252)', zIndex: 20 }}>
                        Customer Name
                      </th>

                      {/* Filterable columns  use ColFilterTh */}
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Address</th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Phone + Contact</th>
                      <ColFilterTh label="Bank" colKey="bankName"   {...colFilterProps} />
                      <ColFilterTh label="Branch" colKey="branchName" {...colFilterProps} />
                      <ColFilterTh label="Taluka" colKey="taluka"     {...colFilterProps} />
                      <ColFilterTh label="District" colKey="district"   {...colFilterProps} />
                      <ColFilterTh label="Dept / Stage" colKey="stageCode"  {...colFilterProps} />
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Deal Value</th>
                      <ColFilterTh label="Owner" colKey="ownerName"  {...colFilterProps} />
                      <ColFilterTh label="Department" colKey="department" {...colFilterProps} />
                      <ColFilterTh label="Created At" colKey="createdAt" {...colFilterProps} />
                      <ColFilterTh label="Updated At" colKey="updatedAt" {...colFilterProps} />
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">Closing Date</th>



                      {/* Dynamic address type columns */}
                      


                      


                      {dynamicColumns.map(col => (
                        <th key={col} className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                          {formatLabel(col)}
                        </th>
                      ))}



                      <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-200 bg-white" ref={tbodyRef}>
                    {/* spacer row above */}
                    {paddingTop > 0 && (
                      <tr style={{ height: paddingTop }}>
                        <td colSpan={99} />
                      </tr>
                    )}

                    {flatRows.slice(clampedStart, visibleEnd).map(({ customer, deal: rowDeal }, _rowIdx) => {



                      const customerDeal = rowDeal;






                      // FIX 3  Normalise stageCode to UPPERCASE for consistent matching
                      const rawStageCode = customerDeal?.stageCode ?? customerDeal?.stage ?? "";
                      const normStageCode = rawStageCode.toUpperCase();
                      const dealDepartment = (customerDeal?.department ?? "").trim();

                      // FIX 2  Resolve bank details from the deal object (not bankId alone)
                      const bankDetails     = getBankDetails(customerDeal);
                      const customerLocation = getCustomerLocation(customer);


                      return (



                        <tr key={rowDeal ? `${customer.id}-${rowDeal.id}` : String(customer.id)} className="hover:bg-slate-50" style={{ height: ROW_HEIGHT }}>



                          {/* Row checkbox */}
                          <td className="px-3 py-4 sticky left-0 bg-white z-10" style={{ position: 'sticky', left: 0, backgroundColor: 'white', zIndex: 10, width: 40 }}>
                            <input
                              type="checkbox"
                              checked={selectedDealIds.includes(customer.id)}
                              onChange={e => {
                                if (e.target.checked) {
                                  setSelectedDealIds(prev => prev.includes(customer.id) ? prev : [...prev, customer.id]);
                                } else {
                                  setSelectedDealIds(prev => prev.filter(id => id !== customer.id));
                                }
                              }}
                              className="cursor-pointer"
                            />
                          </td>
                          {/* Sticky ID column */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 sticky left-[40px] bg-white z-10 border-r border-slate-200" style={{ position: 'sticky', left: '40px', backgroundColor: 'white', zIndex: 10 }}>
                            {customerDeal?.dealCode ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-100 text-indigo-800">
                                {customerDeal.dealCode.toLowerCase()}
                              </span>
                            ) : customerDeal?.department && customerDeal?.id ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700">
                                {customerDeal.department.toLowerCase()}{customerDeal.id}
                              </span>
                            ) : customerDeal?.id ? (
                              <span className="text-slate-400 text-xs">#{customerDeal.id}</span>
                            ) : "-"}
                          </td>



                          {/* Sticky Customer Name column */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900 sticky left-[72px] bg-white z-10 border-r border-slate-200" style={{ position: 'sticky', left: '72px', backgroundColor: 'white', zIndex: 10 }}>

                            <Link href={`/customers/${customer.id}`} className="hover:underline">

                              {customer.name}

                            </Link>

                          </td>














                          {/* Address column */}
                          <td className="px-6 py-4 text-sm text-slate-700" style={{ maxWidth: 220 }}>
                            <span title={getFullAddress(customer)} style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {getFullAddress(customer)}
                            </span>
                          </td>

                          {/* Phone + Contact Person column */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            <div className="flex flex-col">
                              <span>{customer.contactPhone || "-"}</span>
                              <span className="text-xs text-gray-500">
                                {customer.contactName || "-"}
                              </span>
                            </div>
                          </td>







                          






                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{bankDetails.name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{bankDetails.branch}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{customerLocation.taluka}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">{customerLocation.district}</td>

                          {/* Deal Stage */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex flex-col gap-0.5">
                              {dealDepartment && (
                                <span className="text-xs font-semibold text-slate-700">{dealDepartment}</span>
                              )}
                              {normStageCode ? (
                                <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${getDealStageStyle(normStageCode, dealDepartment).bg} ${getDealStageStyle(normStageCode, dealDepartment).text} ${getDealStageStyle(normStageCode, dealDepartment).border}`}>
                                  {getStageDisplayName(normStageCode, dealDepartment)}
                                </span>
                              ) : (
                                <span className="text-slate-400">-</span>
                              )}
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {(() => {
                              const v = customerDeal?.calculatedValue ?? customerDeal?.valueAmount;
                              if (!v && v !== 0) return "-";
                              const n = Number(v);
                              return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(n);
                            })()}
                          </td>

                          {/* Owner */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {formatOwnerDisplay(customer)}
                          </td>

                          {/* Department */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {dealDepartment || "-"}
                          </td>

                          {/* Created At */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {customer.createdAt ? new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                          </td>

                          {/* Updated At */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {customer.updatedAt ? new Date(customer.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                          </td>



                          


                          {dynamicColumns.map((col) => (



                            <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">



                              {customer.customFields?.[col] || "-"}



                            </td>



                          ))}







                          
                          {/* Closing Date column */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                            {customerDeal?.closingDate ? new Date(customerDeal.closingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : "-"}
                          </td>

                          <td className="px-6 py-4 whitespace-nowrap text-center text-sm font-medium">



                            <div className="flex items-center justify-center gap-2">



                              <button



                                onClick={() => openEdit(customer)}



                                className="text-blue-600 hover:text-blue-900"



                                title="Edit"



                              >



                                <Edit2 className="h-4 w-4" />



                              </button>




                              <button


                                onClick={() => handleDelete(customer.id)}



                                className="text-red-600 hover:text-red-900"



                                title="Delete"



                              >



                                <Trash2 className="h-4 w-4" />



                              </button>



                            </div>



                          </td>



                        </tr>



                      );



                    })}

                    {/* spacer row below */}
                    {paddingBottom > 0 && (
                      <tr style={{ height: paddingBottom }}>
                        <td colSpan={99} />
                      </tr>
                    )}

                    {!flatRows.length && (
                      <tr>
                        <td
                          colSpan={5 + getAllAddressTypes().filter(type => type !== 'PRIMARY').length + dynamicColumns.length}
                          className="px-6 py-8 text-center text-sm text-slate-500"
                        >
                          No customers found
                        </td>
                      </tr>
                    )}



                  </tbody>



                </table>



              </div>
            </div>
          );
        })()}

        {/*  CREATE/EDIT DRAWER  rendered outside main render tree to prevent table re-renders */}
        {showCreateDrawer && (
          <DrawerPortal
            form={form}
            setForm={setForm}
            formDepartment={formDepartment}
            setFormDepartment={setFormDepartment}
            availableStages={availableStages}
            setAvailableStages={setAvailableStages}
            deptSearch={deptSearch}
            setDeptSearch={setDeptSearch}
            banks={banks}
            departments={departments}
            fetchStagesForDepartment={fetchStagesForDepartment}
            selectedCustomer={selectedCustomer}
            clientFieldDefinitions={clientFieldDefinitions}
            pendingStageChange={pendingStageChange}
            setPendingStageChange={setPendingStageChange}
            showAccountTransferDialog={showAccountTransferDialog}
            setShowAccountTransferDialog={setShowAccountTransferDialog}
            onClose={() => setShowCreateDrawer(false)}
            onSave={handleCreateOrUpdate}
            addToast={addToast}
          />
        )}








{/* DETAILS DRAWER */}
        {showDetailsDrawer && selectedCustomer && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm"
              onClick={() => setShowDetailsDrawer(false)}
            />
            <div className="fixed inset-0 z-[70] flex justify-end">
              <div className="relative w-full max-w-md h-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out flex flex-col">
                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 shrink-0">
                  <h2 className="text-lg font-semibold text-slate-900">Customer Details</h2>
                  <button
                    onClick={() => setShowDetailsDrawer(false)}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-sm font-medium text-slate-900 mb-3">Customer Information</h3>
                      <div className="space-y-3">
                        <div className="flex items-start gap-3">
                          <User className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">Name</div>
                            <div className="text-sm text-slate-600">{selectedCustomer.name}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Mail className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">Email</div>
                            <div className="text-sm text-slate-600">{selectedCustomer.email || "-"}</div>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div>
                            <div className="text-sm font-medium text-slate-900">Phone</div>
                            <div className="text-sm text-slate-600">{selectedCustomer.contactPhone || "-"}</div>
                          </div>
                        </div>

                        {(selectedCustomer.contactName || selectedCustomer.contactNumber) && (
                          <div className="flex items-start gap-3">
                            <User className="h-4 w-4 text-slate-400 mt-0.5" />
                            <div>
                              <div className="text-sm font-medium text-slate-900">Contact Person</div>
                              {selectedCustomer.contactName && (
                                <div className="text-sm text-slate-600">{selectedCustomer.contactName}</div>
                              )}
                              {selectedCustomer.contactNumber && (
                                <div className="text-sm text-slate-600">{selectedCustomer.contactNumber}</div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-start gap-3">
                          <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                          <div className="w-full">
                            <div className="text-sm font-medium text-slate-900">Addresses</div>
                            {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (
                              <div className="space-y-2 mt-1">
                                {selectedCustomer.addresses
                                  .slice()
                                  .sort((a, b) => {
                                    const order = ["PRIMARY", "POLICE", "BRANCH", "TAHSIL"];
                                    return order.indexOf(a.addressType) - order.indexOf(b.addressType);
                                  })
                                  .map((addr) => (
                                    <div key={addr.id} className="flex items-start gap-2">
                                      {getAddressTypeIcon(addr.addressType)}
                                      <div>
                                        <span className="text-sm font-medium text-slate-900">
                                          {getAddressTypeDisplayName(addr.addressType)}:
                                        </span>{" "}
                                        <span className="text-sm text-slate-700">
                                          {addr.addressLine}, {addr.city}
                                        </span>
                                        {addr.pincode && (
                                          <span className="text-slate-500">, {addr.pincode}</span>
                                        )}
                                      </div>
                                    </div>
                                  ))}
                              </div>
                            ) : (
                              <div className="text-sm text-slate-500">No addresses found</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Deal Info */}
                    {(() => {
                      const customerDeal = deals.find(
                        (deal) =>
                          Number(deal?.clientId ?? deal?.client_id) === Number(selectedCustomer.id)
                      );
                      if (!customerDeal) return null;
                      return (
                        <div>
                          <h3 className="text-sm font-medium text-slate-900 mb-3">Deal Information</h3>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <DollarSign className="h-4 w-4 text-slate-400 mt-0.5" />
                              <div>
                                <div className="text-sm font-medium text-slate-900">Amount</div>
                                <div className="text-sm text-slate-600">${customerDeal.valueAmount || 0}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-3">
                              <Building className="h-4 w-4 text-slate-400 mt-0.5" />
                              <div>
                                <div className="text-sm font-medium text-slate-900">Stage</div>
                                <div className="text-sm text-slate-600">
                                  {getStageDisplayName(customerDeal.stageCode, customerDeal.department)}
                                </div>
                                {customerDeal.department && (
                                  <div className="text-xs text-slate-500">{customerDeal.department}</div>
                                )}
                              </div>
                            </div>

                            {selectedCustomer.addresses && selectedCustomer.addresses.filter((a) => a.addressType !== "PRIMARY").length > 0 && (
                              <div className="flex items-start gap-3">
                                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div className="w-full">
                                  <div className="text-sm font-medium text-slate-900">Related Addresses</div>
                                  <div className="space-y-2 mt-2">
                                    {selectedCustomer.addresses
                                      .filter((addr) => addr.addressType !== "PRIMARY")
                                      .sort((a, b) => {
                                        const order = ["POLICE", "BRANCH", "TAHSIL"];
                                        return order.indexOf(a.addressType) - order.indexOf(b.addressType);
                                      })
                                      .map((addr) => (
                                        <div key={addr.id} className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                                          <div className="flex items-center gap-2 mb-2">
                                            {getAddressTypeIcon(addr.addressType)}
                                            <span className="font-medium text-slate-900 text-sm">
                                              {getAddressTypeDisplayName(addr.addressType)}
                                            </span>
                                          </div>
                                          <div className="text-sm text-slate-700">
                                            {addr.addressLine}
                                            {addr.city && <span>, {addr.city}</span>}
                                            {addr.pincode && <span>, {addr.pincode}</span>}
                                          </div>
                                          {addr.latitude && addr.longitude && (
                                            <div className="text-xs text-slate-500 mt-2 flex items-center gap-1">
                                              <MapPin className="h-3 w-3" />
                                              {Number(addr.latitude).toFixed(6)}, {Number(addr.longitude).toFixed(6)}
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                  </div>
                                </div>
                              </div>
                            )}

                            {customerDeal.closingDate && (
                              <div className="flex items-start gap-3">
                                <Calendar className="h-4 w-4 text-slate-400 mt-0.5" />
                                <div>
                                  <div className="text-sm font-medium text-slate-900">Closing Date</div>
                                  <div className="text-sm text-slate-600">{customerDeal.closingDate}</div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Custom Fields */}
                    {selectedCustomer.customFields &&
                      Object.keys(selectedCustomer.customFields).length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-slate-900 mb-3">Custom Fields</h3>
                          <div className="space-y-2">
                            {Object.entries(selectedCustomer.customFields).map(([key, value]) => (
                              <div key={key} className="flex justify-between">
                                <span className="text-sm font-medium text-slate-700">{formatLabel(key)}:</span>
                                <span className="text-sm text-slate-600">{value || "-"}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Excel Upload Modal */}
        <CustomerExcelUploadModal
          isOpen={showExcelUploadModal}
          onClose={() => setShowExcelUploadModal(false)}
          onUploadSuccess={(result) => {
            addToast(`Successfully imported ${result.success} customers/deals`, "success");
            loadAllData(true);
            setShowExcelUploadModal(false);
          }}
        />

        {/* Account Transfer Confirmation Dialog */}
        <AccountTransferDialog
          isOpen={showAccountTransferDialog}
          dealName={form.name || "Untitled Deal"}
          customerName={form.name || "Unknown Customer"}
          onConfirm={async () => {
            setForm({ ...form, stage: pendingStageChange });
            setShowAccountTransferDialog(false);
            setPendingStageChange(null);
            addToast("Deal will be transferred to Accounts when saved", "info");
          }}
          onCancel={() => {
            setShowAccountTransferDialog(false);
            setPendingStageChange(null);
          }}
        />
      </div>
    </DashboardLayout>
  );
}


function DrawerPortal({
  form, setForm, formDepartment, setFormDepartment,
  availableStages, setAvailableStages,
  deptSearch, setDeptSearch,
  banks, departments, fetchStagesForDepartment,
  selectedCustomer, clientFieldDefinitions,
  pendingStageChange, setPendingStageChange,
  showAccountTransferDialog, setShowAccountTransferDialog,
  onClose, onSave, addToast,
}) {
  // ── Bank / Branch two-level state (managed internally) ───────────────────
  const [bankNameSearch, setBankNameSearch] = useState("");
  const [branchSearch,   setBranchSearch]   = useState("");
  const [selectedBankName, setSelectedBankName] = useState("");

  // Unique bank names
  const uniqueBankNames = useMemo(() => {
    return [...new Set(banks.map(b => b.name).filter(Boolean))].sort();
  }, [banks]);

  // Branches for selected bank
  const branchesForBank = useMemo(() => {
    if (!selectedBankName) return [];
    return banks.filter(b => b.name === selectedBankName);
  }, [banks, selectedBankName]);

  // When editing, init selectedBankName from form.bankId
  useEffect(() => {
    if (form.bankId && banks.length > 0) {
      const found = banks.find(b => String(b.id) === String(form.bankId));
      if (found && found.name) setSelectedBankName(found.name);
    }
  }, [form.bankId, banks]);

  const handleAddressToggle = (addressType, enabled) => {
    setForm(prev => ({
      ...prev,
      addresses: {
        ...prev.addresses,
        [addressType]: {
          ...prev.addresses[addressType],
          enabled,
          ...(enabled ? {} : { addressLine: '', city: '', state: '', pincode: '', taluka: '', district: '', latitude: '', longitude: '' })
        }
      }
    }));
  };

  const handleAddressFieldChange = (addressType, field, value) => {
    setForm(prev => ({
      ...prev,
      addresses: { ...prev.addresses, [addressType]: { ...prev.addresses[addressType], [field]: value } }
    }));
  };

  const handleGeocode = async (addressType) => {
    const addr = form.addresses[addressType];
    if (!addr.addressLine?.trim()) { addToast('Enter address first', 'warning'); return; }
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'https://api.yashrajent.com'}/api/clients/geocode`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ addressLine: addr.addressLine, city: addr.city, pincode: addr.pincode, state: addr.state, country: 'India' })
      });
      const data = await res.json();
      if (data.success) {
        setForm(prev => ({ ...prev, addresses: { ...prev.addresses, [addressType]: { ...prev.addresses[addressType], latitude: String(data.latitude), longitude: String(data.longitude) } } }));
        addToast('Geocoded successfully!', 'success');
      } else { addToast(data.message || 'Could not geocode', 'warning'); }
    } catch { addToast('Geocoding failed', 'error'); }
  };

  const AddressBlock = ({ type, label }) => (
    <div className="p-4 border border-slate-200 rounded-lg bg-slate-50/50">
      <div className="flex items-center mb-3">
        {type !== 'primary' && (
          <input type="checkbox" checked={form.addresses[type]?.enabled || false}
            onChange={e => handleAddressToggle(type, e.target.checked)} className="mr-2" />
        )}
        <label className="text-sm font-medium text-slate-700">{label}</label>
      </div>
      {(type === 'primary' || form.addresses[type]?.enabled) && (
        <div className="space-y-3">
          <textarea value={form.addresses[type]?.addressLine || ''} rows={2}
            onChange={e => handleAddressFieldChange(type, 'addressLine', e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none resize-none"
            placeholder="Address line" />
          <div className="grid grid-cols-3 gap-2">
            {['city', 'state', 'pincode'].map(f => (
              <input key={f} type="text" value={form.addresses[type]?.[f] || ''}
                onChange={e => handleAddressFieldChange(type, f, e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                placeholder={f.charAt(0).toUpperCase() + f.slice(1)} />
            ))}
          </div>
          {/* Taluka + District */}
          <div className="grid grid-cols-2 gap-2">
            <input type="text" value={form.addresses[type]?.taluka || ''}
              onChange={e => handleAddressFieldChange(type, 'taluka', e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Taluka" />
            <input type="text" value={form.addresses[type]?.district || ''}
              onChange={e => handleAddressFieldChange(type, 'district', e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="District" />
          </div>
          {/* Lat / Lng / Geocode */}
          <div className="grid grid-cols-3 gap-2">
            <input type="number" step="any" value={form.addresses[type]?.latitude || ''}
              onChange={e => handleAddressFieldChange(type, 'latitude', e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Latitude" />
            <input type="number" step="any" value={form.addresses[type]?.longitude || ''}
              onChange={e => handleAddressFieldChange(type, 'longitude', e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              placeholder="Longitude" />
            <button type="button" onClick={() => handleGeocode(type)}
              className="flex items-center justify-center gap-1 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">
              <MapPin className="h-3.5 w-3.5" /> Geocode
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
        <div className="relative w-full max-w-3xl h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">
          <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 shrink-0">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{selectedCustomer ? 'Edit Customer' : 'Create Customer'}</h2>
              <p className="mt-1 text-sm text-slate-500">{selectedCustomer ? 'Update customer information' : 'Add a new customer and deal'}</p>
            </div>
            <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600">
              <X className="h-5 w-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-6">
              <div>
                <h3 className="text-base font-medium text-slate-900 mb-4 flex items-center gap-2"><User className="h-4 w-4" /> Customer Information</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[['name','text','Customer Name *'],['email','email','Email'],['phone','tel','Phone'],['contactName','text','Contact Person'],['contactNumber','tel','Contact Number']].map(([field, type, label]) => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-slate-700 mb-2">{label}</label>
                      <input type={type} value={form[field] || ''} onChange={e => setForm(prev => ({ ...prev, [field]: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                        placeholder={label.replace(' *','')} />
                    </div>
                  ))}
                </div>
                <div className="mt-4 space-y-4">
                  <AddressBlock type="primary" label="Primary Address (Default Tracking) *" />
                  <AddressBlock type="police" label="Police Station Address" />
                  <AddressBlock type="branch" label="Branch Address" />
                  <AddressBlock type="tahsil" label="Tahsil Address" />
                </div>
              </div>

              <div>
                <h3 className="text-base font-medium text-slate-900 mb-4 flex items-center gap-2"><DollarSign className="h-4 w-4" /> Deal Information</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Department <span className="text-rose-500">*</span></label>
                    <input type="text" placeholder="Search department..." value={deptSearch}
                      onChange={e => setDeptSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none mb-1" />
                    <select value={formDepartment} onChange={async e => {
                      const dept = e.target.value; setFormDepartment(dept); setDeptSearch('');
                      setForm(prev => ({ ...prev, stage: '' }));
                      if (dept) { const s = await fetchStagesForDepartment(dept); setAvailableStages(s || []); } else setAvailableStages([]);
                    }} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                      <option value="">Select Department</option>
                      {Array.isArray(departments) && departments.filter(d => d.toLowerCase().includes(deptSearch.toLowerCase())).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Deal Stage <span className="text-rose-500">*</span></label>
                    <select value={form.stage} disabled={!formDepartment} onChange={e => {
                      const s = e.target.value;
                      if (s === 'ACCOUNT') { setPendingStageChange(s); setShowAccountTransferDialog(true); return; }
                      setForm(prev => ({ ...prev, stage: s }));
                    }} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm disabled:bg-slate-100 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20">
                      <option value="">Select Stage</option>
                      {availableStages.map(s => <option key={s.stageCode} value={s.stageCode}>{s.stageName}</option>)}
                    </select>
                  </div>
                  {/* Bank (unique names) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Bank</label>
                    <input type="text" placeholder="Search bank..." value={bankNameSearch}
                      onChange={e => setBankNameSearch(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none mb-1" />
                    <select value={selectedBankName}
                      onChange={e => {
                        const name = e.target.value;
                        setSelectedBankName(name);
                        setBankNameSearch('');
                        setForm(prev => ({ ...prev, bankId: '', branchName: '' }));
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none">
                      <option value="">Select Bank</option>
                      {uniqueBankNames
                        .filter(n => !bankNameSearch || n.toLowerCase().includes(bankNameSearch.toLowerCase()))
                        .map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>

                  {/* Branch (filtered by selected bank) */}
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Branch</label>
                    <input type="text" placeholder="Search branch..." value={branchSearch}
                      onChange={e => setBranchSearch(e.target.value)}
                      disabled={!selectedBankName}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none mb-1 disabled:bg-slate-100" />
                    <select value={form.bankId || ''}
                      disabled={!selectedBankName}
                      onChange={e => {
                        const bank = banks.find(b => String(b.id) === String(e.target.value));
                        if (bank) {
                          setForm(prev => ({ ...prev, bankId: String(bank.id), branchName: bank.branchName || '' }));
                          setBranchSearch('');
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none disabled:bg-slate-100">
                      <option value="">{selectedBankName ? 'Select Branch' : 'Select a bank first'}</option>
                      {branchesForBank
                        .filter(b => !branchSearch || (b.branchName || '').toLowerCase().includes(branchSearch.toLowerCase()))
                        .map(b => <option key={b.id} value={String(b.id)}>{b.branchName || b.name || `Branch #${b.id}`}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Deal Value</label>
                    <input type="number" step="0.01" min="0" value={form.valueAmount || ''} onChange={e => setForm(prev => ({ ...prev, valueAmount: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" placeholder="0.00" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-2">Closing Date</label>
                    <input type="date" value={form.closingDate || ''} onChange={e => setForm(prev => ({ ...prev, closingDate: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none" />
                  </div>
                </div>
                <div className="mt-4">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Description</label>
                  <textarea value={form.description || ''} onChange={e => setForm(prev => ({ ...prev, description: e.target.value }))} rows={3}
                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:outline-none resize-none" placeholder="Deal description and notes" />
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 px-6 py-4 shrink-0">
            <div className="flex items-center justify-between">
              <div className="text-sm text-slate-500"><span className="text-rose-500">*</span> Required fields</div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Cancel</button>
                <button type="button" onClick={onSave} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700">
                  {selectedCustomer ? 'Update Customer' : 'Create Customer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}


// Memoized search bar  isolated so typing never re-renders the table
const SearchBar = React.memo(function SearchBar({ value, onChange }) {
  const [local, setLocal] = React.useState(value);
  const timerRef = React.useRef(null);

  // Keep local in sync when parent clears search
  React.useEffect(() => { setLocal(value); }, [value]);

  const handleChange = (e) => {
    const v = e.target.value;
    setLocal(v);
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => onChange(v), 150);
  };

  const handleClear = () => {
    setLocal('');
    clearTimeout(timerRef.current);
    onChange('');
  };

  return (
    <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 flex-1 max-w-md bg-white shadow-sm">
      <Search size={16} className="text-slate-400 shrink-0" />
      <input
        type="text"
        placeholder="Search by name or phone..."
        value={local}
        onChange={handleChange}
        className="flex-1 outline-none text-sm bg-transparent text-slate-900 placeholder:text-slate-400"
      />
      {local && (
        <button onClick={handleClear} className="text-slate-400 hover:text-slate-600">
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
});

function ColFilterTh({
  label,
  colKey,
  openFilterCol,
  setOpenFilterCol,
  columnFilters,
  filterSearch,
  setFilterSearch,
  getUniqueColValues,
  toggleColFilterValue,
  selectAllColValues,
  clearAllColValues,
  isColFilterActive,
  handleColSort,
  sortConfig,
}) {
  const isOpen = openFilterCol === colKey;
  const isActive = isColFilterActive(colKey);
  const isAsc = sortConfig.key === colKey && sortConfig.dir === "asc";
  const isDesc = sortConfig.key === colKey && sortConfig.dir === "desc";
  const searchVal = filterSearch[colKey] || "";
  const allVals = getUniqueColValues(colKey);
  const allowed = columnFilters[colKey] ?? new Set(allVals);
  const visible = allVals.filter((v) => v.toLowerCase().includes(searchVal.toLowerCase()));

  return (
    <th
      className="col-filter-th"
      style={{
        padding: "10px 12px",
        textAlign: "left",
        fontWeight: 500,
        fontSize: 11,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: isActive ? "#185FA5" : undefined,
        borderBottom: "0.5px solid var(--color-border-tertiary)",
        whiteSpace: "nowrap",
        position: "relative",
        userSelect: "none",
        background: isOpen ? "var(--color-background-secondary)" : undefined,
        cursor: "pointer",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <span
          onClick={() => handleColSort(colKey)}
          style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}
        >
          {label}
          <span style={{ fontSize: 10, opacity: 0.5 }}>
            {isAsc ? "" : isDesc ? "" : ""}
          </span>
        </span>
        <span
          onClick={(e) => {
            e.stopPropagation();
            setOpenFilterCol(isOpen ? null : colKey);
            setFilterSearch((prev) => ({ ...prev, [colKey]: "" }));
          }}
          title="Filter column"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: 20,
            height: 20,
            borderRadius: 4,
            background: isActive
              ? "#185FA5"
              : isOpen
              ? "var(--color-border-tertiary)"
              : "transparent",
            color: isActive ? "#fff" : "var(--color-text-secondary)",
            fontSize: 11,
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          
        </span>
        {isActive && (
          <span
            style={{
              background: "#185FA5",
              color: "#fff",
              borderRadius: 999,
              fontSize: 9,
              padding: "1px 5px",
              flexShrink: 0,
            }}
          >
            {allowed.size}
          </span>
        )}
      </div>

      {isOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "absolute",
            top: "100%",
            left: 0,
            zIndex: 9999,
            background: "#ffffff",
            border: "0.5px solid var(--color-border-secondary)",
            borderRadius: "var(--border-radius-lg)",
            boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
            padding: 12,
            minWidth: 220,
            fontWeight: 400,
            fontSize: 13,
          }}
        >
          <input
            type="text"
            placeholder={`Search ${label}...`}
            value={searchVal}
            onChange={(e) =>
              setFilterSearch((prev) => ({ ...prev, [colKey]: e.target.value }))
            }
            autoFocus
            style={{
              width: "100%",
              boxSizing: "border-box",
              fontSize: 12,
              padding: "6px 8px",
              border: "0.5px solid var(--color-border-secondary)",
              borderRadius: "var(--border-radius-md)",
              marginBottom: 8,
              background: "var(--color-background-secondary)",
              color: "var(--color-text-primary)",
              outline: "none",
            }}
          />
          <div
            style={{
              maxHeight: 180,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 3,
            }}
          >
            {visible.length === 0 && (
              <div
                style={{
                  color: "var(--color-text-secondary)",
                  fontSize: 12,
                  padding: "4px 0",
                }}
              >
                No results
              </div>
            )}
            {visible.map((val) => (
              <label
                key={val}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  cursor: "pointer",
                  fontSize: 12,
                  padding: "2px 0",
                }}
              >
                <input
                  type="checkbox"
                  checked={allowed.has(val)}
                  onChange={() => toggleColFilterValue(colKey, val)}
                  style={{ cursor: "pointer" }}
                />
                <span style={{ color: "var(--color-text-primary)" }}>{val}</span>
              </label>
            ))}
          </div>
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: 10,
              borderTop: "0.5px solid var(--color-border-tertiary)",
              paddingTop: 10,
            }}
          >
            <button
              onClick={() => selectAllColValues(colKey)}
              style={{
                flex: 1,
                fontSize: 11,
                padding: "5px 0",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                border: "0.5px solid var(--color-border-secondary)",
                background: "transparent",
                color: "var(--color-text-primary)",
              }}
            >
              Select all
            </button>
            <button
              onClick={() => clearAllColValues(colKey)}
              style={{
                flex: 1,
                fontSize: 11,
                padding: "5px 0",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                border: "0.5px solid var(--color-border-secondary)",
                background: "transparent",
                color: "var(--color-text-primary)",
              }}
            >
              Clear
            </button>
            <button
              onClick={() => setOpenFilterCol(null)}
              style={{
                flex: 1,
                fontSize: 11,
                padding: "5px 0",
                borderRadius: "var(--border-radius-md)",
                cursor: "pointer",
                border: "none",
                background: "#185FA5",
                color: "#fff",
              }}
            >
              Done
            </button>
          </div>
        </div>
      )}
    </th>
  );
}

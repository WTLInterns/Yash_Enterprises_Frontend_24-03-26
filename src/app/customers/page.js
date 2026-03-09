"use client";



import React, { useState, useEffect } from 'react';

import { Search, Edit2, Trash2, Eye, Settings, X, Plus, Calendar, DollarSign, Building, User, Phone, Mail, MapPin, Map, Home, Shield, Upload } from "lucide-react";

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

import { useCustomerAddressSync } from "@/context/CustomerAddressContext";

import { useStages } from "@/context/StageContext";

import CustomerExcelUploadModal from "@/components/excel/CustomerExcelUploadModal";
import AccountTransferDialog from "@/components/common/AccountTransferDialog";

export default function CustomersPage() {
  const { addToast } = useToast();

  const { version } = useCustomerAddressSync();

  const { departments, getStagesForDepartment, fetchStagesForDepartment, fetchDepartments } = useStages();

  // 🔥 CRITICAL FIX: Use tab-safe storage for multi-tab login isolation
  const [userName, setUserName] = useState(() => {
    if (typeof window === 'undefined') return "Admin User";
    try {
      let rawUserData = getTabSafeItem("user_data");
      if (!rawUserData) {
        rawUserData = localStorage.getItem("user_data");
      }
      const user = rawUserData ? JSON.parse(rawUserData) : null;
      return user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Admin User";
    } catch {
      return "Admin User";
    }
  });

  const [userRole, setUserRole] = useState(() => {
    if (typeof window === 'undefined') return "ADMIN";
    try {
      let role = getTabSafeItem("user_role");
      if (!role) {
        role = localStorage.getItem("user_role");
      }
      return role || "ADMIN";
    } catch {
      return "ADMIN";
    }
  });

  // 🔥 CRITICAL: Cross-tab user data sync
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleStorageChange = (e) => {
      if (e.key === 'user_data' || e.key === 'user_role') {
        // Update local state when user data changes in another tab
        try {
          let rawUserData = getTabSafeItem("user_data");
          if (!rawUserData) {
            rawUserData = localStorage.getItem("user_data");
          }
          const user = rawUserData ? JSON.parse(rawUserData) : null;
          setUserName(user?.fullName || `${user?.firstName || ""} ${user?.lastName || ""}`.trim() || "Admin User");
          
          let role = getTabSafeItem("user_role");
          if (!role) {
            role = localStorage.getItem("user_role");
          }
          setUserRole(role || "ADMIN");
        } catch (error) {
          console.error("Error updating user data from storage:", error);
        }
      }
    };

    // Listen for BroadcastChannel messages for real-time updates
    let broadcastChannel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      broadcastChannel = new BroadcastChannel('crm-updates');
      broadcastChannel.onmessage = (e) => {
        if (e.data?.type === 'CUSTOMER_UPDATED') {
          console.log("🔄 Customer updated in another tab, refreshing list...");
          fetchCustomers();
        }
        
        if (e.data?.type === 'DEAL_STAGE_CHANGED') {
          console.log("🔄 Deal stage changed in another tab, refreshing deals...");
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

  // 🔥 CRITICAL: Tab-safe auth user function
  const getTabSafeAuthUser = () => {
    if (typeof window === 'undefined') return null;
    try {
      let rawUserData = getTabSafeItem("user_data");
      if (!rawUserData) {
        rawUserData = localStorage.getItem("user_data");
      }
      return rawUserData ? JSON.parse(rawUserData) : null;
    } catch (error) {
      console.error("Error getting auth user:", error);
      return null;
    }
  };

  const [customers, setCustomers] = useState([]);

  const [banks, setBanks] = useState([]);

  const [deals, setDeals] = useState([]);

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [showCreateDrawer, setShowCreateDrawer] = useState(false);

  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);

  const [selectedCustomer, setSelectedCustomer] = useState(null);

  const [dynamicColumns, setDynamicColumns] = useState([]);

  const [clientFieldDefinitions, setClientFieldDefinitions] = useState([]);

  const [showExcelUploadModal, setShowExcelUploadModal] = useState(false);

  // 🎯 Account transfer dialog state
  const [showAccountTransferDialog, setShowAccountTransferDialog] = useState(false);
  const [pendingStageChange, setPendingStageChange] = useState(null);



  // For table filters

  const [filterDepartment, setFilterDepartment] = useState("");

  const [filterStage, setFilterStage] = useState("");

  const [filterAvailableStages, setFilterAvailableStages] = useState([]);



  // For create/edit form

  const [formDepartment, setFormDepartment] = useState("");

  const [availableStages, setAvailableStages] = useState([]);

  

  const [form, setForm] = useState({

    name: "",

    email: "",

    phone: "",

    addresses: {

        primary: {

          enabled: true,

          addressLine: "",

          city: "",

          pincode: "",

          latitude: "",

          longitude: ""

        },

        branch: {

          enabled: false,

          id: null,

          addressLine: "",

          city: "",

          pincode: "",

          latitude: "",

          longitude: ""

        },

        police: {

          enabled: false,

          id: null,

          addressLine: "",

          city: "",

          pincode: "",

          latitude: "",

          longitude: ""

        },

        tahsil: {

          enabled: false,

          id: null,

          addressLine: "",

          city: "",

          pincode: "",

          latitude: "",

          longitude: ""

        }

      },

    contactName: "",

    contactNumber: "",

    bankId: "",

    branchName: "",

    stage: "",

    valueAmount: "",

    closingDate: "",

    description: "",

    customFields: {}

  });


  // Load stages for deal form when department changes (create/edit)
  useEffect(() => {
    if (!formDepartment) {
      setAvailableStages([]);
      setForm(prev => ({ ...prev, stage: "" }));
      return;
    }

    let cancelled = false;
    fetchStagesForDepartment(formDepartment)
      .then(stages => {
        if (!cancelled) setAvailableStages(stages || []);
      })
      .catch(() => {
        if (!cancelled) setAvailableStages([]);
      });

    return () => {
      cancelled = true;
    };
  }, [formDepartment]);



  // ✅ Normalize backend response

  const normalizeList = (res) => {

    if (Array.isArray(res)) return res;

    if (res?.content && Array.isArray(res.content)) return res.content;

    return [];

  };



  // ✅ Extract status from various error shapes

  const getStatusFromError = (err) => {

    if (!err) return null;

    if (err?.response?.status) return err.response.status;

    if (err?.status) return err.status;

    if (err?.data?.status) return err.data.status;

    const msg = (err?.message || "").toString();

    if (/404|not\s*found/i.test(msg)) return 404;

    return null;

  };



  const fetchCustomers = async () => {

    setLoading(true);

    try {

      console.log('Fetching department-wise customers...');
      
      // 🔥 Use department-aware API for customers
      const customersData = await departmentApiService.getCustomers();
      console.log('Department customers loaded:', customersData.length, 'customers');
      
      // No need for additional filtering - API already handles department filtering
      const filteredCustomers = customersData;

      // Fetch addresses for each customer and merge the data

      const customersWithAddresses = await Promise.all(

        filteredCustomers.map(async (customer) => {

          try {

            // 🔐 CRITICAL: Get user for backend authorization using tab-safe storage
            const authUser = getTabSafeAuthUser();
            
            const addressesResponse = await fetch(`http://localhost:8080/api/clients/${customer.id}/addresses`, {
              headers: {
                "X-User-Id": authUser?.id || "",
                "X-User-Role": authUser?.role || "",
                "X-User-Department": authUser?.department || ""
              }
            });

            const addresses = addressesResponse.ok ? await addressesResponse.json() : [];

            

            return {

              ...customer,

              addresses // ONLY use addresses array as source of truth

            };

          } catch (error) {

            console.error(`Failed to fetch addresses for customer ${customer.id}:`, error);

            return {

              ...customer,

              addresses: [] // Always provide addresses array

            };

          }

        })

      );

      

      setCustomers(customersWithAddresses);



      const keys = new Set();

      customersWithAddresses.forEach((customer) => {

        if (customer?.customFields && typeof customer.customFields === "object") {

          Object.keys(customer.customFields).forEach((k) => keys.add(k));

        }

      });

      setDynamicColumns([...keys]);

    } catch (err) {

      console.error("Failed to fetch customers:", err);

      addToast("Failed to load customers", "error");

    } finally {

      setLoading(false);

    }

  };



  const fetchBanks = async () => {

    try {

      const res = await backendApi.get("/banks");

      setBanks(normalizeList(res));

    } catch (err) {

      console.error("Failed to fetch banks:", err);

    }

  };



  // 🔥 NEW: Fetch products for deals to calculate accurate values (like detail page)
  const fetchDealProducts = async (dealId) => {
    try {
      const res = await backendApi.get(`/deals/${dealId}/products`);
      const list = Array.isArray(res?.content) ? res.content : Array.isArray(res) ? res : [];
      
      // Adapt products like the detail page does
      const adaptedProducts = list.map((ln) => {
        const price = Number(ln.price ?? ln.unitPrice ?? 0) || 0;
        const qty = Number(ln.qty ?? ln.quantity ?? 1) || 1;
        const discount = Number(ln.discount ?? ln.discountAmount ?? 0) || 0;
        const tax = Number(ln.tax ?? ln.taxAmount ?? 0) || 0;
        
        return {
          id: ln.id,
          dealProductId: ln.id,
          productId: ln.productId ?? null,
          name: ln.productName || ln.name || "Unknown Product",
          price,
          qty,
          discount,
          tax,
          finalAmount: price * qty - discount + tax
        };
      });
      
      return adaptedProducts;
    } catch (err) {
      console.error(`Failed to fetch products for deal ${dealId}:`, err);
      return [];
    }
  };

  // 🔥 NEW: Calculate grand total from products (same as detail page)
  const calculateGrandTotal = (products) => {
    return products.reduce(
      (sum, p) => sum + (p.price * p.qty - (p.discount || 0) + (p.tax || 0)),
      0
    );
  };

  const fetchDeals = async () => {
    try {
      const res = await backendApi.get("/deals");
      const list = normalizeList(res);

      // 🔥 NORMALIZE: backend returns 'stage' but frontend expects 'stageCode'
      // 🔥 FIXED: Also normalize valueAmount from value_amount field
      // 🔥 CRITICAL FIX: Normalize clientId from client_id to match mapping
      // 🔥 NEW: Calculate actual values from products (like detail page)
      const normalized = await Promise.all(list.map(async (d) => {
        // Normalize basic fields first
        const basicDeal = {
          ...d,
          clientId: d.clientId ?? d.client_id ?? d.client ?? null,
          stageCode: d.stage || d.stageCode || "",
        };

        // 🔥 NEW: Fetch products and calculate actual value (like detail page)
        try {
          const products = await fetchDealProducts(d.id);
          const calculatedValue = calculateGrandTotal(products);
          
          console.log(`🔍 Deal ${d.id} (${d.name}): ${products.length} products, calculated value: ₹${calculatedValue}`);
          
          return {
            ...basicDeal,
            valueAmount: calculatedValue > 0 ? calculatedValue : d.valueAmount ?? d.value_amount ?? 0,
            _productCount: products.length,
            _calculatedValue: calculatedValue
          };
        } catch (productErr) {
          console.warn(`Failed to calculate value for deal ${d.id}, using fallback:`, productErr);
          return {
            ...basicDeal,
            valueAmount: d.valueAmount ?? d.value_amount ?? 0,
            _productCount: 0,
            _calculatedValue: 0
          };
        }
      }));

      // 🔍 DEBUG: Log sample deal data to understand structure
      console.log("🔍 Sample deal data:", list.slice(0, 2));
      console.log("🔍 Sample normalized deal data:", normalized.slice(0, 2));

      setDeals(normalized);
    } catch (err) {
      console.error("Failed to fetch deals:", err);
    }
  };



  const fetchClientFields = async () => {

    try {

      const res = await backendApi.get("/client-fields");

      setClientFieldDefinitions(res);

    } catch (err) {

      console.error("Failed to fetch client field definitions:", err);

    }

  };



  useEffect(() => {

    fetchCustomers();

    fetchBanks();

    fetchDeals();

    fetchClientFields();

    // fetchDepartments() - REMOVED: Already handled by StageProvider

  }, []);



  const formatLabel = (key) => {

    return key

      .replace(/([A-Z])/g, " $1")

      .replace(/^./, (str) => str.toUpperCase())

      .trim();

  };



  // Helper function to get address type display name

  const getAddressTypeDisplayName = (addressType) => {

    const displayNames = {

      'PRIMARY': 'Primary Address',

      'POLICE': 'Police Station Address', 

      'BRANCH': 'Branch Address',

      'TAHSIL': 'Tahsil Address'

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
    if (!stage || !department) return "-";
    const stages = getStagesForDepartment(department) || [];
    const s = stages.find(x => x.stageCode === stage);
    return s?.stageName || stage;
  };



  // Helper function to format owner display with role

  const formatOwnerDisplay = (customer) => {

    // Handle different possible data structures

    if (!customer) return "-";

    

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

    

    // Case 4: Legacy fields

    if (customer.ownerName) {

      return customer.ownerName;

    }

    

    return "-";

  };

  const formatAddressForTable = (address) => {

    if (!address) return "-";

    const parts = [address.addressLine, address.city, address.pincode].filter(Boolean);

    return parts.join(", ");

  };

  const getAddressTypeIcon = (addressType) => {

    switch(addressType) {

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

          state: address.state,        // ✅ DYNAMIC STATE

          country: "India"           // ✅ FIXED: Country (can be dynamic later)

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

        console.log('❌ GEOCODE FAILED:', data.message);

        

        // Show improved error message for geocoding failures

        const errorMessage = data.message || 'Could not geocode address';

        const improvedMessage = errorMessage.includes('Unable to determine coordinates') 

          ? '🔔 Location Not Found\n\nWe could not detect exact coordinates for this address.\n\nPlease refine address or include a nearby landmark.'

          : errorMessage;

        

        addToast(improvedMessage, "warning");

      }

    } catch (error) {

      console.error('Geocoding error:', error);

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

          addToast(`✅ Address updated from coordinates!`, "success");

        }

      } else {

        console.log('❌ REVERSE GEOCODE FAILED:', data.message);

        addToast(data.message || 'Could not reverse geocode coordinates', "warning");

      }

    } catch (error) {

      console.error('Reverse geocoding error:', error);

      addToast('Failed to reverse geocode coordinates', "error");

    }

  };



  const filtered = customers.filter((customer) => {

    const name = (customer.name || "").toLowerCase();

    const email = (customer.email || "").toLowerCase();

    const phone = (customer.contactPhone || "").toLowerCase();

    const q = search.toLowerCase();

    const textMatch = name.includes(q) || email.includes(q) || phone.includes(q);

    // 🎯 Skip department/stage filtering for ACCOUNT users (they don't work with CRM deals)
    const isAccountUser = userRole === "ACCOUNT";
    if (isAccountUser) {
      return textMatch; // Only apply text search for ACCOUNT users
    }

    // Department and stage filtering (for TL, ADMIN, MANAGER)
    let deptStageMatch = true;

    if (filterDepartment || filterStage) {

      // 🔥 CRITICAL FIX: Normalize clientId mapping for deal filtering
      const customerDeals = deals.filter(deal => Number(deal?.clientId ?? deal?.client_id) === Number(customer.id));

      if (filterDepartment && filterStage) {

        deptStageMatch = customerDeals.some(deal => 

          deal.department === filterDepartment && deal.stageCode === filterStage

        );

      } else if (filterDepartment) {

        deptStageMatch = customerDeals.some(deal => deal.department === filterDepartment);

      } else if (filterStage) {

        deptStageMatch = customerDeals.some(deal => deal.stageCode === filterStage);

      }

    }

    

    return textMatch && deptStageMatch;

  });



  // ✅ Reset modal and open create

  const openCreate = () => {

    setSelectedCustomer(null);

    setForm({

      name: "",

      email: "",

      phone: "",

      addresses: {

        primary: {

          enabled: true,

          id: null,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        },

        branch: {

          enabled: false,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        },

        police: {

          enabled: false,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        },

        tahsil: {

          enabled: false,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        }

      },

      contactName: "",

      contactNumber: "",

      bankId: "",

      branchName: "",

      stage: "",

      valueAmount: "",

      closingDate: "",

      description: "",

      customFields: {}

    });

    setFormDepartment("");

    setAvailableStages([]);

    setShowCreateDrawer(true);

  };



  // Edit: always fetch fresh data

  const openEdit = async (customer) => {
    try {
      // 🔴 HARD RESET — MUST BE FIRST LINE
      setFormDepartment("");
      setAvailableStages([]);
      setForm(prev => ({ ...prev, stage: "" }));
      
      const [freshCustomer, customerDeal, fieldValues, customerAddresses] = await Promise.all([

        clientApi.getById(customer.id),

        backendApi.get(`/deals?clientId=${customer.id}`).catch(() => []),

        clientApi.getFieldValuesAsMap(customer.id).catch(() => ({})),

        fetch(`http://localhost:8080/api/clients/${customer.id}/addresses`).then(res => res.ok ? res.json() : []).catch(() => [])

      ]);



      const dealList = normalizeList(customerDeal);

      // 🔥 CRITICAL FIX: Normalize clientId from client_id to match mapping
      const normalizedDealList = dealList.map(d => ({
        ...d,
        clientId: d.clientId ?? d.client_id ?? d.client ?? null,
        stageCode: d.stage || d.stageCode || "",
        valueAmount: d.valueAmount ?? d.value_amount ?? 0
      }));

      const deal = normalizedDealList.find((d) => Number(d?.clientId) === Number(customer.id)) || normalizedDealList[0] || null;

      

      // Fetch stages for deal's department if available
      if (deal?.department && departments.includes(deal.department)) {
        setFormDepartment(deal.department);
        
        const stages = await fetchStagesForDepartment(deal.department);
        setAvailableStages(stages || []);
        
        // Set stage AFTER stages are loaded - ORDER MATTERS
        setForm(prev => ({
          ...prev,
          stage: stages?.some(s => s.stageCode === deal.stageCode)
            ? deal.stageCode
            : ""
        }));
      } else {
        setFormDepartment("");
        setAvailableStages([]);
        setForm(prev => ({
          ...prev,
          stage: ""
        }));
      }

      

      // Transform addresses to form structure

      const addresses = {

        primary: {

          enabled: true,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        },

        branch: {

          enabled: false,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        },

        police: {

          enabled: false,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        },

        tahsil: {

          enabled: false,

          addressLine: "",

          city: "",

          state: "",        // ✅ ADD STATE

          pincode: "",

          latitude: "",

          longitude: ""

        }

      };



      // Map addresses from backend to form structure

      if (Array.isArray(customerAddresses)) {

        customerAddresses.forEach(addr => {

        const addrData = {

          id: addr.id,

          addressLine: addr.addressLine || "",

          city: addr.city || "",

          state: addr.state || "",        // ✅ ADD STATE

          pincode: addr.pincode || "",

          latitude: addr.latitude?.toString() || "",

          longitude: addr.longitude?.toString() || ""

        };



        switch (addr.addressType) {

          case 'PRIMARY':

            addresses.primary = { ...addrData, enabled: true };

            break;

          case 'BRANCH':

            addresses.branch = { ...addrData, enabled: true };

            break;

          case 'POLICE':

            addresses.police = { ...addrData, enabled: true };

            break;

          case 'TAHSIL':

            addresses.tahsil = { ...addrData, enabled: true };

            break;

        }

      });

      }

      

      setSelectedCustomer(freshCustomer);

      setForm({

        name: freshCustomer.name || "",

        email: freshCustomer.email || "",

        phone: freshCustomer.contactPhone || "",

        addresses: addresses,

        contactName: freshCustomer.contactName || "",

        contactNumber: freshCustomer.contactNumber || "",

        bankId: deal?.bankId ? String(deal.bankId) : "",

        branchName: deal?.branchName || "",

        stage: "", // Will be set after stages load

        valueAmount: deal?.valueAmount || "",

        closingDate: deal?.closingDate || "",

        description: deal?.description || "",

        customFields: fieldValues || {}

      });

      setShowCreateDrawer(true);

    } catch (err) {

      console.error("Failed to load customer:", err);

      addToast("Failed to load customer details", "error");

    }

  };



  const openDetails = (customer) => {

    setSelectedCustomer(customer);

    setShowDetailsDrawer(true);

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

      

      // Prepare addresses array

      const addresses = [];

      

      // Add primary address (mandatory)

      if (form.addresses.primary.enabled) {

        addresses.push({

          id: form.addresses.primary.id || null,

          addressType: "PRIMARY",

          addressLine: form.addresses.primary.addressLine.trim(),

          city: form.addresses.primary.city.trim(),

          state: form.addresses.primary.state?.trim() || "",        // ✅ ADD STATE

          pincode: form.addresses.primary.pincode?.trim() || "",

          latitude: parseFloat(form.addresses.primary.latitude),

          longitude: parseFloat(form.addresses.primary.longitude),

          isPrimary: true

        });

      }



      // Add optional addresses if they are enabled

      if (form.addresses.branch.enabled) {

        addresses.push({

          id: form.addresses.branch.id || null,

          addressType: "BRANCH",

          addressLine: form.addresses.branch.addressLine.trim(),

          city: form.addresses.branch.city?.trim() || "",

          state: form.addresses.branch.state?.trim() || "",        // ✅ ADD STATE

          pincode: form.addresses.branch.pincode?.trim() || "",

          latitude: parseFloat(form.addresses.branch.latitude) || null,

          longitude: parseFloat(form.addresses.branch.longitude) || null,

          isPrimary: false

        });

      }



      if (form.addresses.police.enabled) {

        addresses.push({

          id: form.addresses.police.id || null,

          addressType: "POLICE",

          addressLine: form.addresses.police.addressLine.trim(),

          city: form.addresses.police.city?.trim() || "",

          state: form.addresses.police.state?.trim() || "",        // ✅ ADD STATE

          pincode: form.addresses.police.pincode?.trim() || "",

          latitude: parseFloat(form.addresses.police.latitude) || null,

          longitude: parseFloat(form.addresses.police.longitude) || null,

          isPrimary: false

        });

      }



      if (form.addresses.tahsil.enabled) {

        addresses.push({

          id: form.addresses.tahsil.id || null,

          addressType: "TAHSIL",

          addressLine: form.addresses.tahsil.addressLine.trim(),

          city: form.addresses.tahsil.city?.trim() || "",

          state: form.addresses.tahsil.state?.trim() || "",        // ✅ ADD STATE

          pincode: form.addresses.tahsil.pincode?.trim() || "",

          latitude: parseFloat(form.addresses.tahsil.latitude) || null,

          longitude: parseFloat(form.addresses.tahsil.longitude) || null,

          isPrimary: false

        });

      }

      

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

        // Update addresses using POST for existing customer (backend uses upsert)

        await fetch(`http://localhost:8080/api/clients/${savedCustomer.id}/addresses`, {

          method: 'POST',

          headers: { 'Content-Type': 'application/json' },

          body: JSON.stringify(addresses)

        });

      } else {

        // Create customer first

        savedCustomer = await clientApi.create(customerPayload);

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

        clientId: savedCustomer.id,

        bankId: bankIdNum,

        branchName: form.branchName || "",

        relatedBankName: selectedBank?.name || "",

        contactName: form.contactName || "",

        stageCode: form.stage,

        department: formDepartment, // ✅ FIX

        valueAmount: Number(form.valueAmount) || 0,

        closingDate: form.closingDate || null,

        description: form.description || ""

      };



      if (selectedCustomer?.id) {

        // 🔥 CRITICAL FIX: Normalize clientId mapping for deal lookup
        const existingDeal = deals.find((deal) => Number(deal?.clientId ?? deal?.client_id) === Number(selectedCustomer.id));

        if (existingDeal) {

          await backendApi.put(`/deals/${existingDeal.id}`, dealPayload);

        } else {

          await backendApi.post("/deals", dealPayload);

        }

      } else {

        await backendApi.post("/deals", dealPayload);

      }



      addToast(selectedCustomer?.id ? "Customer updated successfully" : "Customer created successfully", "success");



      // 🔥 CRITICAL: Broadcast customer update to other tabs for real-time updates
      if (typeof window !== 'undefined') {
        const customerId = selectedCustomer?.id || response?.id;
        if (customerId) {
          // Custom event for same tab
          const event = new CustomEvent('crm-data-update', {
            detail: {
              type: 'CUSTOMER_UPDATED',
              customerId: customerId,
              action: selectedCustomer?.id ? 'updated' : 'created',
              userId: getTabSafeAuthUser()?.id
            }
          });
          window.dispatchEvent(event);
          
          // BroadcastChannel for cross-tab communication
          if (typeof BroadcastChannel !== 'undefined') {
            const channel = new BroadcastChannel('crm-updates');
            channel.postMessage({
              type: 'CUSTOMER_UPDATED',
              customerId: customerId,
              action: selectedCustomer?.id ? 'updated' : 'created',
              userId: getTabSafeAuthUser()?.id
            });
            channel.close();
          }
        }
      }

      // Refresh data to show updated addresses

      await fetchCustomers();

      await fetchDeals();

      

      // Reset form

      setForm({

        name: "",

        email: "",

        phone: "",

        addresses: {

          primary: {

            addressLine: "",

            city: "",

            pincode: "",

            latitude: "",

            longitude: ""

          },

          branch: {

            addressLine: "",

            city: "",

            pincode: ""

          },

          police: {

            addressLine: "",

            city: ""

          },

          tahsil: {

            addressLine: "",

            city: ""

          }

        },

        contactName: "",

        contactNumber: "",

        bankId: "",

        branchName: "",

        stage: "",

        valueAmount: "",

        closingDate: "",

        description: "",

        customFields: {}

      });

      

      setFormDepartment("");

      setAvailableStages([]);

      setShowCreateDrawer(false);

      setSelectedCustomer(null);

    } catch (err) {

      console.error("Save failed:", err);

      const status = getStatusFromError(err);

      if (status === 404) {

        addToast("Customer not found. Reloading list...", "error");

        await fetchCustomers();

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



  const handleDelete = async (id) => {

    if (!confirm("Delete this customer?")) return;

    

    try {

      await clientApi.delete(id);

      

      // Optimistic remove

      setCustomers((prev) => prev.filter((c) => c.id !== id));

      

      // Remove associated deal

      // 🔥 CRITICAL FIX: Normalize clientId mapping for deal lookup
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

      await fetchCustomers();

      await fetchDeals();

    } catch (err) {

      console.error("Delete failed:", err);

      const status = getStatusFromError(err);

      

      if (status === 404) {

        addToast("Customer already deleted. Refreshing list...", "info");

        setCustomers((prev) => prev.filter((c) => c.id !== id));

        // 🔥 CRITICAL FIX: Normalize clientId mapping for deal filtering
        setDeals((prev) => prev.filter((d) => Number(d?.clientId ?? d?.client_id) !== Number(id)));

        

        if (selectedCustomer?.id === id) {

          setSelectedCustomer(null);

          setShowCreateDrawer(false);

        }

        

        await fetchCustomers();

        await fetchDeals();

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

            <button

              onClick={openCreate}

              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"

            >

              <Plus className="h-4 w-4" />

              <span>Add Customer</span>

            </button>

            <button

              onClick={() => setShowExcelUploadModal(true)}

              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"

            >

              <Upload className="h-4 w-4" />

              <span>Upload Excel</span>

            </button>

          </div>

        </div>
      


        {/* FILTERS */}

        <div className="mb-4 flex flex-wrap items-center gap-3">

          {/* 🎯 Hide department/stage filters for ACCOUNT users */}
          {userRole !== "ACCOUNT" && (
            <>
              {/* Department Filter */}

              <select
                value={filterDepartment}
                onChange={async (e) => {
                  const dept = e.target.value;
                  
                  setFilterDepartment(dept);
                  setFilterStage("");



                  if (dept) {

                    const stages = await fetchStagesForDepartment(dept);

                    setFilterAvailableStages(stages || []);

                  } else {

                    setFilterAvailableStages([]);

                  }

                }}

                className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"

              >

                <option value="">All Departments</option>

                {Array.isArray(departments) && departments.length > 0 ? (
                  departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))
                ) : (
                  <option disabled>Loading departments...</option>
                )}

              </select>



          {/* Stage Filter */}

          <select

            value={filterStage}

            onChange={(e) => setFilterStage(e.target.value)}

            disabled={!filterDepartment}

            className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 disabled:bg-slate-100 disabled:text-slate-500"

          >

            <option value="">All Stages</option>

            {filterAvailableStages && filterAvailableStages.length > 0 ? (

              filterAvailableStages.map(stage => (

                <option key={stage.stageCode} value={stage.stageCode}>

                  {stage.stageName}

                </option>

              ))

            ) : (

              filterDepartment && <option disabled>(No stages loaded)</option>

            )}

          </select>

            </>
          )}

          {/* Search */}

          <div className="flex items-center gap-2 border rounded px-3 py-2 flex-1 max-w-md">

            <Search size={18} className="text-gray-400" />

            <input

              type="text"

              placeholder="Search customers..."

              value={search}

              onChange={(e) => setSearch(e.target.value)}

              className="flex-1 outline-none"

            />

          </div>

        </div>



        {/* TABLE */}

        {loading ? (

          <div className="text-center py-8">Loading...</div>

        ) : (

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">

            <div className="overflow-x-auto">

              <table className="min-w-full divide-y divide-slate-200">

                <thead className="bg-slate-50">

                  <tr>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      Customer Name

                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      Email

                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      Phone

                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      {getAllAddressTypes().includes('PRIMARY') ? 'Primary Address' : 'Address'}

                    </th>

                    

                    {/* Dynamic Address Columns - ADDITIONAL */}

                    {getAllAddressTypes()

                      .filter(type => type !== 'PRIMARY') // Don't duplicate Primary Address column

                      .map((addressType) => (

                        <th

                          key={addressType}

                          className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"

                        >

                          {getAddressTypeDisplayName(addressType)}

                        </th>

                      ))}

                    

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      Deal Stage

                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      Amount

                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      Owner

                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">

                      Department

                    </th>

                    

                    {dynamicColumns.map((col) => (

                      <th

                        key={col}

                        className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500"

                      >

                        {formatLabel(col)}

                      </th>

                    ))}



                    <th className="px-6 py-3 text-center text-xs font-medium uppercase tracking-wider text-slate-500">

                      Actions

                    </th>

                  </tr>

                </thead>



                <tbody className="divide-y divide-slate-200 bg-white">

                  {filtered.map((customer) => {

                    // 🔥 CRITICAL FIX: Normalize clientId mapping for deal lookup
                    const customerDeal = deals.find(deal => Number(deal?.clientId ?? deal?.client_id) === Number(customer.id));

                    // 🔍 DEBUG: Log deal data to understand structure
                    if (customer.id === 1 || customer.id === 2) { // Debug first few customers
                      console.log(`🔍 Customer ${customer.id} deal data:`, customerDeal);
                      console.log(`🔍 Available deal fields:`, customerDeal ? Object.keys(customerDeal) : 'No deal found');
                      if (customerDeal) {
                        console.log(`🔍 Deal ${customerDeal.id} value breakdown:`, {
                          valueAmount: customerDeal.valueAmount,
                          _productCount: customerDeal._productCount,
                          _calculatedValue: customerDeal._calculatedValue,
                          hasProducts: customerDeal._productCount > 0
                        });
                      }
                    }

                    return (

                      <tr key={customer.id} className="hover:bg-slate-50">

                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">

                          <Link href={`/customers/${customer.id}`} className="hover:underline">

                            {customer.name}

                          </Link>

                        </td>



                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">

                          {customer.email || "-"}

                        </td>



                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">

                          {customer.contactPhone || "-"}

                        </td>



                        <td className="px-6 py-4 text-sm text-slate-700">

                          <div className="max-w-xs">

                            {customer.addresses && customer.addresses.length > 0 ? (

                              <div className="space-y-1">

                                {customer.addresses

                                  ?.filter(addr => addr.addressType === "PRIMARY")

                                  .map((addr) => (

                                    <div key={addr.id} className="flex items-start gap-2">

                                      {getAddressTypeIcon(addr.addressType)}

                                      <div className="flex-1 min-w-0">

                                        <div className="truncate font-medium">{formatAddressForTable(addr)}</div>

                                        <div className="text-xs text-slate-500">{getAddressTypeDisplayName(addr.addressType)}</div>

                                      </div>

                                    </div>

                                  ))}

                              </div>

                            ) : (

                              <div className="text-slate-400">No addresses</div>

                            )}

                          </div>

                        </td>



                        {/* Dynamic Address Columns - ADDITIONAL */}

                        {getAllAddressTypes()

                          .filter(type => type !== 'PRIMARY') // Don't duplicate Primary Address

                          .map((addressType) => {

                            const address = customer.addresses?.find(addr => addr.addressType === addressType);

                            return (

                              <td key={addressType} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">

                                {formatAddressForTable(address)}

                              </td>

                            );

                          })}



                        <td className="px-6 py-4 whitespace-nowrap text-sm">

                          {customerDeal?.stageCode ? (

                            <div className="space-y-1">

                              <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium border ${getDealStageStyle(customerDeal.stageCode, customerDeal.department).bg} ${getDealStageStyle(customerDeal.stageCode, customerDeal.department).text} ${getDealStageStyle(customerDeal.stageCode, customerDeal.department).border}`}>

                                {getStageDisplayName(customerDeal.stageCode, customerDeal.department)}

                              </span>

                              {customerDeal.department && (

                                <div className="text-xs text-slate-500">{customerDeal.department}</div>

                              )}

                            </div>

                          ) : (

                            <span className="text-slate-500">-</span>

                          )}

                        </td>



                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">

                          {customerDeal?.valueAmount ? `₹${Number(customerDeal.valueAmount).toLocaleString()}` : "-"}

                        </td>



                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">

                          {formatOwnerDisplay(customer)}

                        </td>

                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">

                          {customerDeal?.department || "-"}

                        </td>

                        

                        {dynamicColumns.map((col) => (

                          <td key={col} className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">

                            {customer.customFields?.[col] || "-"}

                          </td>

                        ))}



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

                              onClick={() => openDetails(customer)}

                              className="text-green-600 hover:text-green-900"

                              title="View Details"

                            >

                              <Eye className="h-4 w-4" />

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

                        {!filtered.length && (

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

        )}



        {/* ✅ CREATE/EDIT DRAWER */}

        {showCreateDrawer && (

          <>

            <div

              className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm"

              onClick={() => setShowCreateDrawer(false)}

            />



            <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">

              <div className="relative w-full max-w-3xl h-[85vh] rounded-2xl bg-white shadow-2xl flex flex-col overflow-hidden">

                

                {/* HEADER fixed */}

                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4 shrink-0">

                  <div>

                    <h2 className="text-lg font-semibold text-slate-900">

                      {selectedCustomer ? "Edit Customer" : "Create Customer"}

                    </h2>

                    <p className="mt-1 text-sm text-slate-500">

                      {selectedCustomer ? "Update customer information" : "Add a new customer and deal"}

                    </p>

                  </div>



                  <button

                    type="button"

                    onClick={() => setShowCreateDrawer(false)}

                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"

                  >

                    <X className="h-5 w-5" />

                  </button>

                </div>



                {/* BODY scrollable */}

                <div className="flex-1 overflow-y-auto px-6 py-4">

                  <div className="space-y-6">

                    {/* Customer Information */}

                    <div>

                      <h3 className="text-base font-medium text-slate-900 mb-4 flex items-center gap-2">

                        <User className="h-4 w-4" />

                        Customer Information

                      </h3>

                      

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Customer Name <span className="text-rose-500">*</span>

                          </label>

                          <input

                            type="text"

                            value={form.name}

                            onChange={(e) => setForm({ ...form, name: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                            placeholder="Enter customer name"

                          />

                        </div>



                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Email

                          </label>

                          <input

                            type="email"

                            value={form.email}

                            onChange={(e) => setForm({ ...form, email: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                            placeholder="customer@example.com"

                          />

                        </div>



                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Phone

                          </label>

                          <input

                            type="tel"

                            value={form.phone}

                            onChange={(e) => setForm({ ...form, phone: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                            placeholder="+1 (555) 123-4567"

                          />

                        </div>



                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Contact Person

                          </label>

                          <input

                            type="text"

                            value={form.contactName}

                            onChange={(e) => setForm({ ...form, contactName: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                            placeholder="Contact person name"

                          />

                        </div>



                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Contact Number

                          </label>

                          <input

                            type="tel"

                            value={form.contactNumber}

                            onChange={(e) => setForm({ ...form, contactNumber: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                            placeholder="Contact person phone number"

                          />

                        </div>

                      </div>



                      <div className="mt-4">

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          Primary Address (Default Tracking) *

                        </label>

                        <div className="space-y-3 p-4 border border-blue-200 rounded-lg bg-blue-50">

                          <div>

                            <label className="block text-xs font-medium text-slate-600 mb-1">Address Line *</label>

                            <textarea

                              value={form.addresses.primary.addressLine}

                              onChange={(e) => handleAddressFieldChange('primary', 'addressLine', e.target.value)}

                              rows={2}

                              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"

                              placeholder="Enter primary address"

                            />

                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">

                            <div>

                              <label className="block text-xs font-medium text-slate-600 mb-1">City *</label>

                              <input

                                type="text"

                                value={form.addresses.primary.city}

                                onChange={(e) => handleAddressFieldChange('primary', 'city', e.target.value)}

                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                placeholder="Enter city"

                              />

                            </div>

                            <div>

                              <label className="block text-xs font-medium text-slate-600 mb-1">State *</label>

                              <input

                                type="text"

                                value={form.addresses.primary.state}

                                onChange={(e) => handleAddressFieldChange('primary', 'state', e.target.value)}

                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                placeholder="Enter state"

                              />

                            </div>

                            <div>

                              <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>

                              <input

                                type="text"

                                value={form.addresses.primary.pincode}

                                onChange={(e) => handleAddressFieldChange('primary', 'pincode', e.target.value)}

                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                placeholder="Enter pincode"

                              />

                            </div>

                            <div>

                              <label className="block text-xs font-medium text-slate-600 mb-1">Latitude *</label>

                              <input

                                type="number"

                                step="any"

                                value={form.addresses.primary.latitude}

                                onChange={(e) => handleAddressFieldChange('primary', 'latitude', e.target.value)}

                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                placeholder="Enter latitude"

                              />

                            </div>

                          </div>

                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                            <div>

                              <label className="block text-xs font-medium text-slate-600 mb-1">Longitude *</label>

                              <input

                                type="number"

                                step="any"

                                value={form.addresses.primary.longitude}

                                onChange={(e) => handleAddressFieldChange('primary', 'longitude', e.target.value)}

                                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                placeholder="Enter longitude"

                              />

                            </div>

                            <div className="flex items-center gap-2">

                              <button

                                type="button"

                                onClick={() => handleAddressGeocode('primary')}

                                className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"

                              >

                                <MapPin className="h-4 w-4" />

                                Auto-Geocode

                              </button>

                              <button

                                type="button"

                                onClick={() => handleReverseGeocode('primary')}

                                className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"

                                disabled={!form.addresses.primary.latitude || !form.addresses.primary.longitude}

                              >

                                <Map className="h-4 w-4" />

                                Reverse Geocode

                              </button>

                            </div>

                          </div>

                        </div>

                      </div>



                      <div className="mt-6">

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          Additional Addresses (Optional)

                        </label>

                        <div className="space-y-4">

                          {/* Police Station Address */}

                          <div className="p-4 border border-slate-200 rounded-lg">

                            <div className="flex items-center mb-3">

                              <input

                                type="checkbox"

                                checked={form.addresses.police.enabled}

                                onChange={(e) => handleAddressToggle('police', e.target.checked)}

                                className="mr-2"

                              />

                              <label className="text-sm font-medium text-slate-700">Police Station Address</label>

                            </div>

                            {form.addresses.police.enabled && (

                              <div className="space-y-3">

                                <div>

                                  <label className="block text-xs font-medium text-slate-600 mb-1">Address Line</label>

                                  <textarea

                                    value={form.addresses.police.addressLine}

                                    onChange={(e) => handleAddressFieldChange('police', 'addressLine', e.target.value)}

                                    rows={2}

                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"

                                    placeholder="Enter police station address"

                                  />

                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">City</label>

                                    <input

                                      type="text"

                                      value={form.addresses.police.city}

                                      onChange={(e) => handleAddressFieldChange('police', 'city', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter city"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">State</label>

                                    <input

                                      type="text"

                                      value={form.addresses.police.state}

                                      onChange={(e) => handleAddressFieldChange('police', 'state', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter state"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>

                                    <input

                                      type="text"

                                      value={form.addresses.police.pincode}

                                      onChange={(e) => handleAddressFieldChange('police', 'pincode', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter pincode"

                                    />

                                  </div>

                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Latitude (optional)</label>

                                    <input

                                      type="number"

                                      step="any"

                                      value={form.addresses.police.latitude}

                                      onChange={(e) => handleAddressFieldChange('police', 'latitude', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter latitude"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Longitude (optional)</label>

                                    <input

                                      type="number"

                                      step="any"

                                      value={form.addresses.police.longitude}

                                      onChange={(e) => handleAddressFieldChange('police', 'longitude', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter longitude"

                                    />

                                  </div>

                                </div>

                                <div className="flex items-center gap-2 mt-3">

                                  <button

                                    type="button"

                                    onClick={() => handleAddressGeocode('police')}

                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"

                                  >

                                    <MapPin className="h-4 w-4" />

                                    Auto-Geocode

                                  </button>

                                  <button

                                    type="button"

                                    onClick={() => handleReverseGeocode('police')}

                                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"

                                    disabled={!form.addresses.police.latitude || !form.addresses.police.longitude}

                                  >

                                    <Map className="h-4 w-4" />

                                    Reverse Geocode

                                  </button>

                                </div>

                              </div>

                            )}

                          </div>

                          {/* Branch Address */}

                          <div className="p-4 border border-slate-200 rounded-lg">

                            <div className="flex items-center mb-3">

                              <input

                                type="checkbox"

                                checked={form.addresses.branch.enabled}

                                onChange={(e) => handleAddressToggle('branch', e.target.checked)}

                                className="mr-2"

                              />

                              <label className="text-sm font-medium text-slate-700">Branch Address</label>

                            </div>

                            {form.addresses.branch.enabled && (

                              <div className="space-y-3">

                                <div>

                                  <label className="block text-xs font-medium text-slate-600 mb-1">Address Line</label>

                                  <textarea

                                    value={form.addresses.branch.addressLine}

                                    onChange={(e) => handleAddressFieldChange('branch', 'addressLine', e.target.value)}

                                    rows={2}

                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"

                                    placeholder="Enter branch address"

                                  />

                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">City</label>

                                    <input

                                      type="text"

                                      value={form.addresses.branch.city}

                                      onChange={(e) => handleAddressFieldChange('branch', 'city', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter city"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">State</label>

                                    <input

                                      type="text"

                                      value={form.addresses.branch.state}

                                      onChange={(e) => handleAddressFieldChange('branch', 'state', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter state"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>

                                    <input

                                      type="text"

                                      value={form.addresses.branch.pincode}

                                      onChange={(e) => handleAddressFieldChange('branch', 'pincode', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter pincode"

                                    />

                                  </div>

                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Latitude (optional)</label>

                                    <input

                                      type="number"

                                      step="any"

                                      value={form.addresses.branch.latitude}

                                      onChange={(e) => handleAddressFieldChange('branch', 'latitude', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter latitude"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Longitude (optional)</label>

                                    <input

                                      type="number"

                                      step="any"

                                      value={form.addresses.branch.longitude}

                                      onChange={(e) => handleAddressFieldChange('branch', 'longitude', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter longitude"

                                    />

                                  </div>

                                </div>

                                <div className="flex items-center gap-2 mt-3">

                                  <button

                                    type="button"

                                    onClick={() => handleAddressGeocode('branch')}

                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"

                                  >

                                    <MapPin className="h-4 w-4" />

                                    Auto-Geocode

                                  </button>

                                  <button

                                    type="button"

                                    onClick={() => handleReverseGeocode('branch')}

                                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"

                                    disabled={!form.addresses.branch.latitude || !form.addresses.branch.longitude}

                                  >

                                    <Map className="h-4 w-4" />

                                    Reverse Geocode

                                  </button>

                                </div>

                              </div>

                            )}

                          </div>



                          {/* Tahsil Address */}

                          <div className="p-4 border border-slate-200 rounded-lg">

                            <div className="flex items-center mb-3">

                              <input

                                type="checkbox"

                                checked={form.addresses.tahsil.enabled}

                                onChange={(e) => handleAddressToggle('tahsil', e.target.checked)}

                                className="mr-2"

                              />

                              <label className="text-sm font-medium text-slate-700">Tahsil Address</label>

                            </div>

                            {form.addresses.tahsil.enabled && (

                              <div className="space-y-3">

                                <div>

                                  <label className="block text-xs font-medium text-slate-600 mb-1">Address Line</label>

                                  <textarea

                                    value={form.addresses.tahsil.addressLine}

                                    onChange={(e) => handleAddressFieldChange('tahsil', 'addressLine', e.target.value)}

                                    rows={2}

                                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"

                                    placeholder="Enter tahsil address"

                                  />

                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">City</label>

                                    <input

                                      type="text"

                                      value={form.addresses.tahsil.city}

                                      onChange={(e) => handleAddressFieldChange('tahsil', 'city', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter city"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">State</label>

                                    <input

                                      type="text"

                                      value={form.addresses.tahsil.state}

                                      onChange={(e) => handleAddressFieldChange('tahsil', 'state', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter state"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Pincode</label>

                                    <input

                                      type="text"

                                      value={form.addresses.tahsil.pincode}

                                      onChange={(e) => handleAddressFieldChange('tahsil', 'pincode', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter pincode"

                                    />

                                  </div>

                                </div>

                                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Latitude (optional)</label>

                                    <input

                                      type="number"

                                      step="any"

                                      value={form.addresses.tahsil.latitude}

                                      onChange={(e) => handleAddressFieldChange('tahsil', 'latitude', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter latitude"

                                    />

                                  </div>

                                  <div>

                                    <label className="block text-xs font-medium text-slate-600 mb-1">Longitude (optional)</label>

                                    <input

                                      type="number"

                                      step="any"

                                      value={form.addresses.tahsil.longitude}

                                      onChange={(e) => handleAddressFieldChange('tahsil', 'longitude', e.target.value)}

                                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                                      placeholder="Enter longitude"

                                    />

                                  </div>

                                </div>

                                <div className="flex items-center gap-2 mt-3">

                                  <button

                                    type="button"

                                    onClick={() => handleAddressGeocode('tahsil')}

                                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"

                                  >

                                    <MapPin className="h-4 w-4" />

                                    Auto-Geocode

                                  </button>

                                  <button

                                    type="button"

                                    onClick={() => handleReverseGeocode('tahsil')}

                                    className="flex items-center gap-2 px-3 py-2 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700 transition-colors"

                                    disabled={!form.addresses.tahsil.latitude || !form.addresses.tahsil.longitude}

                                  >

                                    <Map className="h-4 w-4" />

                                    Reverse Geocode

                                  </button>

                                </div>

                              </div>

                            )}

                          </div>

                        </div>

                      </div>

                    </div>



                    {/* Deal Information */}

                    <div>

                      <h3 className="text-base font-medium text-slate-900 mb-4 flex items-center gap-2">

                        <DollarSign className="h-4 w-4" />

                        Deal Information

                      </h3>

                      

                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                        {/* Department */}

                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Department <span className="text-rose-500">*</span>

                          </label>

                          <select
                            value={formDepartment}
                            onChange={async (e) => {
                              const dept = e.target.value;
                              
                              setFormDepartment(dept);
                              setForm(prev => ({ ...prev, stage: "" }));



                              if (dept) {

                                const stages = await fetchStagesForDepartment(dept);

                                setAvailableStages(stages);

                              } else {

                                setAvailableStages([]);

                              }

                            }}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"

                          >

                            <option value="">Select Department</option>

                            {Array.isArray(departments) && departments.length > 0 ? (
                              departments.map(dept => (
                                <option key={dept} value={dept}>{dept}</option>
                              ))
                            ) : (
                              <option disabled>Loading departments...</option>
                            )}

                          </select>

                        </div>

                        

                        {/* Deal Stage */}

                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Deal Stage <span className="text-rose-500">*</span>

                          </label>

                          <select
                            value={
                              availableStages.some(s => s.stageCode === form.stage)
                                ? form.stage
                                : ""
                            }
                            disabled={!formDepartment}

                            onChange={(e) => {
                              const newStage = e.target.value;
                              
                              // 🎯 Show confirmation dialog if ACCOUNT stage is selected
                              if (newStage === "ACCOUNT") {
                                setPendingStageChange(newStage);
                                setShowAccountTransferDialog(true);
                                return;
                              }
                              
                              setForm({ ...form, stage: newStage });
                            }}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20"

                          >

                            <option value="">Select Stage</option>

                            {availableStages && availableStages.length > 0 ? (

                              availableStages.map(stage => (

                                <option key={stage.stageCode} value={stage.stageCode}>

                                  {stage.stageName}

                                </option>

                              ))

                            ) : (

                              formDepartment && <option disabled>(No stages available)</option>

                            )}

                          </select>

                        </div>

                        

                        {/* Bank */}

                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Bank

                          </label>

                          <select
                            value={banks.some(b => String(b.id) === String(form.bankId)) ? form.bankId : ""}
                            onChange={async (e) => {

                              const bankId = e.target.value;

                              setForm({ ...form, bankId, branchName: "" });

                              

                              if (bankId) {

                                try {

                                  const response = await fetch(`http://localhost:8080/api/banks/${bankId}`);

                                  if (response.ok) {

                                    const bank = await response.json();

                                    setForm(prev => ({ 

                                      ...prev, 

                                      branchName: bank.branchName || bank.branch_name || "" 

                                    }));

                                  }

                                } catch (error) {

                                  console.error("Failed to fetch bank details:", error);

                                }

                              }

                            }}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                          >

                            <option value="">Select bank</option>

                            {banks.map((bank) => (

                              <option key={bank.id} value={String(bank.id)}>

                                {bank.name}

                              </option>

                            ))}

                          </select>

                        </div>



                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Branch Name

                          </label>

                          <input

                            type="text"

                            value={form.branchName}

                            onChange={(e) => setForm({ ...form, branchName: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                            placeholder="Branch name"

                          />

                        </div>



                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Deal Value

                          </label>

                          <input

                            type="number"

                            step="0.01"

                            min="0"

                            value={form.valueAmount}

                            onChange={(e) => setForm({ ...form, valueAmount: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                            placeholder="0.00"

                          />

                        </div>



                        <div>

                          <label className="block text-sm font-medium text-slate-700 mb-2">

                            Closing Date

                          </label>

                          <input

                            type="date"

                            value={form.closingDate}

                            onChange={(e) => setForm({ ...form, closingDate: e.target.value })}

                            className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"

                          />

                        </div>

                      </div>



                      <div className="mt-4">

                        <label className="block text-sm font-medium text-slate-700 mb-2">

                          Description

                        </label>

                        <textarea

                          value={form.description}

                          onChange={(e) => setForm({ ...form, description: e.target.value })}

                          rows={3}

                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"

                          placeholder="Deal description and notes"

                        />

                      </div>

                    </div>



                    {/* Custom Fields */}

                    <DynamicFieldsSection

                      key={selectedCustomer?.id || "create"}

                      entity="client"

                      entityId={selectedCustomer?.id}

                      definitions={clientFieldDefinitions}

                      values={form.customFields}

                      onChange={(values) => setForm({ ...form, customFields: values })}

                    />

                  </div>

                </div>



                {/* FOOTER fixed */}

                <div className="border-t border-slate-200 px-6 py-4 shrink-0">

                  <div className="flex items-center justify-between">

                    <div className="text-sm text-slate-500">

                      <span className="text-rose-500">*</span> Required fields

                    </div>



                    <div className="flex items-center gap-3">

                      <button

                        type="button"

                        onClick={() => setShowCreateDrawer(false)}

                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"

                      >

                        Cancel

                      </button>



                      <button

                        type="button"

                        onClick={handleCreateOrUpdate}

                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"

                      >

                        {selectedCustomer ? "Update Customer" : "Create Customer"}

                      </button>

                    </div>

                  </div>

                </div>

              </div>

            </div>

          </>

        )}



        {/* DETAILS DRAWER */}

        {showDetailsDrawer && selectedCustomer && (

          <>

            <div

              className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm"

              onClick={() => setShowDetailsDrawer(false)}

            />



            <div className="fixed inset-0 z-[70] flex justify-end">

              <div className="relative w-full max-w-md h-full bg-white shadow-2xl transform transition-transform duration-300 ease-in-out">

                <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">

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

                    {/* Customer Info */}

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



                        <div className="flex items-start gap-3">

                          <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />

                          <div>

                            <div className="text-sm font-medium text-slate-900">Address</div>

                            {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 ? (

                              <div className="space-y-2">

                                {selectedCustomer.addresses

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

                                        {addr.pincode && <span className="text-slate-500">, {addr.pincode}</span>}

                                      </div>

                                    </div>

                                  ))}

                              </div>

                            ) : (

                              <div className="text-slate-400">No addresses</div>

                            )}

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

                      </div>

                    </div>



                    {/* Deal Info */}

                    {(() => {

                      // 🔥 CRITICAL FIX: Normalize clientId mapping for deal lookup
                      const customerDeal = deals.find(deal => Number(deal?.clientId ?? deal?.client_id) === Number(selectedCustomer.id));

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



                            {/* Dynamic Address Display in Deal Section */}

                            {selectedCustomer.addresses && selectedCustomer.addresses.length > 0 && (

                              <div className="flex items-start gap-3">

                                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />

                                <div>

                                  <div className="text-sm font-medium text-slate-900">Related Addresses</div>

                                  <div className="space-y-2 mt-2">

                                    {selectedCustomer.addresses

                                      .filter(addr => addr.addressType !== 'PRIMARY') // Show only non-primary addresses in deal

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

                                              {addr.latitude.toFixed(6)}, {addr.longitude.toFixed(6)}

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

                    {selectedCustomer.customFields && Object.keys(selectedCustomer.customFields).length > 0 && (

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

      </div>

      {/* Excel Upload Modal */}
      <CustomerExcelUploadModal
        isOpen={showExcelUploadModal}
        onClose={() => setShowExcelUploadModal(false)}
        onUploadSuccess={(result) => {
          // Show success toast
          addToast(`Successfully imported ${result.success} customers/deals`, 'success');
          
          // Refresh the customers list
          fetchCustomers();
          fetchDeals();
          
          // Close modal
          setShowExcelUploadModal(false);
        }}
      />

      {/* 🎯 Account Transfer Confirmation Dialog */}
      <AccountTransferDialog
        isOpen={showAccountTransferDialog}
        dealName={form.name || "Untitled Deal"}
        customerName={form.name || "Unknown Customer"}
        onConfirm={async () => {
          // Apply the pending stage change
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

    </DashboardLayout>

  );

}


"use client";







import { useEffect, useMemo, useRef, useState } from "react";

import ApprovalModal from "@/components/common/ApprovalModal";



import { useParams } from "next/navigation";



import Link from "next/link";



import DashboardLayout from "@/components/layout/DashboardLayout";



import { backendApi } from "@/services/api";



import { clientApi } from "@/services/clientApi";



import dayjs from "dayjs";



import utc from "dayjs/plugin/utc";



import timezone from "dayjs/plugin/timezone";



import DynamicFieldsSection from "@/components/dynamic-fields/DynamicFieldsSection";



import { getCurrentUserName, getCurrentUserRole } from "@/utils/userUtils";

import { getTabSafeItem } from "@/utils/tabSafeStorage";



import {



  fetchFieldDefinitions,



  fetchFieldValues,



  normalizeDefinitions,



  normalizeValues,



  upsertFieldValue,



} from "@/services/crmFields";



import { useStages } from "@/context/StageContext";



import AccountTransferDialog from "@/components/common/AccountTransferDialog";



import {



  Calendar,



  Mail,



  CreditCard,



  Edit3,



  MoreHorizontal,



  CheckCircle2,



  XCircle,



  PauseCircle,



  Plus,



  Search,



  Eye,



  Download,



  Upload,



  MapPin,



  Phone,



  Building,



  Building2,



  User,



  DollarSign,



  ChevronRight,



  X,



} from "lucide-react";







dayjs.extend(utc);



dayjs.extend(timezone);







export default function CustomerDetailPage() {



  // In App Router client components, read params via useParams()

  const params = useParams();

  const customerId = Number(params?.id);



  const DISABLE_CALL_SETTINGS = true; // Disable call settings on customer details page







  const [customer, setCustomer] = useState(null);



  const { getStageName, getStagesForDepartment, fetchStagesForDepartment, fetchDepartments } = useStages();







  const loggedInUser = useMemo(() => {



    if (typeof window === "undefined") return null;

    try {

      // Priority: sessionStorage -> tabSafeStorage -> localStorage

      let rawUserData = sessionStorage.getItem("user_data");

      

      if (!rawUserData) {

        rawUserData = getTabSafeItem("user_data");

      }

      

      if (!rawUserData) {

        rawUserData = localStorage.getItem("user_data");

      }

      

      let rawUser = sessionStorage.getItem("user");

      

      if (!rawUser) {

        rawUser = getTabSafeItem("user");

      }

      

      if (!rawUser) {

        rawUser = localStorage.getItem("user");

      }

      

      const user = (rawUserData ? JSON.parse(rawUserData) : null) || (rawUser ? JSON.parse(rawUser) : null);

      

      console.log("🔵 [LOGGED IN USER]", {

        id: user?.id,

        firstName: user?.firstName,

        lastName: user?.lastName,

        fullName: user?.fullName,

        role: user?.role,

        department: user?.department,

        storageSource: rawUserData ? (sessionStorage.getItem("user_data") ? "sessionStorage" : getTabSafeItem("user_data") ? "tabSafeStorage" : "localStorage") : "none",

        full: user

      });

      

      return user;

    } catch {

      return null;

    }



  }, []);



  // 🔥 CRITICAL: Cross-tab communication for real-time updates

  useEffect(() => {

    if (typeof window === "undefined") return;



    // Listen for storage changes from other tabs

    const handleStorageChange = (e) => {

      if (e.key === 'user_data' || e.key === 'user') {

        console.log("🔄 User data changed in another tab, refreshing...");

        window.location.reload(); // Simple refresh to get latest user context

      }

    };



    // Listen for custom events (for stage changes, deal updates, etc.)

    const handleCustomEvent = (e) => {

      if (e.detail?.type === 'DEAL_STAGE_CHANGED') {

        console.log("🔄 Deal stage changed in another tab, refreshing data...");

        // Update current stage immediately for UI refresh

        if (e.detail?.newStage) {

          setCurrentStage(e.detail.newStage);

        }

        // Refresh specific data instead of full page reload

        loadCustomer();

        fetchDeal();

        fetchTimeline();

      }

      

      if (e.detail?.type === 'CUSTOMER_UPDATED') {

        console.log("🔄 Customer updated in another tab, refreshing...");

        loadCustomer();

      }

    };



    // Listen for BroadcastChannel messages (cross-tab)

    let broadcastChannel = null;

    if (typeof BroadcastChannel !== 'undefined') {

      broadcastChannel = new BroadcastChannel('crm-updates');

      broadcastChannel.onmessage = (e) => {

        if (e.data?.type === 'DEAL_STAGE_CHANGED' && e.data?.dealId !== dealId) {

          console.log("🔄 Deal stage changed in another tab via BroadcastChannel");

          // Update current stage immediately for UI refresh

          if (e.data?.newStage) {

            setCurrentStage(e.data.newStage);

          }

          loadCustomer();

          fetchDeal();

          fetchTimeline();

        }

        

        if (e.data?.type === 'DEAL_APPROVAL_COMPLETED') {

          console.log("🔄 Deal approval completed in another tab, refreshing data");

          // Refresh all data when approval is completed

          loadCustomer();

          fetchDeal();

          fetchTimeline();

          fetchStagesForDepartment(deal?.department);

        }

        

        if (e.data?.type === 'CUSTOMER_UPDATED' && e.data?.customerId !== customerId) {

          console.log("🔄 Customer updated in another tab via BroadcastChannel");

          loadCustomer();

        }

      };

    }



    window.addEventListener('storage', handleStorageChange);

    window.addEventListener('crm-data-update', handleCustomEvent);



    return () => {

      window.removeEventListener('storage', handleStorageChange);

      window.removeEventListener('crm-data-update', handleCustomEvent);

      if (broadcastChannel) {

        broadcastChannel.close();

      }

    };

  }, [customerId]);







  const resolveOwnerName = (ownerId) => {



    if (ownerId === null || ownerId === undefined || ownerId === "") return "-";



    const ownerNumeric = Number(ownerId);



    if (!Number.isFinite(ownerNumeric)) return String(ownerId);



    if (loggedInUser && Number(loggedInUser.id) === ownerNumeric) {



      const first = loggedInUser.firstName || "";



      const last = loggedInUser.lastName || "";



      const full = `${first} ${last}`.trim();



      return full || ownerNumeric;



    }



    return ownerNumeric;



  };



  // ✅ FIX 2: Resolve ACTUAL USER NAME everywhere (Timeline, History, etc.)

  const resolveUserName = (value) => {

    console.log("🟡 [RESOLVE USER NAME] Input:", value);

    

    if (!value) {

      console.log("🟡 [RESOLVE USER NAME] Output: '-' (empty value)");

      return "-";

    }



    // If backend already sent name

    if (typeof value === "string" && isNaN(value)) {

      console.log("🟡 [RESOLVE USER NAME] Output:", value, "(already a name)");

      return value;

    }



    // If ID matches logged-in user

    if (loggedInUser && Number(value) === Number(loggedInUser.id)) {

      const resolved = loggedInUser.fullName

        || `${loggedInUser.firstName || ""} ${loggedInUser.lastName || ""}`.trim()

        || "You";

      console.log("🟢 [RESOLVE USER NAME] Output:", resolved, "(matched logged-in user ID)");

      return resolved;

    }



    console.log("🔴 [RESOLVE USER NAME] Output: 'User' (fallback - no match)");

    return "User";

  };



  // ✅ FIX 1: NEVER allow .map() on non-array

  const safeArray = (v) => Array.isArray(v) ? v : [];







  const formatDueDateWithTime = (dateStr) => {



    if (!dateStr) return "-";



    const d = dayjs.utc(dateStr);



    if (!d.isValid()) return String(dateStr);



    return d.tz("Asia/Kolkata").format("DD MMM YYYY, hh:mm A");



  };







  const [cases, setCases] = useState([]);



  const [caseName, setCaseName] = useState("");



  const [form, setForm] = useState({



    customFields: {}



  });



  const [loadingCases, setLoadingCases] = useState(false);



  const [loadingCustomer, setLoadingCustomer] = useState(false);



  const [error, setError] = useState(null);



  const [activeTab, setActiveTab] = useState("timeline");



  const [follow, setFollow] = useState(false);







  // Toast notification system

  const [toast, setToast] = useState({ show: false, message: '', type: 'info' });



  const addToast = (message, type = 'info') => {

    setToast({ show: true, message, type });

    setTimeout(() => setToast({ show: false, message: '', type: 'info' }), 3000);

  };



  const [statuses, setStatuses] = useState([]);



  const [currentStage, setCurrentStage] = useState(null);



  const [stageStartAt, setStageStartAt] = useState(() => new Date());



  const [stagesFromBackend, setStagesFromBackend] = useState([]);







  const [timeline, setTimeline] = useState([]);



  const [deal, setDeal] = useState(null);



  const [dealId, setDealId] = useState(null);



  const [sites, setSites] = useState([]); // ✅ NEW: Sites state







  const [dealFieldDefs, setDealFieldDefs] = useState([]);



  const [dealFieldValues, setDealFieldValues] = useState({});



  const [bank, setBank] = useState(null);



  const [banks, setBanks] = useState([]);



  const [bankSearch, setBankSearch] = useState("");



  const [showBankPicker, setShowBankPicker] = useState(false);



  const [bankFormError, setBankFormError] = useState("");



  const [showCustomerEditModal, setShowCustomerEditModal] = useState(false);



  const [customerEditForm, setCustomerEditForm] = useState({});







  const [notes, setNotes] = useState([]);



  const [noteText, setNoteText] = useState("");



  const [noteTitle, setNoteTitle] = useState("");



  const [noteFile, setNoteFile] = useState(null);







  // Product catalog and edit state



  const [catalogProducts, setCatalogProducts] = useState([]);



  const [loadingCatalog, setLoadingCatalog] = useState(false);



  const [editingDealProductId, setEditingDealProductId] = useState(null);



  const [productFieldDefs, setProductFieldDefs] = useState([]);



  const [productCustomValues, setProductCustomValues] = useState({});







  // 🎯 Fetch deal data separately for re-use after stage changes

  const fetchDeal = async () => {

    if (!dealId) return;

    

    try {

      const dealRes = await backendApi.get(`/deals/${dealId}`);

      const normalizedDeal = dealRes

        ? {

            ...dealRes,

            stageCode: dealRes.stageCode || dealRes.stage || "",

            valueAmount: dealRes.valueAmount ?? dealRes.value_amount ?? 0

          }

        : null;

      setDeal(normalizedDeal);

    } catch (err) {

      console.error("Failed to fetch deal:", err);

    }

  };



  // 🎯 Fetch timeline data separately for cross-tab updates

  const fetchTimeline = async () => {

    if (!dealId) return;

    

    try {

      const timelineRes = await backendApi.get(`/deals/${dealId}/timeline`);

      setTimeline(adaptTimeline(timelineRes));

    } catch (err) {

      console.error("Failed to fetch timeline:", err);

    }

  };



  // 🎯 Load customer data (moved outside useEffect for cross-tab access)

  const loadCustomer = async () => {

    if (!customerId) return;

    

    try {

      setLoadingCustomer(true);

      setError(null);

      

      const data = await backendApi.get(`/clients/${customerId}`);

      

      // Fetch addresses for this customer

      try {

        const authUser = loggedInUser;

        const addressesResponse = await fetch(`http://localhost:8080/api/clients/${customerId}/addresses`, {

          headers: {

            "X-User-Id": authUser?.id || "",

            "X-User-Role": authUser?.role || "",

            "X-User-Department": authUser?.department || ""

          }

        });

        

        const addresses = addressesResponse.ok ? await addressesResponse.json() : [];

        

        // Merge addresses with customer data

        const customerWithAddresses = {

          ...data,

          addresses: addresses || []

        };

        

        setCustomer(customerWithAddresses);

      } catch (addressError) {

        console.error("Failed to load addresses:", addressError);

        // Still set customer data even if addresses fail

        setCustomer({

          ...data,

          addresses: []

        });

      }



      // Sync form with customer custom fields

      setForm({

        customFields: data.customFields || {}

      });

      

    } catch (err) {

      console.error("Failed to load customer", err);

      setError("Failed to load customer: " + err.message);

    } finally {

      setLoadingCustomer(false);

    }

  };



  const stageChangeInFlight = useRef(false);



  const productSaveInFlight = useRef(false);



  const noteSaveInFlight = useRef(false);



  const deleteActivityInFlight = useRef(false);



  const deleteDealProductInFlight = useRef(false);



  const bankSaveInFlight = useRef(false);



  // Account transfer dialog state

  const [showAccountTransferDialog, setShowAccountTransferDialog] = useState(false);

  const [pendingStageChange, setPendingStageChange] = useState(null);

  // Approval modal state

  const [approvalModal, setApprovalModal] = useState({

    isOpen: false,

    type: "question", // "question", "error", "success"

    title: "",

    message: "",

    onConfirm: null,

    onCancel: null,

    confirmText: "Send Request",

    cancelText: "Cancel"

  });





  const [activitiesTab, setActivitiesTab] = useState("tasks");



  const [tasks, setTasks] = useState([]);



  const [events, setEvents] = useState([]);



  const [calls, setCalls] = useState([]);



  const [products, setProducts] = useState([]);



  // Calculate grand total for confirmation dialog

  const grandTotal = useMemo(

    () =>

      products.reduce(

        (sum, p) => sum + (p.price * p.qty - (p.discount || 0) + (p.tax || 0)),

        0

      ),

    [products]

  );



  const showApiError = (prefix, err) => {



    const status = err?.status || err?.response?.status;



    const msg = err?.data?.message || err?.response?.data?.message || err?.message || "Something went wrong";



    if (status === 400) return addToast(`${prefix}: ${msg}`, 'error');



    if (status === 401 || status === 403) return addToast(`${prefix}: Permission denied`, 'error');



    if (status >= 500) return addToast(`${prefix}: Server error`, 'error');



    return addToast(`${prefix}: ${msg}`, 'error');



  };







  const showSuccess = (msg) => {



    addToast(msg, 'success');



  };







  const getLoggedInUser = () => {



    const userName = getCurrentUserName();



    const userRole = getCurrentUserRole();



    return { name: userName, role: userRole };



  };







  // ✅ FIXED: Get dynamic user data for component



  const userName = getCurrentUserName();



  const userRole = getCurrentUserRole();







  const loadDealFieldDefinitions = async () => {



    try {



      const defsRes = await fetchFieldDefinitions("deal");



      setDealFieldDefs(normalizeDefinitions(defsRes));



    } catch (e) {



      console.error("Failed to load deal field definitions", e);



      setDealFieldDefs([]);



    }



  };







  const adaptTimeline = (items) => {

    console.log("📅 [ADAPT TIMELINE] Raw input:", items);



    const list = Array.isArray(items?.content) ? items.content : Array.isArray(items) ? items : [];

    console.log("📅 [ADAPT TIMELINE] Extracted list:", list);



    const result = list



      .map((it) => {



        const time = it.time || it.at || it.timestamp || it.createdAt || it.date;



        // ✅ FIX 3: Timeline actor fix

        const actorRaw = it.actor || it.by || it.user || it.createdByName || it.createdBy;

        console.log("📅 [ADAPT TIMELINE] Item actorRaw:", actorRaw, "from:", it);

        const actor = resolveUserName(actorRaw);



        const message = it.message || it.text || it.title || it.summary || it.event || "";



        return { id: it.id || `${it.type || "EV"}-${time || Math.random()}`, time, actor, message };



      })



      .filter((x) => x.time)



      .sort((a, b) => new Date(b.time) - new Date(a.time));

    

    console.log("📅 [ADAPT TIMELINE] Final output:", result);

    return result;



  };







  const adaptStages = (items) => {

    console.log("🔄 [ADAPT STAGES] Raw input:", items);



    const list = Array.isArray(items?.content) ? items.content : Array.isArray(items) ? items : [];

    console.log("🔄 [ADAPT STAGES] Extracted list:", list);



    const result = list.map((it) => {



      const stage = it.newStage || it.stage || it.to;



      // 🔥 ISSUE 4 FIX: Ensure timestamp is correctly mapped from changedAt

      const timestamp = it.changedAt || it.timestamp || it.at || it.createdAt || it.date;



      // 🔥 ISSUE 2 FIX: Stage History "Modified By" - resolve user name from changedBy ID

      const modifiedByRaw = it.modifiedByName || it.changedByName || it.modifiedBy || it.changedBy;

      console.log("🔄 [ADAPT STAGES] Item modifiedByRaw:", modifiedByRaw, "from:", it);

      const modifiedBy = resolveUserName(modifiedByRaw);



      return {



        id: it.id || `${stage}-${timestamp}`,



        stage,



        amount: Number(it.amount ?? it.valueAmount ?? it.dealValue ?? grandTotal) || 0,



        durationDays: it.durationDays ?? it.days ?? 0,



        modifiedBy,



        timestamp,



      };



    });

    

    console.log("🔄 [ADAPT STAGES] Final output:", result);

    return result;



  };







  const adaptActivities = (items) => {



    const list = Array.isArray(items?.content) ? items.content : Array.isArray(items) ? items : [];



    return list.map((a) => ({



      id: a.id,



      name: a.name || a.title,



      title: a.title || a.name,



      dueDate: a.dueDate || a.dueAt || a.date,



      from: a.startDate || a.startDateTime || a.from,



      to: a.endDate || a.endDateTime || a.to,



      status: a.status,



      ownerId: a.ownerId,



      owner: a.ownerName || a.owner || a.createdByName || a.createdBy,



      modifiedBy: a.modifiedByName || a.modifiedBy,



      description: a.description,



      location: a.location,



      callType: a.callType,



      callStatus: a.callStatus || a.status,



      startTime: a.startDate || a.startDateTime || a.startTime,



      modifiedTime: a.modifiedAt || a.updatedAt || a.modifiedTime,



      priority: a.priority,



      duration: a.duration,



      callAgenda: a.callAgenda,



      fields: a.fields || [],



    }));



  };







  const [editingTaskId, setEditingTaskId] = useState(null);



  const [editingEventId, setEditingEventId] = useState(null);



  const [editingCallId, setEditingCallId] = useState(null);







  const adaptDealProducts = (items) => {



    const list = Array.isArray(items?.content) ? items.content : Array.isArray(items) ? items : [];



    return list



      .map((ln) => {



      // ✅ FIX: Ensure all numeric fields have valid defaults

      const price = Number(ln.price ?? ln.unitPrice ?? 0) || 0;



      const qty = Number(ln.qty ?? ln.quantity ?? 1) || 1;



      const discount = Number(ln.discount ?? ln.discountAmount ?? 0) || 0;



      const tax = Number(ln.tax ?? ln.taxAmount ?? 0) || 0;



      // 🔥 ISSUE 1 FIX: Calculate finalAmount for Products table

      const finalAmount = price * qty - discount + tax;



      return {



        id: ln.id,



        dealProductId: ln.id,



        productId: ln.productId ?? null,



        name: ln.productName || ln.name || "Unknown Product",



        code: ln.code || "N/A",



        price,



        qty,



        discount,



        tax,



        finalAmount,



        createdAt: ln.createdAt || ln.created_at || null,



      };



      })



      .sort((a, b) => {



        // newest first



        const at = a.createdAt ? new Date(a.createdAt).getTime() : 0;



        const bt = b.createdAt ? new Date(b.createdAt).getTime() : 0;



        if (bt !== at) return bt - at;



        return (b.dealProductId || 0) - (a.dealProductId || 0);



      });



  };







  const [stageHistory, setStageHistory] = useState([]);











  const toCrmId = (v) => {



    const n = Number(v);



    return Number.isInteger(n) && n > 0 ? n : null;



  };







  // Load product catalog for dropdown



  async function loadCatalogProducts() {



    try {



      setLoadingCatalog(true);



      const res = await backendApi.get('/products?size=200');



      // normalizeList if you have it; else use res.content fallback



      const list = Array.isArray(res?.content) ? res.content : (Array.isArray(res) ? res : []);



      setCatalogProducts(list);



    } catch (e) {



      console.error('Failed to load product catalog', e);



      setCatalogProducts([]);



    } finally {



      setLoadingCatalog(false);



    }



  }







  // Load product field definitions for dynamic columns



  async function loadProductFieldDefs() {



    try {



      const defs = await fetchFieldDefinitions('product');



      setProductFieldDefs(normalizeDefinitions(defs));



    } catch {



      setProductFieldDefs([]);



    }



  }







  // Handle selecting a product from catalog dropdown



  function handleSelectCatalogProduct(prodId) {



    const prod = catalogProducts.find((x) => Number(x.id) === Number(prodId));



    if (!prod) return;



    setProductForm((prev) => ({



      ...prev,



      productId: String(prod.id),



      productName: prod.name || prod.productName || "",



      productCode: prod.code || prod.productCode || "",



      basePrice: prod.price ?? prod.basePrice ?? prev.basePrice ?? "0",



      listPrice: prod.price ?? prod.listPrice ?? prev.listPrice ?? "0",



      quantity: prev.quantity || "1",



      discount: prev.discount ?? "0",



      tax: prev.tax ?? "0",



    }));



    setProductFormError("");



  }







  // Open product modal in edit mode



  function openProductEdit(p) {



    setEditingDealProductId(p.dealProductId ?? p.id ?? null);



    if (p.productId) {



      // preselect catalog product so fields auto-fill and calc runs



      handleSelectCatalogProduct(p.productId);



    } else {



      setProductForm({



        productId: "",



        productName: p.name || "",



        productCode: p.code || "",



        basePrice: String(p.price ?? p.unitPrice ?? 0),



        listPrice: String(p.price ?? p.unitPrice ?? 0),



        quantity: String(p.qty ?? p.quantity ?? 1),



        discount: String(p.discount ?? 0),



        tax: String(p.tax ?? 0),



      });



    }



    setProductFormError("");



    setIsProductModalOpen(true);



  }







  async function handleDeleteActivity(type, activityId) {



    if (!toCrmId(dealId)) return;



    if (!activityId) return;



    if (deleteActivityInFlight.current) return;



    try {



      deleteActivityInFlight.current = true;



      await backendApi.delete(`/deals/${dealId}/activities/${activityId}`);



      const [tasksRes, eventsRes, callsRes, timelineRes] = await Promise.all([



        backendApi.get(`/deals/${dealId}/activities?type=TASK`),



        backendApi.get(`/deals/${dealId}/activities?type=EVENT`),



        backendApi.get(`/deals/${dealId}/activities?type=CALL`),



        backendApi.get(`/deals/${dealId}/timeline`),



      ]);



      setTasks(adaptActivities(tasksRes));



      setEvents(adaptActivities(eventsRes));



      setCalls(adaptActivities(callsRes));



      setTimeline(adaptTimeline(timelineRes));



      showSuccess(`${type} deleted successfully`);



    } catch (err) {



      console.error("Delete activity failed", err);



      showApiError("Failed to delete activity", err);



    } finally {



      deleteActivityInFlight.current = false;



    }



  }







  useEffect(() => {



    if (!customerId) return;







    let isMounted = true;







    async function loadCases() {



      try {



        setLoadingCases(true);



        setError(null);



        const data = await backendApi.get(`/cases/client/${customerId}`);



        if (!isMounted) return;



        setCases(data || []);



      } catch (err) {



        console.error("Failed to load cases", err);



        setError("Failed to load cases: " + err.message);



      } finally {



        if (isMounted) setLoadingCases(false);



      }



    }







    // ✅ NEW: Load sites for client



    async function loadSites() {



      try {



        const data = await clientApi.getSites(customerId);



        if (!isMounted) return;



        setSites(data || []);



      } catch (err) {



        console.error("Failed to load sites", err);



        // Don't set error for sites, just log it



      }



    }







    async function loadDealCrm() {



      try {



        // definitions first



        await loadDealFieldDefinitions();







        let resolvedDealId = null;



        try {



          const dealLinkRes = await backendApi.get(`/clients/${customerId}/deal`);



          resolvedDealId = toCrmId(dealLinkRes?.id);



        } catch (_e) {



          resolvedDealId = null;



        }







        if (!resolvedDealId) {



          if (isMounted) {



            setDealId(null);



            setDeal(null);



            setTimeline([]);



            setStageHistory([]);



            setStatuses([]);



            setCurrentStage(null);



            setNotes([]);



            setTasks([]);



            setEvents([]);



            setCalls([]);



            setProducts([]);



            setBank(null);



          }



          return;



        }







        if (isMounted) setDealId(resolvedDealId);







        let dealRes = null;



        try {



          dealRes = await backendApi.get(`/deals/${resolvedDealId}`);



        } catch (err) {



          if (err?.status === 404) {



            if (isMounted) {



              setDealId(null);



              setDeal(null);



              setTimeline([]);



              setStageHistory([]);



              setStatuses([]);



              setCurrentStage(null);



              setNotes([]);



              setTasks([]);



              setEvents([]);



              setCalls([]);



              setProducts([]);



              setBank(null);



            }



            return;



          }



          throw err;



        }







        if (!isMounted) return;

        

        // 🔥 PATCH 1: NORMALIZE DEAL IMMEDIATELY AFTER FETCH

        const normalizedDeal = dealRes

          ? {

              ...dealRes,

              stageCode: dealRes.stageCode || dealRes.stage || "",

            }

          : null;



        setDeal(normalizedDeal);







        try {



          const valsRes = await fetchFieldValues("deal", resolvedDealId);



          if (isMounted) setDealFieldValues(normalizeValues(valsRes));



        } catch (_e) {



          if (isMounted) setDealFieldValues({});



        }







        const [timelineSettled, stagesSettled, notesSettled, tasksSettled, eventsSettled, callsSettled, productsSettled] = await Promise.allSettled([



          backendApi.get(`/deals/${resolvedDealId}/timeline`),



          backendApi.get(`/deals/${resolvedDealId}/stages`),



          backendApi.get(`/deals/${resolvedDealId}/notes`),



          backendApi.get(`/deals/${resolvedDealId}/activities?type=TASK`),



          backendApi.get(`/deals/${resolvedDealId}/activities?type=EVENT`),



          backendApi.get(`/deals/${resolvedDealId}/activities?type=CALL`),



          backendApi.get(`/deals/${resolvedDealId}/products`),



        ]);







        if (!isMounted) return;







        setTimeline(timelineSettled.status === "fulfilled" ? adaptTimeline(timelineSettled.value) : []);







        const stageRows = stagesSettled.status === "fulfilled" ? adaptStages(stagesSettled.value) : [];

        console.log("🔄 [LOAD DEAL] Stage history rows:", stageRows);



        setStageHistory(stageRows);



        // Fetch stages dynamically based on deal department



        if (dealRes?.department) {



          try {



            const stagesData = await fetchStagesForDepartment(dealRes.department);



            setStagesFromBackend(stagesData);



            



            // Build statuses from backend stages



            const uniqStages = stagesData.map(s => s.stageCode);



            setStatuses(uniqStages);



            setCurrentStage(dealRes.stageCode || null);



          } catch (e) {



            console.error('Failed to fetch stages:', e);



            setStatuses([]);



            setCurrentStage(null);



          }



        } else {



          console.warn("⚠️ No department in deal:", dealRes);



          setStagesFromBackend([]);



          setStatuses([]);



          setCurrentStage(null);



        }







        const notesRes = notesSettled.status === "fulfilled" ? notesSettled.value : [];

        console.log("📝 [NOTES] Raw response:", notesRes);



        // ✅ FIX 1: NEVER allow .map() on non-array

        const notesArray = safeArray(notesRes?.content || notesRes);

        console.log("📝 [NOTES] Safe array:", notesArray);

        setNotes(notesArray);



        setTasks(tasksSettled.status === "fulfilled" ? adaptActivities(tasksSettled.value) : []);



        setEvents(eventsSettled.status === "fulfilled" ? adaptActivities(eventsSettled.value) : []);



        setCalls(callsSettled.status === "fulfilled" ? adaptActivities(callsSettled.value) : []);



        setProducts(productsSettled.status === "fulfilled" ? adaptDealProducts(productsSettled.value) : []);







        // Load banks for picker



        try {



          const banksRes = await backendApi.get("/banks?size=200");



          if (isMounted) setBanks(Array.isArray(banksRes?.content) ? banksRes.content : banksRes || []);



        } catch (_e) {



          if (isMounted) setBanks([]);



        }







        // Load product catalog and field definitions



        await loadCatalogProducts();



        await loadProductFieldDefs();







        if (dealRes?.bankId) {



          try {



            const bankRes = await backendApi.get(`/banks/${dealRes.bankId}`);



            if (isMounted) setBank(bankRes || null);



          } catch (_e) {



            if (isMounted) setBank(null);



          }



        } else {



          if (isMounted) setBank(null);



        }



      } catch (err) {



        console.error("Failed to load deal CRM", err);



        if (isMounted) setError(err.message || "Failed to load deal CRM");



      }



    }







    loadCustomer();



    loadCases();



    loadSites(); // ✅ NEW: Load sites



    loadDealCrm();







    return () => {



      isMounted = false;



    };



  }, [customerId]);



  // 🔥 REMOVED: Tab switching should NOT refetch data - data is already loaded on mount

  // The race condition was causing "flash then blank" because setState([]) was called during fetch



  const [isCaseModalOpen, setIsCaseModalOpen] = useState(false);



  const [selectedCaseId, setSelectedCaseId] = useState(null);



  const [caseData, setCaseData] = useState(null);



  const [docs, setDocs] = useState([]);



  const [uploadingDoc, setUploadingDoc] = useState(false);



  const [docType, setDocType] = useState("");



  const [docFile, setDocFile] = useState(null);



  const caseFileInputRef = useRef(null);



  const [viewingDoc, setViewingDoc] = useState(null);







  // ✅ FIX: Single source of truth for drawer state (only ONE can be open)

  const [activeDrawer, setActiveDrawer] = useState(null); // values: null | "task" | "event" | "call"







  const [isProductModalOpen, setIsProductModalOpen] = useState(false);



  const [productFormError, setProductFormError] = useState("");



  const [productForm, setProductForm] = useState({



    productName: "",



    productCode: "",



    basePrice: "",



    listPrice: "",



    quantity: "1",



    discount: "0",



    tax: "0",



    productId: "",



  });







  const [taskForm, setTaskForm] = useState({



    name: "",



    dueDate: "",



    repeat: "Never",



    reminder: "None",



    relatedTo: "",



    description: "",



    status: "Open",



    priority: "Normal",



    completed: false,



    expenseAmount: "",



  });







  const [eventForm, setEventForm] = useState({



    title: "",



    from: "",



    to: "",



    repeat: "Never",



    reminder: "None",



    location: "",



    relatedTo: "",



    participants: "",



    description: "",



  });







  const [callForm, setCallForm] = useState({



    toFrom: "",



    startTime: "",



    reminder: "None",



    callType: "Outbound",



    callStatus: "Planned",



    relatedTo: "",



    callAgenda: "",



    duration: "",



  });







  const [taskColumnConfig, setTaskColumnConfig] = useState({



    priority: false,



    expenseAmount: false,



  });



  const [eventColumnConfig, setEventColumnConfig] = useState({



    location: false,



  });



  const [callColumnConfig, setCallColumnConfig] = useState({



  });







  const handleAddCase = async (e) => {



    e.preventDefault();



    if (!caseName.trim() || !customerId) return;







    try {



      const trimmedName = caseName.trim();







      const payload = {



        caseNumber: `C-${Date.now()}`,



        title: trimmedName,



        description: "",



        status: "OPEN",



        priority: "MEDIUM",



        clientId: Number(customerId),



      };



      const created = await backendApi.post("/cases", payload);



      setCases((prev) => [...prev, created]);



      setCaseName("");



      setIsCaseModalOpen(false);



    } catch (err) {



      console.error("Failed to create case", err);



    }



  };







  const handleRemoveCase = async (id) => {



    try {



      await backendApi.delete(`/cases/${id}`);



      setCases((prev) => prev.filter((c) => c.id !== id));







      if (Number(selectedCaseId) === Number(id)) {



        setSelectedCaseId(null);



        setCaseData(null);



        setDocs([]);



        setDocFile(null);



        setDocType("");



        if (caseFileInputRef.current) caseFileInputRef.current.value = "";



        setViewingDoc(null);



      }



    } catch (err) {



      console.error("Failed to delete case", err);



    }



  };







  async function openCaseViewer(id) {



    if (!id) return;







    // Clear any previous state immediately to avoid showing stale docs/PDFs.



    setViewingDoc(null);



    setCaseData(null);



    setDocs([]);







    setSelectedCaseId(id);



    setActiveTab("files");



    try {



      const [caseRes, docsRes] = await Promise.all([



        backendApi.get(`/cases/${id}`),



        backendApi.get(`/case-documents/case/${id}`),



      ]);



      setCaseData(caseRes || null);



      setDocs(docsRes || []);



    } catch (err) {



      console.error("Failed to load case", err);







      // Ensure we don't keep showing the previous case's docs on error.



      setCaseData(null);



      setDocs([]);



    }



  }







  async function handleDeleteDealProduct(dealProductId) {



    const crmDealId = toCrmId(dealId);



    if (!crmDealId) return;



    if (!dealProductId) return;



    if (deleteDealProductInFlight.current) return;



    try {



      deleteDealProductInFlight.current = true;



      await backendApi.delete(`/deals/${crmDealId}/products/${dealProductId}`);



      const [productsRes, dealRes, timelineRes] = await Promise.all([



        backendApi.get(`/deals/${crmDealId}/products`),



        backendApi.get(`/deals/${crmDealId}`),



        backendApi.get(`/deals/${crmDealId}/timeline`),



      ]);



      setProducts(adaptDealProducts(productsRes));



      // 🔥 PATCH 1: NORMALIZE DEAL IMMEDIATELY AFTER FETCH

      const normalizedDeal = dealRes

        ? {

            ...dealRes,

            stageCode: dealRes.stageCode || dealRes.stage || "",

            valueAmount: dealRes.valueAmount ?? dealRes.value_amount ?? 0

          }

        : null;

      

      setDeal(normalizedDeal);



      setTimeline(adaptTimeline(timelineRes));



    } catch (err) {



      console.error("Delete product failed", err);



      showApiError("Failed to delete product", err);



    } finally {



      deleteDealProductInFlight.current = false;



    }



  }







  function closeDocViewer() {



    setViewingDoc(null);



  }







  function viewDoc(doc) {



    if (!doc) return;



    setViewingDoc(doc);



  }







  async function uploadDoc(e) {



    e.preventDefault();



    if (!docFile || !selectedCaseId) return;



    try {



      setUploadingDoc(true);



      const formData = new FormData();



      formData.append("file", docFile);



      formData.append("caseId", String(selectedCaseId));



      formData.append("documentName", docType || docFile.name);



      formData.append("description", "");



      const res = await fetch("http://localhost:8080/api/case-documents/upload", {



        method: "POST",



        body: formData,



      });



      if (!res.ok) {



        const text = await res.text();



        console.error("Upload failed", text);



        return;



      }



      const uploaded = await res.json();



      setDocs((prev) => [...prev, uploaded]);



      setDocFile(null);



      setDocType("");



      if (caseFileInputRef.current) caseFileInputRef.current.value = "";



    } catch (err) {



      console.error("Failed to upload document", err);



    } finally {



      setUploadingDoc(false);



    }



  }







  async function removeDoc(id) {



    if (!id) return;



    try {



      await backendApi.delete(`/case-documents/${id}`);



      setDocs((prev) => prev.filter((d) => d.id !== id));



    } catch (err) {



      console.error("Failed to delete document", err);



    }



  }







  function downloadDoc(doc) {



    if (!doc) return;



    window.open(`http://localhost:8080/api/case-documents/download/${doc.id}`, "_blank");



  }







  const lastModified = useMemo(() => {



    if (!Array.isArray(timeline) || timeline.length === 0) return null;



    const latest = timeline.slice().sort((a, b) => new Date(b.time) - new Date(a.time))[0];



    return latest?.time ? new Date(latest.time) : null;



  }, [timeline]);







  const timelineGroups = useMemo(() => {



    const groups = {};



    for (const item of timeline) {



      const d = new Date(item.time);



      const key = d.toDateString();



      if (!groups[key]) groups[key] = [];



      groups[key].push(item);



    }



    const orderedKeys = Object.keys(groups).sort((a, b) => new Date(b) - new Date(a));



    return orderedKeys.map((key) => ({ key, items: groups[key] }));



  }, [timeline]);







  const productFinalAmount = useMemo(() => {



    const price = Number(productForm.listPrice) || 0;



    const qty = Number(productForm.quantity) || 0;



    const discount = Number(productForm.discount) || 0;



    const tax = Number(productForm.tax) || 0;



    return price * qty - discount + tax;



  }, [productForm.listPrice, productForm.quantity, productForm.discount, productForm.tax]);







  if (!customer && (loadingCustomer || loadingCases)) {



    return (



      <DashboardLayout



        header={{



          project: "Customer Details",



          user: { name: userName, role: userRole },



          notifications: [],



        }}



      >



        <div className="p-4 text-sm text-slate-600">Loading customer...</div>



      </DashboardLayout>



    );



  }







  const safeCustomer = customer || { id: customerId, name: "Customer" };







  function formatCurrency(n) {



    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n || 0);



  }



  // 🔥 PATCH 5: STAGE NAME MUST NEVER BE BLANK

  const resolveStageName = (department, stageCode) => {

    if (!stageCode || !department) return "-";

    const stages = getStagesForDepartment(department) || [];

    const s = stages.find(x => x.stageCode === stageCode);

    return s?.stageName || stageCode;

  };







  async function handleStageChange(newStage) {

    console.log("🚀 [STAGE CHANGE] =======================");
    console.log("🚀 [STAGE CHANGE] handleStageChange called with:", newStage);
    console.log("🚀 [STAGE CHANGE] loggedInUser:", loggedInUser);
    console.log("🚀 [STAGE CHANGE] User Department:", loggedInUser?.department);
    console.log("🚀 [STAGE CHANGE] dealId:", dealId);

    if (!toCrmId(dealId)) {
      console.log("❌ [STAGE CHANGE] Invalid dealId - returning");
      return;
    }

    if (stageChangeInFlight.current) {
      console.log("❌ [STAGE CHANGE] Stage change already in flight - returning");
      return;
    }

    // 🎯 Show confirmation dialog if ACCOUNT stage is selected
    if (newStage === "ACCOUNT") {
      console.log("🔄 [STAGE CHANGE] ACCOUNT stage selected - showing transfer dialog");
      setShowAccountTransferDialog(true);
      setPendingStageChange(newStage);
      return;
    }

    // 🔥 NEW: Handle CLOSE_WON and CLOSE_LOST with approval workflow
    if (newStage === "CLOSE_WON" || newStage === "CLOSE_LOST" || newStage === "CLOSE_WIN" || newStage === "CLOSE_LOST") {
      console.log("🎯 [STAGE CHANGE] CLOSE STAGE DETECTED:", newStage);
      console.log("🎯 [STAGE CHANGE] ALL users need to request approval for close stages");
      
      setApprovalModal({
        isOpen: true,
        type: "question",
        title: "Request Approval",
        message: `Do you want to send this ${newStage.replace('_', ' ')} request to manager for approval?`,
        onConfirm: async () => {
          console.log("✅ [STAGE CHANGE] User confirmed approval request for:", newStage);
          setApprovalModal(prev => ({ ...prev, isOpen: false }));
          await requestClosureApproval(newStage);
        },
        onCancel: () => {
          console.log("❌ [STAGE CHANGE] User cancelled approval request for:", newStage);
          setApprovalModal(prev => ({ ...prev, isOpen: false }));
        },
        confirmText: "Send Request",
        cancelText: "Cancel"
      });
      return;
    }

    console.log(" [STAGE CHANGE] Regular stage change - calling executeStageChange for:", newStage);
    await executeStageChange(newStage);
    console.log(" [STAGE CHANGE] =======================");
  }

  //  Request closure approval for ACCOUNT department users
  async function requestClosureApproval(stage) {
    console.log(" [APPROVAL REQUEST] =======================");
    console.log(" [APPROVAL REQUEST] requestClosureApproval called for stage:", stage);
    console.log(" [APPROVAL REQUEST] dealId:", dealId);
    console.log(" [APPROVAL REQUEST] loggedInUser:", loggedInUser);
    
    if (!toCrmId(dealId)) {
      console.log(" [APPROVAL REQUEST] Invalid dealId - returning");
      return;
    }

    try {
      stageChangeInFlight.current = true;
      console.log(" [APPROVAL REQUEST] Stage change in flight set to true");

      //  Log user info before API call
      console.log(" [APPROVAL REQUEST] User info before API call:");
      console.log(" [APPROVAL REQUEST] - User ID:", loggedInUser?.id);
      console.log(" [APPROVAL REQUEST] - User Department:", loggedInUser?.department);
      console.log(" [APPROVAL REQUEST] - User Role:", loggedInUser?.role);

      let response;
      try {
        response = await backendApi.post(`/approvals/deals/${toCrmId(dealId)}/request-close`, {
          stage: stage,
          reason: null // Optional reason can be added later
        });
      } catch (apiError) {
        // Catch API errors here to prevent console logging
        console.log(" [APPROVAL REQUEST] API call caught:", apiError.message);
        throw apiError; // Re-throw to be handled by outer catch
      }

      console.log(" [APPROVAL REQUEST] API Response:", response);
      
      if (response.message) {
        console.log(" [APPROVAL REQUEST] Success message:", response.message);
        addToast(response.message, 'success');
      }
      
      console.log(" [APPROVAL REQUEST] Approval request completed successfully");
      console.log(" [APPROVAL REQUEST] =======================");
      
    } catch (error) {
      console.log(" [APPROVAL REQUEST] Handling error in requestClosureApproval");
      console.log(" [APPROVAL REQUEST] Error message:", error.message);
      
      let errorMessage = "Failed to request approval";
      
      // Parse error from API service (which returns JSON string in error.message)
      try {
        if (error.message) {
          const errorData = JSON.parse(error.message);
          if (errorData.error) {
            errorMessage = errorData.error;
            console.log(" [APPROVAL REQUEST] Extracted error message:", errorMessage);
          }
        }
      } catch (parseError) {
        // If parsing fails, use the original error message
        errorMessage = error.message || "Failed to request approval";
        console.log(" [APPROVAL REQUEST] Using original error message:", errorMessage);
      }
      
      if (errorMessage.includes("Approval request already pending")) {
        console.log(" [APPROVAL REQUEST] Handling duplicate request error");
        setApprovalModal({
          isOpen: true,
          type: "error",
          title: "Request Already Pending",
          message: "An approval request for this deal is already pending. Please wait for the manager to approve or reject the existing request before submitting a new one.",
          confirmText: "OK",
          cancelText: "OK",
          onConfirm: () => setApprovalModal(prev => ({ ...prev, isOpen: false })),
          onCancel: () => setApprovalModal(prev => ({ ...prev, isOpen: false })),
        });
      } else {
        console.log(" [APPROVAL REQUEST] Showing generic error modal");
        setApprovalModal({
          isOpen: true,
          type: "error",
          title: "Request Failed",
          message: errorMessage,
          confirmText: "OK",
          cancelText: "OK",
          onConfirm: () => setApprovalModal(prev => ({ ...prev, isOpen: false })),
          onCancel: () => setApprovalModal(prev => ({ ...prev, isOpen: false })),
        });
      }
    } finally {
      console.log(" [APPROVAL REQUEST] Finally block - setting in flight to false");
      stageChangeInFlight.current = false;
    }
  }



  async function executeStageChange(newStage) {



    if (!toCrmId(dealId)) return;



    if (stageChangeInFlight.current) return;



    try {



      stageChangeInFlight.current = true;



      // ✅ FIX: Send logged-in user ID in request body

      const response = await backendApi.post(`/deals/${dealId}/stages`, { 



        newStage,



        department: deal?.department,



        userId: loggedInUser?.id || null



      });



      console.log("🔄 [STAGE CHANGE] API Response:", response);



      // ✅ Only show success after API succeeds

      showSuccess(`Stage changed to ${newStage}`);



      const [timelineRes, stagesRes] = await Promise.all([



        backendApi.get(`/deals/${dealId}/timeline`),



        backendApi.get(`/deals/${dealId}/stages`),



      ]);



      const timelineData = adaptTimeline(timelineRes);

      console.log("🔄 [STAGE CHANGE] Timeline data:", timelineData);

      setTimeline(timelineData);



      const stageRows = adaptStages(stagesRes);

      console.log("🔄 [STAGE CHANGE] Stage history rows:", stageRows);

      setStageHistory(stageRows);



      



      // Re-fetch stages to ensure we have latest data

      if (deal?.department) {

        try {

          await fetchStagesForDepartment(deal.department);

        } catch (_e) {

          // Ignore stage fetch errors

        }

      }



      // 🎯 IMPORTANT: Re-fetch deal data to get updated department and stage

      await fetchDeal();



      // 🎯 CRITICAL: Update current stage state for immediate UI update

      setCurrentStage(newStage);

      setStageStartAt(new Date());



      // 🎯 Broadcast stage change to other tabs

      if (typeof BroadcastChannel !== 'undefined') {

        const broadcastChannel = new BroadcastChannel('crm-updates');

        broadcastChannel.postMessage({

          type: 'DEAL_STAGE_CHANGED',

          dealId: dealId,

          newStage: newStage,

          customerId: customerId

        });

        broadcastChannel.close();

      }



    } catch (err) {



      console.error("Stage change failed", err);



      showApiError("Failed to change stage", err);



    } finally {



      stageChangeInFlight.current = false;



    }



  }







  function openTaskCreate() {



    setEditingTaskId(null);



    setTaskForm((prev) => ({ ...prev, relatedTo: prev.relatedTo || safeCustomer.name }));



    setActiveDrawer("task");



  }







  function openEventCreate() {



    setEditingEventId(null);



    setEventForm({

      title: "",

      from: "",

      to: "",

      repeat: "Never",

      reminder: "None",

      location: "",

      relatedTo: safeCustomer.name,

      participants: "",

      description: "",

    });



    setActiveDrawer("event");



  }







  function openCallCreate() {



    setEditingCallId(null);



    setCallForm({

      toFrom: "",

      startTime: "",

      reminder: "None",

      callType: "Outbound",

      callStatus: "Planned",

      relatedTo: safeCustomer.name,

      callAgenda: "",

      duration: "",

    });



    setActiveDrawer("call");



  }







  function openTaskEdit(t) {



    if (!t?.id) return;



    setEditingTaskId(t.id);



    setTaskForm((prev) => ({



      ...prev,



      name: t.name || "",



      dueDate: t.dueDate ? String(t.dueDate).slice(0, 10) : "",



      description: t.description || "",



      status: t.status || "Open",



      priority: t.priority || prev.priority || "Normal",



      relatedTo: safeCustomer.name,



    }));



    setActiveDrawer("task");



  }







  function openEventEdit(e) {



    if (!e?.id) return;



    setEditingEventId(e.id);



    setActiveDrawer("event");



    setEventForm((prev) => ({



      ...prev,



      title: e.title || e.name || "",



      from: e.from ? String(e.from) : "",



      to: e.to ? String(e.to) : "",



      location: e.location || "",



      participants: e.participants || "",



      description: e.description || "",



      relatedTo: safeCustomer.name,



    }));



  }







  function openCallEdit(c) {



    if (!c?.id) return;



    setActiveDrawer("call");



    setEditingCallId(c.id);



    setCallForm((prev) => ({



      ...prev,



      toFrom: c.toFrom || c.subject || "",



      startTime: c.startTime ? String(c.startTime) : "",



      callType: c.callType || prev.callType || "Outbound",



      callStatus: c.callStatus || prev.callStatus || "Planned",



      duration: c.duration ? String(c.duration) : "",



      relatedTo: safeCustomer.name,



    }));



  }







  function openProductModal() {



    setProductForm({



      productName: "",



      productCode: "",



      basePrice: "",



      listPrice: "",



      quantity: "1",



      discount: "0",



      tax: "0",



    });



    setProductFormError("");



    setIsProductModalOpen(true);



  }







  function closeTaskCreate() {



    setActiveDrawer(null);



    setEditingTaskId(null);



  }







  function closeEventCreate() {



    setActiveDrawer(null);

    setEditingEventId(null);

    setEventForm({

      title: "",

      from: "",

      to: "",

      repeat: "Never",

      reminder: "None",

      location: "",

      relatedTo: "",

      participants: "",

      description: "",

    });



  }







  function closeCallCreate() {

    setActiveDrawer(null);

    setEditingCallId(null);

    setCallForm({

      toFrom: "",

      startTime: "",

      reminder: "None",

      callType: "Outbound",

      callStatus: "Planned",

      relatedTo: "",

      callAgenda: "",

      duration: "",

    });

  }







  function closeProductModal() {



    setIsProductModalOpen(false);



    setProductFormError("");



    setEditingDealProductId(null);



    setProductForm({



      productName: "",



      productCode: "",



      basePrice: "",



      listPrice: "",



      quantity: "1",



      discount: "0",



      tax: "0",



    });



  }







  function openBankPicker() {



    setBankSearch("");



    setBankFormError("");



    setShowBankPicker(true);



  }







  function closeBankPicker() {



    setShowBankPicker(false);



    setBankSearch("");



    setBankFormError("");



  }







  async function selectBank(bankItem) {



    setBank(bankItem);



    closeBankPicker();







    const crmDealId = toCrmId(dealId);



    if (!crmDealId || !bankItem?.id) return;



    if (bankSaveInFlight.current) return;







    try {



      bankSaveInFlight.current = true;







      // Persist bank selection on the deal so it is visible after refresh.



      const payload = {



        name: deal?.name || "",



        clientId: deal?.clientId ?? null,



        bankId: Number(bankItem.id),



        relatedBankName: bankItem?.name || deal?.relatedBankName || "",



        branchName: deal?.branchName || null,



        description: deal?.description || "",



        valueAmount: deal?.valueAmount ?? 0,



        requiredAmount: deal?.requiredAmount ?? 0,



        outstandingAmount: deal?.outstandingAmount ?? 0,



        closingDate: deal?.closingDate || null,



        stageCode: deal?.stageCode,   // 🔥 PATCH 2: PRESERVE STAGE



        active: deal?.active ?? true,



      };







      await backendApi.put(`/deals/${crmDealId}`, payload);



      const dealRes = await backendApi.get(`/deals/${crmDealId}`);



      // 🔥 PATCH 1: NORMALIZE DEAL IMMEDIATELY AFTER FETCH

      const normalizedDeal = dealRes

        ? {

            ...dealRes,

            stageCode: dealRes.stageCode || dealRes.stage || "",

            valueAmount: dealRes.valueAmount ?? dealRes.value_amount ?? 0

          }

        : null;



      setDeal(normalizedDeal);







      try {



        const bankRes = await backendApi.get(`/banks/${Number(bankItem.id)}`);



        setBank(bankRes || bankItem);



      } catch (_e) {



        setBank(bankItem);



      }



    } catch (err) {



      console.error("Save bank selection failed", err);



      showApiError("Failed to save bank", err);



    } finally {



      bankSaveInFlight.current = false;



    }



  }







async function ensureDealId() {



    const existingId = toCrmId(dealId);



    if (existingId) return existingId;



    



    // Don't auto-create deal, just return existing ID



    return existingId;



  }







  // Add navigation function for customer name click



  const navigateToDealsPage = () => {



    window.location.href = `/deals/page.js?clientId=${customerId}`;



  };







  // Add customer edit function



  const openCustomerEdit = () => {



    setCustomerEditForm({



      id: customer?.id,



      name: customer?.name || "",



      email: customer?.email || "",



      phone: customer?.contactPhone || "",



      address: customer?.address || "",



      city: customer?.city || "",



      pincode: customer?.pincode || "",



      state: customer?.state || "",



      country: customer?.country || "",



      contactName: customer?.contactName || "",



      contactNumber: customer?.contactNumber || "",



      bankId: bank?.id || "",



    });



    setShowCustomerEditModal(true);



  };







  // Add customer update function



  const handleCustomerUpdate = async () => {



    try {



      const payload = {



        name: customerEditForm.name,



        email: customerEditForm.email,



        contactPhone: customerEditForm.phone,



        address: customerEditForm.address,



        city: customerEditForm.city,



        pincode: customerEditForm.pincode,



        state: customerEditForm.state,



        country: customerEditForm.country,



        contactName: customerEditForm.contactName,



        contactNumber: customerEditForm.contactNumber,



      };







      await clientApi.update(customerEditForm.id, payload);



      



      // Update local state



      setCustomer(prev => ({ ...prev, ...payload }));



      



      // Update bank if changed



      if (customerEditForm.bankId !== bank?.id) {



        const selectedBank = banks.find(b => b.id === customerEditForm.bankId);



        setBank(selectedBank);



      }



      



      setShowCustomerEditModal(false);



      showSuccess("Customer updated successfully");



    } catch (err) {



      console.error("Failed to update customer:", err);



      showApiError("Failed to update customer", err);



    }



  };







  async function saveTask() {



    const ensuredDealId = await ensureDealId();



    if (!ensuredDealId) {



      showApiError("Deal not found for this customer", new Error("Deal not found"));



      return;



    }



    try {



      if (editingTaskId) {



        await backendApi.put(`/deals/${ensuredDealId}/activities/${editingTaskId}`, {



          type: "TASK",



          name: taskForm.name || "Task",



          description: taskForm.description || "",



          dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : undefined,



          priority: taskForm.priority || "Normal",



          status:



            taskForm.status === "Completed"



              ? "COMPLETED"



              : taskForm.status === "In Progress"



                ? "IN_PROGRESS"



                : "PENDING",



        });



      } else {



        await backendApi.post(`/deals/${ensuredDealId}/activities`, {



          type: "TASK",



          name: taskForm.name || "Task",



          description: taskForm.description || "",



          dueDate: taskForm.dueDate ? new Date(taskForm.dueDate).toISOString() : undefined,



          priority: taskForm.priority || "Normal",



          status:



            taskForm.status === "Completed"



              ? "COMPLETED"



              : taskForm.status === "In Progress"



                ? "IN_PROGRESS"



                : "PENDING",



        });



      }



      const [tasksRes, timelineRes] = await Promise.all([



        backendApi.get(`/deals/${ensuredDealId}/activities?type=TASK`),



        backendApi.get(`/deals/${ensuredDealId}/timeline`),



      ]);



      setTasks(adaptActivities(tasksRes));



      setTimeline(adaptTimeline(timelineRes));



      showSuccess(editingTaskId ? "Task updated successfully" : "Task created successfully");



      setEditingTaskId(null);



      setTaskForm({



        name: "",



        dueDate: "",



        repeat: "Never",



        reminder: "None",



        relatedTo: safeCustomer.name,



        description: "",



        status: "Open",



        priority: "Normal",



        completed: false,



        expenseAmount: "",



      });



      closeTaskCreate();



    } catch (err) {



      console.error("Create task failed", err);



      showApiError("Failed to create task", err);



    }



  }







  async function saveEvent() {



    const ensuredDealId = await ensureDealId();



    if (!ensuredDealId) {



      showApiError("Deal not found for this customer", new Error("Deal not found"));



      return;



    }



    try {



      if (editingEventId) {



        await backendApi.put(`/deals/${ensuredDealId}/activities/${editingEventId}`, {



          type: "EVENT",



          name: eventForm.title || "Event",



          description: eventForm.description || "",



          startDate: eventForm.from ? new Date(eventForm.from).toISOString() : undefined,



          endDate: eventForm.to ? new Date(eventForm.to).toISOString() : undefined,



        });



      } else {



        await backendApi.post(`/deals/${ensuredDealId}/activities`, {



          type: "EVENT",



          name: eventForm.title || "Event",



          description: eventForm.description || "",



          startDate: eventForm.from ? new Date(eventForm.from).toISOString() : undefined,



          endDate: eventForm.to ? new Date(eventForm.to).toISOString() : undefined,



          status: "PENDING",



        });



      }



      const [eventsRes, timelineRes] = await Promise.all([



        backendApi.get(`/deals/${ensuredDealId}/activities?type=EVENT`),



        backendApi.get(`/deals/${ensuredDealId}/timeline`),



      ]);



      setEvents(adaptActivities(eventsRes));



      setTimeline(adaptTimeline(timelineRes));



      showSuccess(editingEventId ? "Event updated successfully" : "Event created successfully");



      setEditingEventId(null);



      setEventForm({



        title: "",



        from: "",



        to: "",



        repeat: "Never",



        reminder: "None",



        location: "",



        relatedTo: safeCustomer.name,



        participants: "",



        description: "",



      });



      closeEventCreate();



    } catch (err) {



      console.error("Create event failed", err);



      showApiError("Failed to create event", err);



    }



  }







  async function saveCall() {



    const ensuredDealId = await ensureDealId();



    if (!ensuredDealId) {



      showApiError("Deal not found for this customer", new Error("Deal not found"));



      return;



    }



    try {



      if (editingCallId) {



        await backendApi.put(`/deals/${ensuredDealId}/activities/${editingCallId}`, {



          type: "CALL",



          name: callForm.toFrom || "Call",



          startDate: callForm.startTime ? new Date(callForm.startTime).toISOString() : undefined,



          description: callForm.callAgenda || "",



        });



      } else {



        await backendApi.post(`/deals/${ensuredDealId}/activities`, {



          type: "CALL",



          name: callForm.toFrom || "Call",



          description: callForm.callAgenda || "",



          startDate: callForm.startTime ? new Date(callForm.startTime).toISOString() : undefined,



          status: "PENDING",



        });



      }



      const [callsRes, timelineRes] = await Promise.all([



        backendApi.get(`/deals/${ensuredDealId}/activities?type=CALL`),



        backendApi.get(`/deals/${ensuredDealId}/timeline`),



      ]);



      setCalls(adaptActivities(callsRes));



      setTimeline(adaptTimeline(timelineRes));



      showSuccess(editingCallId ? "Call updated successfully" : "Call created successfully");



      setEditingCallId(null);



      setCallForm({



        toFrom: "",



        startTime: "",



        reminder: "None",



        callType: "Outbound",



        callStatus: "Planned",



        relatedTo: safeCustomer.name,



        callAgenda: "",



        duration: "",



      });



      closeCallCreate();



    } catch (err) {



      console.error("Create call failed", err);



      showApiError("Failed to create call", err);



    }



  }







  async function saveProductFromModal() {



    const crmDealId = toCrmId(dealId);



    if (!crmDealId) return;



    if (productSaveInFlight.current) return;







    const qty = Number(productForm.quantity) || 0;



    const unitPrice = Number(productForm.listPrice) || Number(productForm.basePrice) || 0;



    const discount = Number(productForm.discount) || 0;



    const tax = Number(productForm.tax) || 0;







    try {



      productSaveInFlight.current = true;







      if (!productForm.productName?.trim() && !productForm.productId) {



        setProductFormError("Select a product or enter a new product name.");



        return;



      }



      if (!qty || qty <= 0) {



        setProductFormError("Please enter a valid quantity.");



        return;



      }







      // 1) Edit existing deal product line



      if (editingDealProductId) {



        await backendApi.put(`/deals/${crmDealId}/products/${editingDealProductId}`, {



          productId: productForm.productId ? Number(productForm.productId) : null,



          quantity: qty,



          unitPrice,



          discount,



          tax,



        });



      }



      // 2) Attach existing product to deal



      else if (productForm.productId) {



        await backendApi.post(`/deals/${crmDealId}/products`, {



          productId: Number(productForm.productId),



          quantity: qty,



          unitPrice,



          discount,



          tax,



        });



      }



      // 3) Create new product, then attach



      else {



        const created = await backendApi.post(`/products`, {



          name: productForm.productName.trim(),



          code: productForm.productCode || "",



          price: Number(productForm.basePrice) || 0,



          active: true,



        });



        const createdId = created?.id;



        if (!createdId) {



          setProductFormError("Failed to create product.");



          return;



        }



        await backendApi.post(`/deals/${crmDealId}/products`, {



          productId: Number(createdId),



          quantity: qty,



          unitPrice,



          discount,



          tax,



        });



      }







      // Refresh relevant sections



      const [productsRes, dealRes, timelineRes] = await Promise.all([



        backendApi.get(`/deals/${crmDealId}/products`),



        backendApi.get(`/deals/${crmDealId}`),



        backendApi.get(`/deals/${crmDealId}/timeline`),



      ]);



      setProducts(adaptDealProducts(productsRes));



      // 🔥 PATCH 1: NORMALIZE DEAL IMMEDIATELY AFTER FETCH

      const normalizedDeal = dealRes

        ? {

            ...dealRes,

            stageCode: dealRes.stageCode || dealRes.stage || "",

            valueAmount: dealRes.valueAmount ?? dealRes.value_amount ?? 0

          }

        : null;



      setDeal(normalizedDeal);



      setTimeline(adaptTimeline(timelineRes));



      closeProductModal();



    } catch (err) {



      console.error("Add/update product failed", err);



      showApiError(editingDealProductId ? "Failed to update product" : "Failed to add product", err);



    } finally {



      productSaveInFlight.current = false;



      setEditingDealProductId(null);



    }



  }







  async function handleAddNote() {



    if (!toCrmId(dealId)) return;



    if (!noteText.trim()) return;



    if (noteSaveInFlight.current) return;



    try {



      noteSaveInFlight.current = true;



      await backendApi.post(`/deals/${dealId}/notes`, { title: noteTitle || "Note", text: noteText });



      const [notesRes, timelineRes] = await Promise.all([



        backendApi.get(`/deals/${dealId}/notes`),



        backendApi.get(`/deals/${dealId}/timeline`),



      ]);

      console.log("📝 [ADD NOTE] Raw notes response:", notesRes);



      // ✅ FIX 1: NEVER allow .map() on non-array

      const notesArray = safeArray(notesRes?.content || notesRes);

      console.log("📝 [ADD NOTE] Safe array:", notesArray);

      setNotes(notesArray);



      setTimeline(adaptTimeline(timelineRes));



      setNoteText("");



      setNoteTitle("");



      setNoteFile(null);



    } catch (err) {



      console.error("Create note failed", err);



      showApiError("Failed to add note", err);



    } finally {



      noteSaveInFlight.current = false;



    }



  }



  // 🔥 PATCH 3: BLOCK CRM UI RENDERING UNTIL deal.id EXISTS

  if (!deal?.id) {

    return (

      <div className="py-10 text-center text-slate-500">

        No deal linked to this customer

      </div>

    );

  }







  return (



    <DashboardLayout



      header={{



        project: 'Customer Details',



        user: getLoggedInUser(),



        notifications: [],



      }}



    >



      {/* Toast Notification */}

      {toast.show && (

        <div className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white transition-all duration-300 ${

          toast.type === 'success' ? 'bg-green-500' :

          toast.type === 'error' ? 'bg-red-500' :

          toast.type === 'warning' ? 'bg-yellow-500' :

          'bg-blue-500'

        }`}>

          {toast.message}

        </div>

      )}



      <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50/70 px-4 py-6 lg:px-8">



        <div className="mx-auto max-w-6xl space-y-6">



          <div className="flex flex-col gap-4 rounded-2xl border border-slate-200/70 bg-white/70 p-5 shadow-[0_20px_60px_rgba(15,23,42,0.08)] backdrop-blur-sm transition-shadow duration-300 lg:flex-row lg:items-center lg:justify-between">



            <div className="space-y-2">



              <div className="flex items-center gap-2 text-xs font-medium text-slate-500">



                <Link

                  href="/customers"

                  className="inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-3 py-1 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-200"

                >



                  <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />



                  Customers



                </Link>



                <span className="text-slate-400">/</span>



                <button



                  onClick={navigateToDealsPage}



                  className="text-lg font-bold text-slate-900 hover:text-indigo-600 transition-colors cursor-pointer"



                >



                  {safeCustomer.name}



                </button>



                <span className="inline-flex items-center rounded-full bg-gradient-to-r from-indigo-600 via-sky-600 to-emerald-500 px-4 py-1.5 text-sm font-semibold text-slate-50 shadow-md shadow-indigo-500/30">



                  <span className="mr-1.5 text-[10px] uppercase tracking-[0.18em] text-slate-100/80">Case Value</span>



                  {formatCurrency(grandTotal)}



                </span>



              </div>



              <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-600">



                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-3 py-1">



                  <Calendar className="h-3.5 w-3.5 text-indigo-500" />



                  Closing Date • {deal?.closingDate || "—"}



                </span>



                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100/70 px-3 py-1">



                  <span className="h-5 w-5 rounded-full bg-gradient-to-br from-indigo-500 to-sky-500 text-[10px] font-semibold text-white flex items-center justify-center">



                    {(deal?.ownerName || deal?.owner || "--").slice(0, 2).toUpperCase()}



                  </span>



                  <span className="font-medium text-slate-700">{deal?.ownerName || deal?.owner || "—"}</span>



                  <span className="text-slate-400">Owner</span>



                </span>



                <button



                  onClick={() => setFollow((f) => !f)}



                  className={`inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[11px] font-medium transition duration-150 ${



                    follow



                      ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-[0_0_0_1px_rgba(16,185,129,0.15)]"



                      : "border-slate-300/80 bg-white/60 text-slate-600 hover:border-indigo-400 hover:text-indigo-600"



                  }`}



                >



                  <span className={`h-1.5 w-1.5 rounded-full ${follow ? "bg-emerald-500" : "bg-slate-300"}`} />



                  {follow ? "Following" : "Follow record"}



                </button>



              </div>



            </div>







            <div className="flex flex-wrap items-center gap-2">



              <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-sm font-semibold text-white shadow-md shadow-emerald-500/30 transition duration-150 hover:translate-y-[1px] hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-50">



                <CreditCard className="h-4 w-4" />



                Collect Payment



              </button>



              <button className="inline-flex items-center gap-2 rounded-full border border-sky-500/80 bg-sky-50/80 px-4 py-2 text-sm font-medium text-sky-900 shadow-sm shadow-sky-500/20 transition duration-150 hover:bg-sky-100 hover:shadow-md">



                <Mail className="h-4 w-4" />



                Send Mail



              </button>



              <button 



                onClick={() => openCustomerEdit()}



                className="inline-flex items-center gap-2 rounded-full border border-slate-300/80 bg-white/70 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition duration-150 hover:border-indigo-400 hover:text-indigo-700"



              >



                <Edit3 className="h-4 w-4" />



                Edit



              </button>



              <button className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200/80 bg-white/70 text-slate-500 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700">



                <MoreHorizontal className="h-4 w-4" />



              </button>



            </div>



          </div>







          <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(15,23,42,0.06)] backdrop-blur">



            <div className="mb-4 flex items-center justify-between gap-4">



              <div className="flex items-center gap-2 text-xs text-slate-500">



                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-700">



                  <CheckCircle2 className="h-3.5 w-3.5" />



                  Completed



                </span>



                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2.5 py-1 text-[11px] font-medium text-indigo-700">



                  Current Stage



                </span>



                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-medium text-amber-700">



                  <PauseCircle className="h-3.5 w-3.5" />



                  On Hold



                </span>



              </div>



              <div className="text-xs text-slate-500">



                Tracking case journey across all legal and billing stages



              </div>



            <div className="relative flex items-center gap-4 overflow-x-auto pb-2">



              <div className="absolute inset-x-10 top-1/2 -z-10 h-[2px] translate-y-[-50%] rounded-full bg-gradient-to-r from-slate-200 via-slate-100 to-slate-200" />



              {statuses.map((s, i) => {



                const currentStageData = stagesFromBackend.find(stage => stage.stageCode === currentStage);



                const currentIndex = currentStageData ? stagesFromBackend.findIndex(stage => stage.stageCode === currentStage) : -1;



                const stageData = stagesFromBackend.find(stage => stage.stageCode === s);



                const stageOrder = stageData?.stageOrder || i;



                const completed = currentIndex > -1 && stageOrder < (currentStageData?.stageOrder || 0);



                const isCurrent = s === currentStage;



                const isTerminal = stageData?.isTerminal || false;
                
                // 🔥 Define variables first (before using them)
                const isAccountDepartment = loggedInUser?.department === "ACCOUNT";
                const isBillPassStage = currentStage === "BILL_PASS" || currentStage === "BILL PASS";
                const isCloseStage = s === "CLOSE_WON" || s === "CLOSE_LOST" || s === "CLOSE_WIN" || s === "CLOSE_LOST";
                
                // 🔍 COMPREHENSIVE DEBUG LOGGING
                console.log("🔍 [STAGE ANALYSIS] =======================");
                console.log("🔍 [STAGE ANALYSIS] Stage:", s);
                console.log("🔍 [STAGE ANALYSIS] loggedInUser:", loggedInUser);
                console.log("🔍 [STAGE ANALYSIS] User Department:", loggedInUser?.department);
                console.log("🔍 [STAGE ANALYSIS] isAccountDepartment:", isAccountDepartment);
                console.log("🔍 [STAGE ANALYSIS] currentStage:", currentStage);
                console.log("🔍 [STAGE ANALYSIS] isBillPassStage:", isBillPassStage);
                console.log("🔍 [STAGE ANALYSIS] isCloseStage:", isCloseStage);
                console.log("🔍 [STAGE ANALYSIS] isTerminal:", isTerminal);
                console.log("🔍 [STAGE ANALYSIS] stageData:", stageData);
                
                // 🔥 For ACCOUNT department at BILL PASS, allow terminal close stages
                let allowTerminalStage = isTerminal;
                if (isAccountDepartment && isBillPassStage && isCloseStage) {
                  allowTerminalStage = false; // Don't treat as disabled terminal
                  console.log("✅ [STAGE ANALYSIS] OVERRIDING terminal restriction for:", s);
                } else {
                  console.log("❌ [STAGE ANALYSIS] NOT overriding terminal - Conditions not met");
                  console.log("❌ [STAGE ANALYSIS] Account Dept:", isAccountDepartment, "Bill Pass:", isBillPassStage, "Close Stage:", isCloseStage);
                }

                const currentStageOrder = currentStageData?.stageOrder || 0;
                const thisStageOrder = stageData?.stageOrder || 0;
                let canProgress = thisStageOrder <= currentStageOrder + 1;
                
                console.log("🔍 [STAGE ANALYSIS] currentStageOrder:", currentStageOrder);
                console.log("🔍 [STAGE ANALYSIS] thisStageOrder:", thisStageOrder);
                console.log("🔍 [STAGE ANALYSIS] Initial canProgress:", canProgress, "(calc:", thisStageOrder, "<=", currentStageOrder + 1, ")");
                
                // 🔥 SPECIAL: For ACCOUNT department, allow CLOSE_WON and CLOSE_LOST when current stage is BILL PASS
                if (isAccountDepartment && isBillPassStage && isCloseStage) {
                  // Allow both CLOSE_WON and CLOSE_LOST for ACCOUNT department when at BILL PASS stage
                  canProgress = true;
                  console.log("✅ [STAGE ANALYSIS] OVERRIDING progression restriction for:", s);
                } else {
                  console.log("❌ [STAGE ANALYSIS] NOT overriding progression - Conditions not met");
                }
                
                // Final comprehensive state
                console.log("🎯 [STAGE ANALYSIS] FINAL STATE for", s, ":");
                console.log("🎯 [STAGE ANALYSIS] - canProgress:", canProgress);
                console.log("🎯 [STAGE ANALYSIS] - allowTerminalStage:", allowTerminalStage);
                console.log("🎯 [STAGE ANALYSIS] - isTerminal:", isTerminal);
                console.log("🎯 [STAGE ANALYSIS] - Cursor class:", canProgress ? "cursor-pointer" : "cursor-not-allowed");
                console.log("🎯 [STAGE ANALYSIS] =======================");

                

                return (



                  <div key={s} className="relative flex items-center gap-3 pr-4">



                    <div

                      onClick={() => canProgress && handleStageChange(s)}

                      title={stageData?.stageName || s}

                      className={`flex h-9 items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-medium shadow-sm transition-all duration-200 ${

                        canProgress ? "cursor-pointer" : "cursor-not-allowed"

                      } ${

                        completed

                          ? "border-emerald-400 bg-gradient-to-r from-emerald-500/90 to-teal-500/90 text-emerald-50 shadow-emerald-500/30"

                          : isCurrent

                          ? "border-indigo-400 bg-gradient-to-r from-indigo-600 to-sky-600 text-slate-50 shadow-indigo-500/40 ring-2 ring-indigo-400/40"

                          : allowTerminalStage && !canProgress

                          ? "border-slate-300 bg-slate-100 text-slate-600"

                          : "border-slate-200 bg-white/80 text-slate-600 hover:border-slate-300 hover:bg-slate-50"

                      }`}



                    >



                      <div



                        className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${



                          completed



                            ? "bg-emerald-50 text-emerald-700"



                            : isCurrent



                            ? "bg-white/20 text-slate-50 ring-1 ring-white/40"



                            : isTerminal



                            ? "bg-slate-200 text-slate-600"



                            : "bg-slate-100 text-slate-500"



                        }`}



                      >



                        {completed ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}



                      </div>



                      <span className="whitespace-nowrap">{stageData?.stageName || s}</span>



                    </div>



                  </div>



                );



              })}



            </div>



          </div>







          <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">



            <div className="lg:col-span-1 lg:sticky lg:top-24 self-start">



              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">



                <div className="mb-5 space-y-3">



                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">



                    Related Bank



                  </div>



                  <button



                    type="button"



                    onClick={openBankPicker}



                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-left transition hover:border-indigo-300 hover:bg-indigo-50"



                  >



                    {bank ? (



                      <div className="flex items-center gap-3">



                        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500 text-xs font-semibold text-white shadow-md shadow-emerald-500/30">



                          {(bank.name || "BK").slice(0, 2).toUpperCase()}



                        </div>



                        <div className="flex-1">



                          <div className="text-sm font-semibold text-slate-900">{bank.name}</div>



                          <div className="text-xs text-slate-500">{bank.branch || "No branch"}</div>



                        </div>



                        <Edit3 className="h-4 w-4 text-slate-400" />



                      </div>



                    ) : (



                      <div className="flex items-center gap-2 text-slate-500">



                        <Plus className="h-4 w-4" />



                        <span className="text-sm">Select Bank</span>



                      </div>



                    )}



                  </button>



                </div>



                {/* Customer Details Section */}

                <div className="mb-5 space-y-3">

                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">

                    Customer Details

                  </div>

                  

                  <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">

                    {/* Customer Name and Email */}

                    <div className="flex items-start gap-3">

                      <User className="h-4 w-4 text-slate-400 mt-0.5" />

                      <div className="flex-1">

                        <div className="text-xs font-medium text-slate-500">Name</div>

                        <div className="text-sm text-slate-900">{customer?.name || "-"}</div>

                      </div>

                    </div>



                    <div className="flex items-start gap-3">

                      <Mail className="h-4 w-4 text-slate-400 mt-0.5" />

                      <div className="flex-1">

                        <div className="text-xs font-medium text-slate-500">Email</div>

                        <div className="text-sm text-slate-900">{customer?.email || "-"}</div>

                      </div>

                    </div>



                    <div className="flex items-start gap-3">

                      <Phone className="h-4 w-4 text-slate-400 mt-0.5" />

                      <div className="flex-1">

                        <div className="text-xs font-medium text-slate-500">Phone</div>

                        <div className="text-sm text-slate-900">{customer?.contactPhone || "-"}</div>

                      </div>

                    </div>



                    {/* Deal Amount */}

                    <div className="flex items-start gap-3">

                      <DollarSign className="h-4 w-4 text-slate-400 mt-0.5" />

                      <div className="flex-1">

                        <div className="text-xs font-medium text-slate-500">Deal Amount</div>

                        <div className="text-sm text-slate-900">

                          {deal?.valueAmount ? `₹${Number(deal.valueAmount).toLocaleString()}` : "-"}

                        </div>

                      </div>

                    </div>



                    {/* Addresses */}

                    <div className="flex items-start gap-3">

                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />

                      <div className="flex-1">

                        <div className="text-xs font-medium text-slate-500 mb-2">Addresses</div>

                        {customer?.addresses && customer.addresses.length > 0 ? (

                          <div className="space-y-2">

                            {customer.addresses.map((address, index) => (

                              <div key={address.id || index} className="text-xs text-slate-700 bg-slate-50 rounded-lg p-2">

                                <div className="font-medium text-slate-900 capitalize mb-1">

                                  {address.addressType?.toLowerCase() || 'Unknown'}

                                </div>

                                <div className="text-slate-600">

                                  {address.addressLine && <div>{address.addressLine}</div>}

                                  {address.city && <div>{address.city}</div>}

                                  {address.pincode && <div>{address.pincode}</div>}

                                  {address.state && <div>{address.state}</div>}

                                </div>

                              </div>

                            ))}

                          </div>

                        ) : (

                          <div className="text-xs text-slate-500">No addresses available</div>

                        )}

                      </div>

                    </div>



                    {/* Contact Person */}

                    {(customer?.contactName || customer?.contactNumber) && (

                      <div className="flex items-start gap-3">

                        <Building className="h-4 w-4 text-slate-400 mt-0.5" />

                        <div className="flex-1">

                          <div className="text-xs font-medium text-slate-500">Contact Person</div>

                          {customer?.contactName && (

                            <div className="text-sm text-slate-900">{customer.contactName}</div>

                          )}

                          {customer?.contactNumber && (

                            <div className="text-xs text-slate-600">{customer.contactNumber}</div>

                          )}

                        </div>

                      </div>

                    )}

                  </div>

                </div>





                

                

                {/* <div className="space-y-3">



                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">



                    Financial Snapshot



                  </div>



                  <div className="space-y-2 text-xs text-slate-700">



                    <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">



                      <span className="text-slate-500">Outstanding Amount</span>



                      <span className="font-semibold text-slate-900">{formatCurrency(deal?.outstandingAmount)}</span>



                    </div>



                    <div className="flex items-center justify-between rounded-lg bg-white/70 px-3 py-2">



                      <span className="text-slate-500">Required Amount</span>



                      <span className="font-semibold text-slate-900">{formatCurrency(deal?.requiredAmount)}</span>



                    </div>



                  </div>



                </div> */}



                {lastModified && (



                  <div className="mt-5 border-t border-dashed border-slate-200 pt-3 text-[11px] text-slate-500">



                    Last modified on {lastModified.toLocaleDateString(undefined, { weekday: "long" })},{" "}



                    {lastModified.toLocaleTimeString()}



                  </div>



                )}



              </div>



            </div>







            <div className="lg:col-span-3">



              <div className="rounded-2xl border border-slate-200/80 bg-white/80 p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)] backdrop-blur">



                <div className="flex items-center gap-3 border-b border-slate-200/80 pb-3 text-xs font-medium text-slate-600">



                  {[



                    { key: "timeline", label: "Timeline" },



                    { key: "notes", label: "Notes" },



                    { key: "activities", label: "Activities", count: tasks.length },



                    { key: "stageHistory", label: "Stage History", count: stageHistory.length },



                    { key: "sites", label: "Sites", count: sites.length },



                    { key: "files", label: "Files", count: docs.length },



                    { key: "products", label: "Products", count: products.length },



                    { key: "emails", label: "Emails" },



                  ].map((t) => (



                    <button



                      key={t.key}



                      onClick={() => setActiveTab(t.key)}



                      className={`relative rounded-full px-3 py-1.5 transition-all duration-150 ${



                        activeTab === t.key



                          ? "bg-slate-900 text-slate-50 shadow-sm shadow-slate-900/30"



                          : "text-slate-600 hover:bg-slate-100"



                      }`}



                    >



                      <span className="flex items-center gap-1.5">



                        <span>{t.label}</span>



                        {t.count ? (



                          <span



                            className={`inline-flex h-4 min-w-[1.25rem] items-center justify-center rounded-full border px-1 text-[10px] ${



                              activeTab === t.key



                                ? "border-slate-500/70 bg-slate-800 text-slate-100"



                                : "border-slate-200 bg-slate-50 text-slate-500"



                            }`}



                          >



                            {t.count}



                          </span>



                        ) : null}



                      </span>



                    </button>



                  ))}



                </div>







              {activeTab === "timeline" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-3 flex items-center justify-between">



                    <div className="text-sm font-semibold text-slate-900">Activity Timeline</div>



                    <div className="text-xs text-slate-500">Most recent stage changes appear on top</div>



                  </div>



                  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                    <div className="max-h-[290px] overflow-auto p-4">



                      <div className="space-y-6">



                        {timelineGroups.map((group) => (



                          <div key={group.key} className="relative pl-4">



                            <div className="absolute left-1.5 top-2 bottom-0 w-px bg-gradient-to-b from-emerald-400/40 via-slate-200 to-transparent" />



                            <div className="mb-3 flex items-center gap-2 text-[11px] font-medium text-slate-500">



                              <div className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">



                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500" />



                              </div>



                              <span>{group.key}</span>



                            </div>



                            <div className="space-y-3">



                              {group.items.map((item) => (



                                <div



                                  key={item.id}



                                  className="group flex items-start gap-3 rounded-xl border border-slate-200/80 bg-white/80 px-4 py-3 shadow-sm transition hover:-translate-y-[1px] hover:border-emerald-400/70 hover:shadow-md"



                                >



                                  <div className="mt-0.5 w-16 text-[11px] tabular-nums text-slate-400">



                                    {new Date(item.time).toLocaleTimeString()}



                                  </div>



                                  <div className="flex-1">



                                    <div className="flex items-center justify-between gap-2">



                                      <div className="text-sm font-medium text-slate-900">{item.message}</div>



                                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">



                                        Stage update



                                      </span>



                                    </div>



                                    <div className="mt-1 text-[11px] text-slate-500">



                                      by <span className="font-medium text-slate-700">{item.actor}</span>



                                    </div>



                                  </div>



                                </div>



                              ))}



                            </div>



                          </div>



                        ))}



                      </div>



                    </div>



                  </div>



                </div>



              )}







              {activeTab === "notes" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-3 flex items-center justify-between">



                    <div className="text-sm font-semibold text-slate-900">Notes</div>



                    <div className="text-xs text-slate-500">Keep key context and decisions attached to this case</div>



                  </div>



                  <textarea



                    value={noteText}



                    onChange={(e) => setNoteText(e.target.value)}



                    placeholder="What's this note about?"



                    className="h-40 w-full rounded-2xl border border-slate-200/80 bg-slate-50/70 p-3 text-sm text-slate-800 shadow-inner shadow-slate-200/60 outline-none transition focus:border-emerald-500 focus:bg-white focus:shadow-[0_0_0_1px_rgba(16,185,129,0.35)]"



                  />



                  <div className="mt-3 flex items-center gap-3">



                    <button



                      onClick={handleAddNote}



                      disabled={noteSaveInFlight.current}



                      className="rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/30 transition hover:translate-y-[1px] hover:shadow-lg disabled:cursor-not-allowed disabled:bg-emerald-300"



                    >



                      Save



                    </button>



                    <button



                      onClick={() => {



                        setNoteText("");



                        setNoteTitle("");



                        setNoteFile(null);



                      }}



                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"



                    >



                      Cancel



                    </button>



                    <label className="inline-flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">



                      <PaperclipIcon />



                      <input



                        type="file"



                        className="hidden"



                        onChange={(e) => setNoteFile(e.target.files?.[0] || null)}



                      />



                      Attach file



                    </label>



                    <input



                      type="text"



                      value={noteTitle}



                      onChange={(e) => setNoteTitle(e.target.value)}



                      className="ml-auto w-56 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400"



                      placeholder="Add a Title"



                    />



                  </div>



                  <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                    <div className="max-h-[290px] overflow-auto p-4">



                      <div className="space-y-3">



                        {/* ✅ FIX 1: Safe array check */}

                        {(Array.isArray(notes) ? notes : []).length === 0 ? (



                          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">



                            This record doesn&apos;t have any notes yet. Capture important context and decisions here.



                          </div>



                        ) : (



                          (Array.isArray(notes) ? notes : []).map((n) => (



                            <div



                              key={n.id}



                              className="rounded-2xl border border-slate-200/80 bg-white/90 p-4 text-sm text-slate-700 shadow-sm transition hover:-translate-y-[1px] hover:shadow-md"



                            >



                              <div className="flex items-start justify-between gap-3">



                                <div className="text-sm font-semibold text-slate-900">{n.title || "Note"}</div>



                                <div className="text-[11px] text-slate-500">



                                  {(n.createdByName || n.createdBy || "System")}{n.createdAt ? ` • ${new Date(n.createdAt).toLocaleString()}` : ""}



                                </div>



                              </div>



                              <div className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{n.body || n.text || ""}</div>



                            </div>



                          ))



                        )}



                      </div>



                    </div>



                  </div>



                </div>



              )}







              {activeTab === "activities" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-4 flex items-center justify-between gap-3">



                    <div className="flex items-center gap-2">



                      {["tasks", "events", "calls"].map((k) => (



                        <button



                          key={k}



                          onClick={() => setActivitiesTab(k)}



                          className={`rounded-full px-3 py-1 text-xs font-medium transition ${



                            activitiesTab === k



                              ? "bg-slate-900 text-slate-50 shadow-sm shadow-slate-900/40"



                              : "bg-slate-100 text-slate-700 hover:bg-slate-200"



                          }`}



                        >



                          {k[0].toUpperCase() + k.slice(1)}



                        </button>



                      ))}



                    </div>



                    <div className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50/90 px-1.5 py-1 text-[11px] text-slate-700 shadow-sm shadow-slate-200/70">



                      <button



                        onClick={openTaskCreate}



                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 hover:text-indigo-700"



                      >



                        <Plus className="h-3.5 w-3.5" />



                        <span>Task</span>



                      </button>



                      <button



                        onClick={openEventCreate}



                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 hover:text-indigo-700"



                      >



                        <Plus className="h-3.5 w-3.5" />



                        <span>Event</span>



                      </button>



                      <button



                        onClick={openCallCreate}



                        className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-[11px] font-medium text-slate-800 shadow-sm transition hover:bg-slate-100 hover:text-indigo-700"



                      >



                        <Plus className="h-3.5 w-3.5" />



                        <span>Call</span>



                      </button>



                    </div>



                  </div>







                  {activitiesTab === "tasks" && (



                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                      <div className="max-h-[290px] overflow-auto">



                        <table className="min-w-full divide-y divide-slate-100">



                          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">



                            <tr>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Task Name



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Due Date



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Status



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Task Owner



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Description



                              </th>



                              {taskColumnConfig.priority && (



                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                  Priority



                                </th>



                              )}



                              {taskColumnConfig.expenseAmount && (



                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                  Expense Amount



                                </th>



                              )}



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Action



                              </th>



                            </tr>



                          </thead>



                          <tbody className="divide-y divide-slate-100 bg-white/90">



                            {tasks.map((t) => (



                              <tr key={t.id} className="transition hover:bg-slate-50/80">



                                <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-indigo-700">



                                  {t.name}



                                </td>



                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">



                                  {formatDueDateWithTime(t.dueDate)}



                                </td>



                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">



                                  <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">



                                    {t.status}



                                  </span>



                                </td>



                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{resolveOwnerName(t.ownerId ?? t.owner)}</td>



                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">



                                  {t.description || "—"}



                                </td>



                                {taskColumnConfig.priority && (



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{t.priority || "—"}</td>



                                )}



                                {taskColumnConfig.expenseAmount && (



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{t.expenseAmount || "—"}</td>



                                )}



                                <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">



                                  <div className="flex items-center gap-2">



                                    <button



                                      type="button"



                                      onClick={() => openTaskEdit(t)}



                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"



                                    >



                                      <Edit3 className="h-3.5 w-3.5" />



                                    </button>



                                    <button



                                      type="button"



                                      onClick={async () => {



                                        if (!confirm("Delete this task?")) return;



                                        await handleDeleteActivity("Task", t.id);



                                      }}



                                      className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600"



                                    >



                                      <TrashIcon />



                                    </button>



                                  </div>



                                </td>



                              </tr>



                            ))}



                          </tbody>



                        </table>



                      </div>



                    </div>



                  )}







                  {activitiesTab === "events" && (



                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                      <div className="max-h-[290px] overflow-auto">



                        <table className="min-w-full divide-y divide-slate-100">



                          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">



                            <tr>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Title



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                From



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                To



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Host



                              </th>



                              {eventColumnConfig.location && (



                                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                  Location



                                </th>



                              )}



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Action



                              </th>



                              <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                —



                              </th>



                            </tr>



                          </thead>



                          <tbody className="divide-y divide-slate-100 bg-white/90">



                            {events.length === 0 ? (



                              <tr>



                                <td className="px-4 py-4 text-center text-xs text-slate-500" colSpan={eventColumnConfig.location ? 7 : 6}>



                                  No events yet. Use + Event to create one.



                                </td>



                              </tr>



                            ) : (



                              events.map((e) => (



                                <tr key={e.id} className="transition hover:bg-slate-50/80">



                                  <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-indigo-700">



                                    {e.name || e.title}



                                  </td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{e.from || e.date}</td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{e.to || "—"}</td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{e.owner || e.host || "—"}</td>



                                  {eventColumnConfig.location && (



                                    <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{e.location || "—"}</td>



                                  )}



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">



                                    <div className="flex items-center gap-2">



                                      <button



                                        type="button"



                                        onClick={() => openEventEdit(e)}



                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"



                                      >



                                        <Edit3 className="h-3.5 w-3.5" />



                                      </button>



                                      <button



                                        type="button"



                                        onClick={async () => {



                                          if (!confirm("Delete this event?")) return;



                                          await handleDeleteActivity("Event", e.id);



                                        }}



                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600"



                                      >



                                        <TrashIcon />



                                      </button>



                                    </div>



                                  </td>



                                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-400">—</td>



                                </tr>



                              ))



                            )}



                          </tbody>



                        </table>



                      </div>



                    </div>



                  )}







                  {activitiesTab === "calls" && (



                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                      <div className="max-h-[290px] overflow-auto">



                        <table className="min-w-full divide-y divide-slate-100">



                          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">



                            <tr>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                To / From



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Call Type



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Call Start Time



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Modified Time



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Call Owner



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Call Duration



                              </th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                                Action



                              </th>



                            </tr>



                          </thead>



                          <tbody className="divide-y divide-slate-100 bg-white/90">



                            {calls.length === 0 ? (



                              <tr>



                                <td className="px-4 py-4 text-center text-xs text-slate-500" colSpan={8}>



                                  No calls yet. Use + Call to create one.



                                </td>



                              </tr>



                            ) : (



                              calls.map((c) => (



                                <tr key={c.id} className="transition hover:bg-slate-50/80">



                                  <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-indigo-700">



                                    {c.toFrom || c.subject}



                                  </td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{c.callType || "Outbound"}</td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{c.startTime || c.date}</td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{c.modifiedTime || "—"}</td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{c.owner || "—"}</td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{c.duration || "—"}</td>



                                  <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">



                                    <div className="flex items-center gap-2">



                                      <button



                                        type="button"



                                        onClick={() => openCallEdit(c)}



                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"



                                      >



                                        <Edit3 className="h-3.5 w-3.5" />



                                      </button>



                                      <button



                                        type="button"



                                        onClick={async () => {



                                          if (!confirm("Delete this call?")) return;



                                          await handleDeleteActivity("Call", c.id);



                                        }}



                                        className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600"



                                      >



                                        <TrashIcon />



                                      </button>



                                    </div>



                                  </td>



                                  <td className="whitespace-nowrap px-4 py-3 text-right text-xs text-slate-400">—</td>



                                </tr>



                              ))



                            )}



                          </tbody>



                        </table>



                      </div>



                    </div>



                  )}



                </div>



              )}







              {activeTab === "stageHistory" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-3 flex items-center justify-between">



                    <div className="text-sm font-semibold text-slate-900">Stage History</div>



                    <div className="text-xs text-slate-500">How long the case spent in each stage</div>



                  </div>



                  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                    <div className="max-h-[290px] overflow-auto">



                      <table className="min-w-full divide-y divide-slate-100">



                        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">



                          <tr>



                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                              Stage



                            </th>



                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                              Amount



                            </th>



                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                             Duration (Days)



                            </th>



                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                              Modified By



                            </th>



                            <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                              Timestamp



                            </th>



                          </tr>



                        </thead>



                        <tbody className="divide-y divide-slate-100 bg-white/90">



                          {stageHistory.map((row, idx) => (



                            <tr



                              key={row.id}



                              className={`transition ${idx === 0 ? "bg-indigo-50/50" : "hover:bg-slate-50/80"}`}



                            >



                              <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-slate-900">



                                {getStageName(deal?.department, row.stage)}



                                {idx === 0 ? " (Current Stage)" : ""}



                              </td>



                              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{formatCurrency(row.amount)}</td>



                              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-900">



                                <div className="flex items-center gap-2">



                                  <div className="h-1.5 flex-1 rounded-full bg-slate-100">



                                    <div



                                      className="h-1.5 rounded-full bg-gradient-to-r from-indigo-500 to-emerald-500"



                                      style={{ width: `${Math.min(100, (row.durationDays || 1) * 10)}%` }}



                                    />



                                  </div>



                                  <span className="w-8 text-right tabular-nums">{row.durationDays}</span>



                                </div>



                              </td>



                              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{row.modifiedBy}</td>



                              <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">



                                {row.timestamp && dayjs(row.timestamp).isValid()



                                  ? dayjs(row.timestamp).format("DD MMM YYYY, hh:mm A")



                                  : "-"}



                              </td>



                            </tr>



                          ))}



                        </tbody>



                      </table>



                    </div>



                  </div>



                </div>



              )}







              {activeTab === "sites" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-4 flex items-center justify-between">



                    <div className="text-sm font-semibold text-slate-900">Sites & Locations</div>



                    <button



                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/40 transition hover:translate-y-[1px] hover:shadow-lg"



                    >



                      <Plus className="h-4 w-4" /> Add Site



                    </button>



                  </div>



                  {sites.length === 0 ? (



                    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/50 p-8 text-center">



                      <Building className="mx-auto h-12 w-12 text-slate-400" />



                      <h3 className="mt-4 text-sm font-semibold text-slate-900">No sites yet</h3>



                      <p className="mt-2 text-sm text-slate-600">Get started by adding the first site for this customer.</p>



                    </div>



                  ) : (



                    <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                      <div className="max-h-[400px] overflow-auto">



                        <table className="min-w-full divide-y divide-slate-100">



                          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">



                            <tr>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Site Name</th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Site ID</th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Address</th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Contact</th>



                              <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Location</th>



                            </tr>



                          </thead>



                          <tbody className="divide-y divide-slate-100 bg-white/90">



                            {sites.map((site) => (



                              <tr key={site.id} className="transition hover:bg-slate-50/80">



                                <td className="whitespace-nowrap px-4 py-3 text-sm font-medium text-slate-900">



                                  <div className="flex items-center gap-2">



                                    <Building className="h-4 w-4 text-slate-400" />



                                    {site.siteName}



                                  </div>



                                </td>



                                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-700">{site.siteId}</td>



                                <td className="px-4 py-3 text-sm text-slate-900">



                                  <div className="max-w-xs">



                                    <div className="truncate">{site.address || '-'}</div>



                                    {site.city && <div className="text-xs text-slate-500">{site.city}</div>}



                                  </div>



                                </td>



                                <td className="px-4 py-3 text-sm text-slate-900">



                                  <div className="flex flex-col gap-1">



                                    {site.contactPerson && (



                                      <div className="flex items-center gap-1">



                                        <span className="text-xs text-slate-600">{site.contactPerson}</span>



                                      </div>



                                    )}



                                    {site.contactNumber && (



                                      <div className="flex items-center gap-1 text-xs text-slate-500">



                                        <Phone className="h-3 w-3" />



                                        {site.contactNumber}



                                      </div>



                                    )}



                                  </div>



                                </td>



                                <td className="px-4 py-3 text-sm text-slate-900">



                                  {site.latitude && site.longitude ? (



                                    <div className="flex items-center gap-1 text-xs text-emerald-600">



                                      <MapPin className="h-3 w-3" />



                                      Location set



                                    </div>



                                  ) : (



                                    <div className="flex items-center gap-1 text-xs text-slate-400">



                                      <MapPin className="h-3 w-3" />



                                      No location



                                    </div>



                                  )}



                                </td>



                              </tr>



                            ))}



                          </tbody>



                        </table>



                      </div>



                    </div>



                  )}



                </div>



              )}







              {activeTab === "files" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-4 flex items-center justify-between">



                    <div className="text-sm font-semibold text-slate-900">Cases &amp; Files</div>



                    <button



                      onClick={() => setIsCaseModalOpen(true)}



                      className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/40 transition hover:translate-y-[1px] hover:shadow-lg"



                    >



                      <Plus className="h-4 w-4" /> Create Case



                    </button>



                  </div>



                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">



                    {cases.map((item) => (



                      <div



                        key={item.id}



                        className="flex items-center gap-3 rounded-2xl border border-slate-200/80 bg-slate-50/80 px-4 py-3 shadow-sm transition hover:-translate-y-[1px] hover:border-indigo-300 hover:bg-slate-50 hover:shadow-md"



                      >



                        <button



                          type="button"



                          onClick={() => openCaseViewer(item.id)}



                          className="flex flex-1 items-center gap-3 text-left"



                        >



                          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">



                            <FolderIcon />



                          </div>



                          <div className="flex-1">



                            <div className="text-sm font-medium text-slate-900">



                              {item.title || item.caseNumber || `Case #${item.id}`}



                            </div>



                          </div>



                        </button>



                        <div className="flex items-center gap-2">



                          <button



                            type="button"



                            onClick={() => handleRemoveCase(item.id)}



                            className="rounded-full p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"



                            title="Remove case"



                          >



                            <TrashIcon />



                          </button>



                        </div>



                      </div>



                    ))}



                    {cases.length === 0 && (



                      <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-4 py-3 text-xs text-slate-500">



                        No cases yet. Click <span className="font-semibold">Create Case</span> to add one.



                      </p>



                    )}



                  </div>







                  {selectedCaseId && (



                    <div className="mt-6 rounded-2xl border border-slate-200/80 bg-slate-50/70 p-4 shadow-inner shadow-slate-200/80">



                      <div className="flex items-start justify-between">



                        <div>



                          <div className="text-sm text-slate-500">Selected Case</div>



                          <div className="text-base font-semibold text-slate-900">



                            {caseData?.title || caseData?.caseNumber || `Case #${selectedCaseId}`}



                          </div>



                        </div>



                      </div>



                      <form onSubmit={uploadDoc} className="mt-4 flex flex-wrap items-center gap-3">



                        <input



                          type="text"



                          className="w-64 rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-700 placeholder:text-slate-400 focus:border-indigo-400"



                          value={docType}



                          onChange={(e) => setDocType(e.target.value)}



                          placeholder="Enter document name"



                        />



                        <input



                          type="file"



                          accept="application/pdf,.pdf"



                          onChange={(e) => setDocFile(e.target.files?.[0] || null)}



                          className="text-xs file:mr-2 file:rounded-full file:border-0 file:bg-indigo-50 file:px-3 file:py-1 file:text-xs file:font-medium file:text-indigo-700 hover:file:bg-indigo-100"



                          ref={caseFileInputRef}



                        />



                        <button



                          type="submit"



                          disabled={uploadingDoc || !docFile}



                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/40 transition hover:translate-y-[1px] hover:shadow-lg disabled:cursor-not-allowed disabled:bg-indigo-300 disabled:shadow-none"



                        >



                          <Upload className="h-4 w-4" />



                          {uploadingDoc ? "Uploading..." : "Upload Document"}



                        </button>



                      </form>







                      <div className="mt-4">



                        {docs.length === 0 ? (



                          <p className="text-xs text-slate-500">No documents uploaded. Use Upload Document to add a PDF.</p>



                        ) : (



                          <div className="grid grid-cols-2 gap-4">



                            {docs.map((doc) => (



                              <div key={doc.id} className="flex items-center justify-between rounded-2xl border border-slate-200/80 bg-white/90 px-4 py-3 shadow-sm transition hover:-translate-y-[1px] hover:border-indigo-300 hover:shadow-md">



                                <div className="flex min-w-0 items-center gap-3">



                                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-rose-500 to-red-500 text-white shadow-sm">



                                    <PdfIcon />



                                  </div>



                                  <div className="min-w-0">



                                    <div



                                      className="max-w-[260px] truncate text-xs font-semibold uppercase tracking-wide text-slate-700"



                                      title={doc.documentName || "Document"}



                                    >



                                      {doc.documentName || "Document"}



                                    </div>



                                    <div



                                      className="max-w-[260px] truncate text-sm font-medium text-slate-900"



                                      title={doc.fileName || "File"}



                                    >



                                      {doc.fileName || "File"}



                                    </div>



                                  </div>



                                </div>



                                <div className="flex items-center gap-2">



                                  <button



                                    type="button"



                                    onClick={() => viewDoc(doc)}



                                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-indigo-600 transition hover:bg-indigo-50 hover:text-indigo-800"



                                    title="View document"



                                  >



                                    <Eye className="h-4 w-4" /> View



                                  </button>



                                  <button



                                    type="button"



                                    onClick={() => downloadDoc(doc)}



                                    className="flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-emerald-600 transition hover:bg-emerald-50 hover:text-emerald-800"



                                    title="Download document"



                                  >



                                    <Download className="h-4 w-4" /> Download



                                  </button>



                                  <button



                                    type="button"



                                    onClick={() => removeDoc(doc.id)}



                                    className="rounded-full p-1 text-rose-500 transition hover:bg-rose-50 hover:text-rose-600"



                                    title="Remove document"



                                  >



                                    <TrashIcon />



                                  </button>



                                </div>



                              </div>



                            ))}



                          </div>



                        )}



                      </div>



                    </div>



                  )}







                  {viewingDoc && (



                    <>



                      <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-sm" onClick={closeDocViewer} />



                      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">



                        <div className="relative h-[90vh] w-full max-w-6xl overflow-hidden rounded-2xl bg-slate-950/95 shadow-2xl shadow-slate-950/70">



                          <div className="flex items-center justify-between border-b border-slate-800 bg-slate-900/70 px-4 py-3">



                            <div>



                              <h3 className="text-sm font-semibold text-slate-50">



                                {viewingDoc.documentName || viewingDoc.fileName || "Document"}



                              </h3>



                              <p className="text-xs text-slate-400">{viewingDoc.fileName}</p>



                            </div>



                            <button



                              type="button"



                              onClick={closeDocViewer}



                              className="rounded-full p-2 text-slate-400 transition hover:bg-slate-800 hover:text-slate-100"



                            >



                              <XCircle className="h-5 w-5" />



                            </button>



                          </div>



                          <div className="flex-1 bg-slate-900 p-1">



                            <iframe



                              src={`http://localhost:8080/api/case-documents/view/${viewingDoc.id}`}



                              className="h-full w-full rounded-lg border-0 bg-slate-900"



                              title="PDF Viewer"



                              style={{ minHeight: 'calc(90vh - 80px)' }}



                              onError={(e) => {



                                window.open(`http://localhost:8080/api/case-documents/view/${viewingDoc.id}`, '_blank');



                                e.target.style.display = 'none';



                                const errorDiv = document.createElement('div');



                                errorDiv.className = 'flex items-center justify-center h-full text-red-600';



                                errorDiv.innerHTML = '<div class="text-center"><p class="text-lg font-medium">PDF Viewer Error</p><p class="text-sm mt-2">Opening in new tab...</p></div>';



                                e.target.parentNode.appendChild(errorDiv);



                              }}



                            />



                          </div>



                        </div>



                      </div>



                    </>



                  )}



                </div>



              )}







              {activeTab === "products" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-3 flex items-center justify-between">



                    <div className="text-sm font-semibold text-slate-900">Products</div>



                    <div className="text-xs text-slate-500">Billing-grade view of charges linked to this case</div>



                  </div>



                  <div className="overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-950/[0.01] shadow-sm">



                    <div className="max-h-[260px] overflow-auto">



                      <table className="min-w-full divide-y divide-slate-100">



                        <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur">



                        <tr>



                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                            Product



                          </th>



                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                            List Price (₹)



                          </th>



                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                            Quantity



                          </th>



                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                            Discount



                          </th>



                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                            Tax



                          </th>



                          {productFieldDefs.map((def) => (



                            <th key={def.key} className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                              {def.label || def.key}



                            </th>



                          ))}



                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                            Final Amount (₹)



                          </th>



                          <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">



                            Action



                          </th>



                        </tr>



                        </thead>



                        <tbody className="divide-y divide-slate-100 bg-white/90">



                        {products.map((p) => (



                          <tr key={p.id} className="transition hover:bg-slate-50/80">



                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-900">



                              <span className="inline-flex items-center gap-2">



                                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 text-[10px] font-bold text-white shadow-sm">



                                  {p.code}



                                </span>



                                {p.name}



                              </span>



                            </td>



                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{(p.price || 0).toLocaleString("en-IN")}</td>



                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{(p.qty || 0).toFixed(2)}</td>



                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{(p.discount || 0).toLocaleString("en-IN")}</td>



                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">{(p.tax || 0).toLocaleString("en-IN")}</td>



                            {productFieldDefs.map((def) => {



                              const custom = p.customFields || p.fields || {};



                              let v = "";



                              try {



                                const obj = typeof custom === "string" ? JSON.parse(custom || "{}") : custom;



                                v = obj?.[def.key] ?? "";



                              } catch { v = ""; }



                              return (



                                <td key={def.key} className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">



                                  {String(v)}



                                </td>



                              );



                            })}



                            <td className="whitespace-nowrap px-4 py-3 text-xs font-semibold text-slate-900">



                              {((p.price || 0) * (p.qty || 0) - (p.discount || 0) + (p.tax || 0)).toLocaleString("en-IN")}



                            </td>



                            <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-700">



                              <div className="flex items-center gap-2">



                                <button



                                  type="button"



                                  onClick={() => openProductEdit(p)}



                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700"



                                >



                                  <Edit3 className="h-3.5 w-3.5" />



                                </button>



                                <button



                                  type="button"



                                  onClick={async () => {



                                    if (!confirm("Delete this product?")) return;



                                    await handleDeleteDealProduct(p.dealProductId ?? p.id);



                                  }}



                                  className="inline-flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-rose-500 shadow-sm transition hover:border-rose-300 hover:text-rose-600"



                                >



                                  <TrashIcon />



                                </button>



                              </div>



                            </td>



                          </tr>



                        ))}



                        </tbody>



                      </table>



                    </div>



                  </div>



                  <div className="sticky bottom-0 mt-4 flex items-center justify-between bg-white/90 py-2 backdrop-blur">



                    <button



                      onClick={openProductModal}



                      className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-800 shadow-sm transition hover:border-indigo-400 hover:text-indigo-700"



                    >



                      <Plus className="h-4 w-4" /> Product



                    </button>



                    <div className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-50 shadow-md shadow-slate-900/40">



                      <span className="text-slate-400">Grand Total</span>



                      <span>{formatCurrency(grandTotal)}</span>



                    </div>



                  </div>



                </div>



              )}







              {activeTab === "emails" && (



                <div className="mt-5 animate-[fadeIn_0.25s_ease-out]">



                  <div className="mb-3 flex items-center justify-between">



                    <div className="text-sm font-semibold text-slate-900">Emails</div>



                    <div className="text-xs text-slate-500">Send and track emails directly from this case</div>



                  </div>



                  <div className="space-y-3">



                    <input



                      type="text"



                      className="w-full rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400"



                      placeholder="To"



                      defaultValue={customer?.email || ""}



                    />



                    <input



                      type="text"



                      className="w-full rounded-full border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-indigo-400"



                      placeholder="Subject"



                    />



                    <textarea



                      className="h-40 w-full rounded-2xl border border-slate-200 bg-slate-50/70 px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 shadow-inner shadow-slate-200/60 focus:border-indigo-400 focus:bg-white"



                      placeholder="Compose your message"



                    />



                    <div className="flex items-center justify-end gap-3">



                      <button className="inline-flex items-center gap-2 rounded-full border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50">



                        Save Draft



                      </button>



                      <button className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/40 transition hover:translate-y-[1px] hover:shadow-lg">



                        <Mail className="h-4 w-4" /> Send



                      </button>



                    </div>



                  </div>



                </div>



              )}



            </div>



          </div>



        </div>







        {isProductModalOpen && (



          <>



            <div



              className="fixed inset-0 z-[65] bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"



              onClick={closeProductModal}



            />



            <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">



              <div



                className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/50 animate-[scaleIn_0.2s_ease-out]"



                onClick={(e) => e.stopPropagation()}



              >



                <div className="flex items-start justify-between border-b border-slate-200/80 px-5 py-4">



                  <div>



                    <div className="text-sm font-semibold text-slate-900">{editingDealProductId ? "Edit Product" : "Add Product"}</div>



                    <div className="mt-0.5 text-xs text-slate-500">



                      {editingDealProductId ? "Update product details and pricing" : "Create a new product and configure pricing for this case"}



                    </div>



                  </div>



                  <button



                    type="button"



                    onClick={closeProductModal}



                    className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"



                  >



                    <XCircle className="h-5 w-5" />



                  </button>



                </div>







                <div className="max-h-[70vh] flex-1 overflow-y-auto px-5 py-4">



                  <div className="space-y-4">



                    {productFormError && (



                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">



                        {productFormError}



                      </div>



                    )}







                    <div>



                      <label className="block text-xs font-medium text-slate-700">Product (choose from catalog or create new)</label>



                      <div className="mt-1 flex gap-2">



                        <select



                          value={productForm.productId || ""}



                          onChange={(e) => {



                            const v = e.target.value;



                            if (!v) {



                              // Create new



                              setProductForm((prev) => ({ ...prev, productId: "", productName: "", productCode: "", basePrice: "", listPrice: "", quantity: "1", discount: "0", tax: "0" }));



                              setEditingDealProductId(null);



                              return;



                            }



                            handleSelectCatalogProduct(Number(v));



                          }}



                          className="w-2/3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"



                        >



                          <option value="">{loadingCatalog ? "Loading..." : "-- Create new product --"}</option>



                          {catalogProducts.map((cp) => (



                            <option key={cp.id} value={cp.id}>



                              {cp.name || cp.productName} {cp.code ? `(${cp.code})` : ""}



                            </option>



                          ))}



                        </select>







                        <input



                          type="text"



                          value={productForm.productName}



                          onChange={(e) => setProductForm((prev) => ({ ...prev, productName: e.target.value, productId: "" }))}



                          placeholder="Product name (for new product)"



                          className="w-1/3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"



                        />



                      </div>



                    </div>







                    <div className="grid grid-cols-2 gap-3">



                      <div>



                        <label className="block text-xs font-medium text-slate-700">Product Code (optional)</label>



                        <input



                          value={productForm.productCode}



                          onChange={(e) => setProductForm((prev) => ({ ...prev, productCode: e.target.value }))}



                          placeholder="Code"



                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                        />



                      </div>



                      <div>



                        <label className="block text-xs font-medium text-slate-700">Base Price (₹)</label>



                        <input



                          type="number"



                          min="0"



                          value={productForm.basePrice}



                          onChange={(e) => {



                            const v = e.target.value;



                            setProductForm((prev) => ({



                              ...prev,



                              basePrice: v,



                              listPrice: prev.listPrice || v,



                            }));



                            setProductFormError("");



                          }}



                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                          placeholder="0"



                        />



                      </div>



                    </div>







                    <div className="grid grid-cols-2 gap-3">



                      <div>



                        <label className="block text-xs font-medium text-slate-700">List Price (₹)</label>



                        <input



                          type="number"



                          min="0"



                          value={productForm.listPrice}



                          onChange={(e) => {



                            setProductForm((prev) => ({ ...prev, listPrice: e.target.value }));



                            setProductFormError("");



                          }}



                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                          placeholder="0"



                        />



                      </div>



                      <div>



                        <label className="block text-xs font-medium text-slate-700">Quantity</label>



                        <input



                          type="number"



                          min="0"



                          step="0.01"



                          value={productForm.quantity}



                          onChange={(e) => {



                            setProductForm((prev) => ({ ...prev, quantity: e.target.value }));



                            setProductFormError("");



                          }}



                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                          placeholder="1"



                        />



                      </div>



                    </div>







                    <div className="grid grid-cols-2 gap-3">



                      <div>



                        <label className="block text-xs font-medium text-slate-700">Discount (₹)</label>



                        <input



                          type="number"



                          min="0"



                          value={productForm.discount}



                          onChange={(e) => setProductForm((prev) => ({ ...prev, discount: e.target.value }))}



                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                          placeholder="0"



                        />



                      </div>



                      <div>



                        <label className="block text-xs font-medium text-slate-700">Tax (₹, optional)</label>



                        <input



                          type="number"



                          min="0"



                          value={productForm.tax}



                          onChange={(e) => setProductForm((prev) => ({ ...prev, tax: e.target.value }))}



                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                          placeholder="0"



                        />



                      </div>



                    </div>







                    {productFieldDefs.length > 0 && (



                      <div>



                        <DynamicFieldsSection



                          title="Product Custom Fields"



                          definitions={productFieldDefs}



                          values={productCustomValues[editingDealProductId || 'new'] || {}}



                          onChange={(k, v) => {



                            setProductCustomValues((prev) => {



                              const key = editingDealProductId || 'new';



                              return { ...prev, [key]: { ...(prev[key] || {}), [k]: v } };



                            });



                          }}



                        />



                      </div>



                    )}







                    <div>



                      <label className="block text-xs font-medium text-slate-700">Final Amount (₹)</label>



                      <input



                        type="text"



                        readOnly



                        value={productFinalAmount.toLocaleString("en-IN", {



                          maximumFractionDigits: 2,



                        })}



                        className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900"



                      />



                    </div>



                  </div>



                </div>







                <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">



                  <div className="flex items-center justify-end gap-3">



                    <button



                      type="button"



                      onClick={closeProductModal}



                      className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"



                    >



                      Cancel



                    </button>



                    <button



                      type="button"



                      onClick={saveProductFromModal}



                      className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/40 transition hover:translate-y-[1px] hover:shadow-lg"



                    >



                      {editingDealProductId ? "Update Product" : "Save Product"}



                    </button>



                  </div>



                </div>



              </div>



            </div>



          </>



        )}







        {/* ✅ FIX: Single backdrop for any open drawer */}

        {activeDrawer && (



          <div



            className="fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-[2px]"



            onClick={() => setActiveDrawer(null)}

          />



        )}







        {/* ✅ FIX: Task drawer - only renders when activeDrawer === 'task' */}

        {activeDrawer === "task" && (

        <div

          className="fixed inset-y-0 right-0 z-[70] w-full max-w-[460px] transform bg-white shadow-2xl shadow-slate-900/30 transition-transform duration-300 ease-out translate-x-0"



          onClick={(e) => e.stopPropagation()}



        >



          <div className="flex h-full flex-col">



            <div className="border-b border-slate-200/80 px-5 py-4">



              <div className="flex items-start justify-between gap-4">



                <div>



                  <div className="text-sm font-semibold text-slate-900">Create Task</div>



                  <div className="mt-0.5 text-xs text-slate-500">Add a new task for this customer</div>



                </div>



                <button



                  type="button"



                  onClick={closeTaskCreate}



                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"



                >



                  <XCircle className="h-5 w-5" />



                </button>



              </div>



            </div>







            <div className="flex-1 overflow-y-auto px-5 py-4">



              <div className="space-y-4">



                <div>



                  <label className="block text-xs font-medium text-slate-700">Task Name</label>



                  <input



                    value={taskForm.name}



                    onChange={(e) => setTaskForm((p) => ({ ...p, name: e.target.value }))}



                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                    placeholder="Enter task name"



                  />



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Due Date</label>



                    <input



                      type="date"



                      value={taskForm.dueDate}



                      onChange={(e) => setTaskForm((p) => ({ ...p, dueDate: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    />



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Related To</label>



                    <input



                      value={taskForm.relatedTo}



                      onChange={(e) => setTaskForm((p) => ({ ...p, relatedTo: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                      placeholder={safeCustomer.name}



                    />



                  </div>



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Repeat</label>



                    <select



                      value={taskForm.repeat}



                      onChange={(e) => setTaskForm((p) => ({ ...p, repeat: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>Never</option>



                      <option>Daily</option>



                      <option>Weekly</option>



                      <option>Monthly</option>



                    </select>



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Reminder</label>



                    <select



                      value={taskForm.reminder}



                      onChange={(e) => setTaskForm((p) => ({ ...p, reminder: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>None</option>



                      <option>5 minutes before</option>



                      <option>15 minutes before</option>



                      <option>1 hour before</option>



                    </select>



                  </div>



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Task Status</label>



                    <select



                      value={taskForm.status}



                      onChange={(e) => setTaskForm((p) => ({ ...p, status: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>Open</option>



                      <option>In Progress</option>



                      <option>Completed</option>



                    </select>



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Priority</label>



                    <select



                      value={taskForm.priority}



                      onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>Normal</option>



                      <option>High</option>



                      <option>Low</option>



                    </select>



                  </div>



                </div>







                <div>



                  <label className="block text-xs font-medium text-slate-700">Description</label>



                  <textarea



                    value={taskForm.description}



                    onChange={(e) => setTaskForm((p) => ({ ...p, description: e.target.value }))}



                    className="mt-1 h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                    placeholder="Add details / notes"



                  />



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Expense Amount</label>



                    <input



                      value={taskForm.expenseAmount}



                      onChange={(e) => setTaskForm((p) => ({ ...p, expenseAmount: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                      placeholder="0"



                    />



                  </div>



                  <div className="flex items-end">



                    <label className="inline-flex items-center gap-2 text-sm text-slate-700">



                      <input



                        type="checkbox"



                        checked={taskForm.completed}



                        onChange={(e) => setTaskForm((p) => ({ ...p, completed: e.target.checked }))}



                        className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"



                      />



                      Mark as completed



                    </label>



                  </div>



                </div>



              </div>



            </div>







            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">



              <div className="flex items-center justify-end gap-3">



                <button



                  type="button"



                  onClick={closeTaskCreate}



                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"



                >



                  Cancel



                </button>



                <button



                  type="button"



                  onClick={saveTask}



                  className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/40 transition hover:translate-y-[1px] hover:shadow-lg"



                >



                  Save



                </button>



              </div>



            </div>



          </div>



        </div>



        )}







        {/* ✅ FIX: Event drawer - only renders when activeDrawer === 'event' */}

        {activeDrawer === "event" && (

        <div



          className="fixed inset-y-0 right-0 z-[70] w-full max-w-[460px] transform bg-white shadow-2xl shadow-slate-900/30 transition-transform duration-300 ease-out translate-x-0"



          onClick={(e) => e.stopPropagation()}



        >



          <div className="flex h-full flex-col">



            <div className="border-b border-slate-200/80 px-5 py-4">



              <div className="flex items-start justify-between gap-4">



                <div>



                  <div className="text-sm font-semibold text-slate-900">Create Event</div>



                  <div className="mt-0.5 text-xs text-slate-500">Schedule an event</div>



                </div>



                <button



                  type="button"



                  onClick={closeEventCreate}



                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"



                >



                  <XCircle className="h-5 w-5" />



                </button>



              </div>



            </div>







            <div className="flex-1 overflow-y-auto px-5 py-4">



              <div className="space-y-4">



                <div>



                  <label className="block text-xs font-medium text-slate-700">Title</label>



                  <input



                    value={eventForm.title}



                    onChange={(e) => setEventForm((p) => ({ ...p, title: e.target.value }))}



                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                    placeholder="Event title"



                  />



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">From</label>



                    <input



                      type="datetime-local"



                      value={eventForm.from}



                      onChange={(e) => setEventForm((p) => ({ ...p, from: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    />



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">To</label>



                    <input



                      type="datetime-local"



                      value={eventForm.to}



                      onChange={(e) => setEventForm((p) => ({ ...p, to: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    />



                  </div>



                </div>







                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] text-amber-800">



                  Working hours warning: please ensure timing is within business hours.



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Repeat</label>



                    <select



                      value={eventForm.repeat}



                      onChange={(e) => setEventForm((p) => ({ ...p, repeat: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>Never</option>



                      <option>Daily</option>



                      <option>Weekly</option>



                      <option>Monthly</option>



                    </select>



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Reminder</label>



                    <select



                      value={eventForm.reminder}



                      onChange={(e) => setEventForm((p) => ({ ...p, reminder: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>None</option>



                      <option>15 minutes before</option>



                      <option>1 hour before</option>



                      <option>1 day before</option>



                    </select>



                  </div>



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Location</label>



                    <input



                      value={eventForm.location}



                      onChange={(e) => setEventForm((p) => ({ ...p, location: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                      placeholder="Meeting room / link"



                    />



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Related To</label>



                    <input



                      value={eventForm.relatedTo}



                      onChange={(e) => setEventForm((p) => ({ ...p, relatedTo: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                      placeholder={safeCustomer.name}



                    />



                  </div>



                </div>







                <div>



                  <label className="block text-xs font-medium text-slate-700">Participants</label>



                  <input



                    value={eventForm.participants}



                    onChange={(e) => setEventForm((p) => ({ ...p, participants: e.target.value }))}



                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                    placeholder="Add participants"



                  />



                </div>







                <div>



                  <label className="block text-xs font-medium text-slate-700">Description</label>



                  <textarea



                    value={eventForm.description}



                    onChange={(e) => setEventForm((p) => ({ ...p, description: e.target.value }))}



                    className="mt-1 h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                    placeholder="Agenda / notes"



                  />



                </div>



              </div>



            </div>







            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">



              <div className="flex items-center justify-end gap-3">



                <button



                  type="button"



                  onClick={closeEventCreate}



                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"



                >



                  Cancel



                </button>



                <button



                  type="button"



                  onClick={saveEvent}



                  className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/40 transition hover:translate-y-[1px] hover:shadow-lg"



                >



                  Save



                </button>



              </div>



            </div>



          </div>



        </div>



        )}







        {/* ✅ FIX: Call drawer - only renders when activeDrawer === 'call' */}

        {activeDrawer === "call" && (

        <div

          className="fixed inset-y-0 right-0 z-[70] w-full max-w-[460px] transform bg-white shadow-2xl shadow-slate-900/30 transition-transform duration-300 ease-out translate-x-0"

          onClick={(e) => e.stopPropagation()}

        >



          <div className="flex h-full flex-col">



            <div className="border-b border-slate-200/80 px-5 py-4">



              <div className="flex items-start justify-between gap-4">



                <div>



                  <div className="text-sm font-semibold text-slate-900">Create Call</div>



                  <div className="mt-0.5 text-xs text-slate-500">Log a call activity</div>



                </div>



                <button



                  type="button"



                  onClick={(e) => {

                    e.stopPropagation();

                    closeCallCreate();

                  }}



                  className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"



                >



                  <XCircle className="h-5 w-5" />



                </button>



              </div>



            </div>







            <div className="flex-1 overflow-y-auto px-5 py-4">



              <div className="space-y-4">



                <div>



                  <label className="block text-xs font-medium text-slate-700">To / From</label>



                  <input



                    value={callForm.toFrom}



                    onChange={(e) => setCallForm((p) => ({ ...p, toFrom: e.target.value }))}



                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                    placeholder="Contact name / number"



                  />



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Call Start Time</label>



                    <input



                      type="datetime-local"



                      value={callForm.startTime}



                      onChange={(e) => setCallForm((p) => ({ ...p, startTime: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    />



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Reminder</label>



                    <select



                      value={callForm.reminder}



                      onChange={(e) => setCallForm((p) => ({ ...p, reminder: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>None</option>



                      <option>15 minutes before</option>



                      <option>1 hour before</option>



                    </select>



                  </div>



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Call Type</label>



                    <select



                      value={callForm.callType}



                      onChange={(e) => setCallForm((p) => ({ ...p, callType: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>Outbound</option>



                      <option>Inbound</option>



                    </select>



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Call Status</label>



                    <select



                      value={callForm.callStatus}



                      onChange={(e) => setCallForm((p) => ({ ...p, callStatus: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                    >



                      <option>Planned</option>



                      <option>Completed</option>



                      <option>Missed</option>



                    </select>



                  </div>



                </div>







                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Related To</label>



                    <input



                      value={callForm.relatedTo}



                      onChange={(e) => setCallForm((p) => ({ ...p, relatedTo: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 focus:border-indigo-400"



                      placeholder={safeCustomer.name}



                    />



                  </div>



                  <div>



                    <label className="block text-xs font-medium text-slate-700">Call Duration</label>



                    <input



                      value={callForm.duration}



                      onChange={(e) => setCallForm((p) => ({ ...p, duration: e.target.value }))}



                      className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                      placeholder="e.g. 05:30"



                    />



                  </div>



                </div>







                <div>



                  <label className="block text-xs font-medium text-slate-700">Call Agenda</label>



                  <textarea



                    value={callForm.callAgenda}



                    onChange={(e) => setCallForm((p) => ({ ...p, callAgenda: e.target.value }))}



                    className="mt-1 h-24 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400"



                    placeholder="Agenda / notes"



                  />



                </div>



              </div>



            </div>







            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">



              <div className="flex items-center justify-end gap-3">



                <button



                  type="button"



                  onClick={(e) => {

                    e.stopPropagation();

                    closeCallCreate();

                  }}



                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"



                >



                  Cancel



                </button>



                <button



                  type="button"



                  onClick={saveCall}



                  className="rounded-full bg-gradient-to-r from-indigo-600 to-sky-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/40 transition hover:translate-y-[1px] hover:shadow-lg"



                >



                  Save



                </button>



              </div>



            </div>



          </div>



        </div>

        )}



        {isCaseModalOpen && (



          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-sm">



            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-950/95 p-6 shadow-2xl shadow-slate-950/70">



              <div className="mb-4 flex items-center justify-between">



                <div>



                  <h2 className="text-sm font-semibold text-slate-50">Create New Case</h2>



                  <p className="text-xs text-slate-500">Link a new legal/billing case to this customer</p>



                </div>



                <button



                  onClick={() => setIsCaseModalOpen(false)}



                  className="rounded-full p-1.5 text-slate-500 transition hover:bg-slate-800 hover:text-slate-100"



                >



                  ✕



                </button>



              </div>



              <form onSubmit={handleAddCase} className="space-y-4">



                <div>



                  <label className="block text-xs font-medium text-slate-300">Case Name</label>



                  <DynamicFieldsSection



                    entity="client"



                    entityId={safeCustomer?.id}



                    values={form?.customFields || {}}



                    onChange={(values) =>



                      setForm((prev) => ({



                        ...prev,



                        customFields: values



                      }))



                    }



                  />



                  <input



                    type="text"



                    value={caseName}



                    onChange={(e) => setCaseName(e.target.value)}



                    className="mt-1 w-full rounded-full border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-100 placeholder:text-slate-500 focus:border-indigo-400"



                    placeholder="Enter case name"



                    required



                  />



                </div>



                <div className="mt-4 flex justify-end gap-3">



                  <button



                    type="button"



                    onClick={() => setIsCaseModalOpen(false)}



                    className="rounded-full border border-slate-600 px-4 py-2 text-xs font-medium text-slate-200 hover:bg-slate-800"



                  >



                    Cancel



                  </button>



                  <button



                    type="submit"



                    className="rounded-full bg-gradient-to-r from-indigo-500 to-sky-500 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-indigo-500/40 hover:translate-y-[1px] hover:shadow-lg"



                  >



                    Add Case



                  </button>



                </div>



              </form>



            </div>



          </div>



        )}



      </div>



    </div>



    </div>







    {/* Modals */}



    <>



      {/* Bank Picker Modal */}



      {showBankPicker && (



        <>



        <div



          className="fixed inset-0 z-[65] bg-slate-900/60 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]"



          onClick={closeBankPicker}



        />



        <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">



          <div



            className="relative flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/50 animate-[scaleIn_0.2s_ease-out]"



            onClick={(e) => e.stopPropagation()}



          >



            <div className="flex items-start justify-between border-b border-slate-200/80 px-5 py-4">



              <div>



                <div className="text-sm font-semibold text-slate-900">Select Bank</div>



                <div className="mt-0.5 text-xs text-slate-500">



                  Choose a bank to associate with this deal



                </div>



              </div>



              <button



                type="button"



                onClick={closeBankPicker}



                className="rounded-full p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-700"



              >



                <XCircle className="h-5 w-5" />



              </button>



            </div>







            <div className="max-h-[70vh] flex-1 overflow-y-auto px-5 py-4">



              {bankFormError && (



                <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">



                  {bankFormError}



                </div>



              )}







              <div className="mb-4">



                <div className="relative">



                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />



                  <input



                    type="text"



                    value={bankSearch}



                    onChange={(e) => {



                      setBankSearch(e.target.value);



                      setBankFormError("");



                    }}



                    placeholder="Search banks by name, branch, owner..."



                    className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-4 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-400 focus:bg-white"



                  />



                </div>



              </div>







              <div className="space-y-2">



                {banks



                  .filter((b) => {



                    const q = bankSearch.trim().toLowerCase();



                    return (



                      b.name?.toLowerCase().includes(q) ||



                      b.branch?.toLowerCase().includes(q) ||



                      b.owner?.toLowerCase().includes(q) ||



                      b.phone?.includes(q)



                    );



                  })



                  .map((bankItem) => (



                    <div



                      key={bankItem.id}



                      onClick={() => selectBank(bankItem)}



                      className="flex items-center justify-between rounded-xl border border-slate-200 p-4 hover:bg-slate-50 cursor-pointer transition-colors"



                    >



                      <div className="flex items-center gap-3">



                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 text-blue-600">



                          <Building2 className="h-5 w-5" />



                        </div>



                        <div>



                          <div className="text-sm font-medium text-slate-900">{bankItem.name}</div>



                          <div className="text-xs text-slate-500">



                            {bankItem.branch} • {bankItem.owner}



                          </div>



                        </div>



                      </div>



                      <div className="text-xs text-slate-400">



                        <ChevronRight className="h-4 w-4" />



                      </div>



                    </div>



                  ))}



              </div>







              {banks.filter((b) => {



                const q = bankSearch.trim().toLowerCase();



                return (



                  b.name?.toLowerCase().includes(q) ||



                  b.branch?.toLowerCase().includes(q) ||



                  b.owner?.toLowerCase().includes(q) ||



                  b.phone?.includes(q)



                );



              }).length === 0 && (



                <div className="py-8 text-center text-sm text-slate-500">



                  No banks found. <a href="/bank" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">Create a new bank</a>



                </div>



              )}



            </div>







            <div className="sticky bottom-0 border-t border-slate-200 bg-white px-5 py-4">



              <div className="flex items-center justify-end gap-3">



                <button



                  type="button"



                  onClick={closeBankPicker}



                  className="rounded-full border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:border-slate-400 hover:bg-slate-50"



                >



                  Cancel



                </button>



              </div>



            </div>



          </div>



        </div>



        </> 



      )}







      {/* Customer Edit Modal */}



      {showCustomerEditModal && (



        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">



          <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl backdrop-blur-md">



            <div className="flex items-center justify-between border-b border-slate-200/80 p-6">



              <h2 className="text-lg font-semibold text-slate-900">Edit Customer</h2>



              <button



                onClick={() => setShowCustomerEditModal(false)}



                className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"



              >



                <X className="h-5 w-5" />



              </button>



            </div>



            



            <div className="p-6 space-y-4">



            <div>



              <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>



              <input



                type="text"



                value={customerEditForm.name || ""}



                onChange={(e) => setCustomerEditForm({...customerEditForm, name: e.target.value})}



                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



              />



            </div>



            



            <div>



              <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>



              <input



                type="email"



                value={customerEditForm.email || ""}



                onChange={(e) => setCustomerEditForm({...customerEditForm, email: e.target.value})}



                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



              />



            </div>



            



            <div>



              <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>



              <input



                type="tel"



                value={customerEditForm.phone || ""}



                onChange={(e) => setCustomerEditForm({...customerEditForm, phone: e.target.value})}



                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



              />



            </div>







            {/* Address Section */}



            <div className="border-t pt-4">



              <h4 className="text-sm font-medium text-slate-900 mb-3">Address Information</h4>



              <div className="space-y-3">



                <div>



                  <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>



                  <textarea



                    value={customerEditForm.address || ""}



                    onChange={(e) => setCustomerEditForm({...customerEditForm, address: e.target.value})}



                    rows={3}



                    className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



                  />



                </div>



                



                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-sm font-medium text-slate-700 mb-1">City</label>



                    <input



                      type="text"



                      value={customerEditForm.city || ""}



                      onChange={(e) => setCustomerEditForm({...customerEditForm, city: e.target.value})}



                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



                    />



                  </div>



                  <div>



                    <label className="block text-sm font-medium text-slate-700 mb-1">Pincode</label>



                    <input



                      type="text"



                      value={customerEditForm.pincode || ""}



                      onChange={(e) => setCustomerEditForm({...customerEditForm, pincode: e.target.value})}



                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



                    />



                  </div>



                </div>



                



                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-sm font-medium text-slate-700 mb-1">State</label>



                    <input



                      type="text"



                      value={customerEditForm.state || ""}



                      onChange={(e) => setCustomerEditForm({...customerEditForm, state: e.target.value})}



                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



                    />



                  </div>



                  <div>



                    <label className="block text-sm font-medium text-slate-700 mb-1">Country</label>



                    <input



                      type="text"



                      value={customerEditForm.country || ""}



                      onChange={(e) => setCustomerEditForm({...customerEditForm, country: e.target.value})}



                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



                    />



                  </div>



                </div>



              </div>



            </div>







            {/* Contact Section */}



            <div className="border-t pt-4">



              <h4 className="text-sm font-medium text-slate-900 mb-3">Contact Information</h4>



              <div className="space-y-3">



                <div className="grid grid-cols-2 gap-3">



                  <div>



                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Name</label>



                    <input



                      type="text"



                      value={customerEditForm.contactName || ""}



                      onChange={(e) => setCustomerEditForm({...customerEditForm, contactName: e.target.value})}



                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



                    />



                  </div>



                  <div>



                    <label className="block text-sm font-medium text-slate-700 mb-1">Contact Number</label>



                    <input



                      type="tel"



                      value={customerEditForm.contactNumber || ""}



                      onChange={(e) => setCustomerEditForm({...customerEditForm, contactNumber: e.target.value})}



                      className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



                    />



                  </div>



                </div>



              </div>



            </div>



            



            <div>



              <label className="block text-sm font-medium text-slate-700 mb-1">Bank</label>



              <select



                value={customerEditForm.bankId || ""}



                onChange={(e) => setCustomerEditForm({...customerEditForm, bankId: e.target.value})}



                className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"



              >



                <option value="">Select bank</option>



                {banks.map((bankItem) => (



                  <option key={bankItem.id} value={bankItem.id}>



                    {bankItem.name}



                  </option>



                ))}



              </select>



            </div>



          </div>



          



          <div className="flex justify-end gap-3 border-t border-slate-200/80 p-6">



            <button



              onClick={() => setShowCustomerEditModal(false)}



              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"



            >



              Cancel



            </button>



            <button



              onClick={handleCustomerUpdate}



              className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-blue-500/30 transition hover:translate-y-[1px] hover:shadow-lg"



            >



              Save Changes



            </button>



          </div>



        </div>



      </div>



    )}



    </>



    {/* 🎯 Account Transfer Confirmation Dialog */}

    <AccountTransferDialog

      isOpen={showAccountTransferDialog}

      dealName={deal?.name || "Untitled Deal"}

      customerName={customer?.name || "Unknown Customer"}

      customerEmail={customer?.email || ""}

      customerPhone={customer?.contactPhone || customer?.phone || ""}

      customerAddress={customer?.addresses?.[0] || {}} // Use first address from addresses array

      customerProducts={products || []}

      dealValue={grandTotal} // ✅ FIXED: Use calculated grandTotal instead of dealValue

      onConfirm={async () => {

        await executeStageChange(pendingStageChange);

        setShowAccountTransferDialog(false);

        setPendingStageChange(null);

        // ✅ FIXED: Show success message

        showSuccess("Deal successfully sent to Accounts. Accounts team has been notified.");

      }}

      onCancel={() => {

        setShowAccountTransferDialog(false);

        setPendingStageChange(null);

      }}

    />



    {/* 🔥 NEW: Approval Modal */}

    <ApprovalModal

      isOpen={approvalModal.isOpen}

      type={approvalModal.type}

      title={approvalModal.title}

      message={approvalModal.message}

      onConfirm={approvalModal.onConfirm}

      onCancel={approvalModal.onCancel}

      confirmText={approvalModal.confirmText}

      cancelText={approvalModal.cancelText}

    />



    </DashboardLayout>



  );



}







function PaperclipIcon() {



  return (



    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">



      <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.19 9.19a2 2 0 01-2.83-2.83l9.19-9.19" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />



    </svg>



  );



}







function FolderIcon() {



  return (



    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">



      <path d="M2 6a2 2 0 012-2h3.5a2 2 0 011.6.8l1.3 1.733A1 1 0 0011.5 7H16a2 2 0 012 2v5a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />



    </svg>



  );



}







function PdfIcon() {



  return (



    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">



      <path d="M4 2a2 2 0 00-2 2v12a2 2 0 002 2h8.5a2 2 0 001.414-.586l3.5-3.5A2 2 0 0018 13.5V4a2 2 0 00-2-2H4z" />



    </svg>



  );



}







function TrashIcon() {



  return (



    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">



      <path



        fillRule="evenodd"



        d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM8 8a1 1 0 012 0v7a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v7a1 1 0 102 0V8a1 1 0 00-1-1z"



        clipRule="evenodd"



      />



    </svg>



  );



}








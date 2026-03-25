'use client';



import { useState, useEffect, useRef, useMemo } from 'react';

import { Calendar, Plus, Edit, Trash2, Save, X, Search, Loader2 } from 'lucide-react';

import InvoiceItemTable from './InvoiceItemTable';

import DateField from './DateField';

import UpiQrCode from './UpiQrCode';

import LogoSignatureUpload from './LogoSignatureUpload';

import { backendApi } from '../../../services/api';

import { invoiceService } from '../../../services/invoiceService';

import { generateInvoicePdf } from '../../../utils/pdfGenerator';



export default function InvoiceForm({ initialData, onSave, onCancel, onChange }) {

  // Form state

  const [formData, setFormData] = useState({

    invoiceNo: '',

    invoiceDate: new Date(),

    dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),

    isProForma: false,

    includeGst: true,

    

    // Billed By

    billedByName: '',

    billedByAddress: '',

    billedByEmail: '',

    gstin: '',

    pan: '',

    

    // Billed To

    billedToName: '',

    billedToAddress: '',

    billedToGstin: '',

    billedToMobile: '',

    billedToEmail: '',

    billedToBranch: '',



    selectedBankName: '',

    selectedBranch: '',

    selectedCustomer: null,

    

    // Bank Details

    accountName: '',

    accountNumber: '',

    ifsc: '',

    accountType: '',

    bank: '',

    upiId: '',

    

    // Terms

    terms: '',

    

    // Logo and Signature

    companyLogo: '',

    signature: '',

    

    // Items

    items: []

  });



  const [loading, setLoading] = useState(false);

  const isSubmitting = useRef(false);



  // Client selection state

  const [clients, setClients] = useState([]);

  const [loadingClients, setLoadingClients] = useState(false);

  const [loadingClientProducts, setLoadingClientProducts] = useState(false);

  const [clientSearchTerm, setClientSearchTerm] = useState('');

  const [showClientDropdown, setShowClientDropdown] = useState(false);



  // Bank selection state

  const [banks, setBanks] = useState([]);

  const [selectedBank, setSelectedBank] = useState(null);

  const [loadingBanks, setLoadingBanks] = useState(false);

  const [bankSearchTerm, setBankSearchTerm] = useState('');

  const [showBankDropdown, setShowBankDropdown] = useState(false);



  // Load initial data

  useEffect(() => {

    if (!initialData) return;



    setFormData(prev => ({

      ...prev,

      ...initialData,

      invoiceDate: new Date(initialData.invoiceDate),

      dueDate: new Date(initialData.dueDate),

      companyLogo: initialData.companyLogo ?? prev.companyLogo,

      signature: initialData.signature ?? prev.signature,

      items: Array.isArray(initialData.items) ? initialData.items : []

    }));

  }, [initialData?.id]);



  // Reset form when initialData changes to null (for create mode)

  useEffect(() => {

    if (!initialData) {

      loadPersistedFields();

    }

  }, [initialData]);



  // Fetch clients on component mount

  useEffect(() => {

    fetchClients();

  }, []);



  // Fetch banks on component mount

  useEffect(() => {

    fetchBanks();

  }, []);



  // Fetch clients from API

  const fetchClients = async () => {

    setLoadingClients(true);

    try {

      const clientsData = await invoiceService.getCustomers();

      setClients(clientsData || []);

    } catch (error) {

      console.error('Failed to fetch clients:', error);

      setClients([]);

    } finally {

      setLoadingClients(false);

    }

  };



  const fetchBanks = async () => {

    setLoadingBanks(true);

    try {

      const banksData = await invoiceService.getBanks();

      setBanks(banksData || []);

    } catch (error) {

      console.error('Failed to fetch banks:', error);

      setBanks([]);

    } finally {

      setLoadingBanks(false);

    }

  };



  const parseBranches = (branchName) => {

    if (!branchName) return [];

    const s = String(branchName);

    return s

      .split(/[,|/]/g)

      .map((b) => b.trim())

      .filter(Boolean);

  };



  // Handle client selection

  const handleClientSelect = async (client) => {

    console.log("Selected Client:", client); // Debug log to verify correct client

    

    // Use setTimeout to avoid setState during render

    setTimeout(() => {

      setFormData((prev) => {

        const next = {

          ...prev,

          selectedCustomer: client || null,

          billedToMobile: client?.contactPhone || client?.contactNumber || '',

          billedToEmail: client?.email || '',

          billedToGstin: client?.gstin || '',

          billedToAddress: client?.address || prev.billedToAddress

        };

        console.log('handleClientSelect - formData after:', { selectedCustomer: next.selectedCustomer?.name, selectedBankName: next.selectedBankName });

        onChange?.(next);

        return next;

      });

    }, 0);



    setShowClientDropdown(false);

    setClientSearchTerm(''); // Clear search term so input shows selected client name

    

    console.log("Client object used:", {

      name: client.name,

      contactPhone: client.contactPhone,

      contactNumber: client.contactNumber,

      email: client.email,

      address: client.address,

      gstin: client.gstin

    });



    // Fetch client's deal products

    await fetchClientProducts(client.id);

  };



  // Handle manual name change (when user types instead of selecting)

  const handleManualNameChange = (value) => {

    setClientSearchTerm(value);

    setShowClientDropdown(true);



    // If user starts typing, clear selected customer to avoid UI conflicts

    if (formData.selectedCustomer) {

      // Use setTimeout to avoid setState during render

      setTimeout(() => {

        setFormData((prev) => {

          const next = {

            ...prev,

            selectedCustomer: null

          };

          onChange?.(next);

          return next;

        });

      }, 0);

    }



    // If user clears the search, clear the selected customer

    if (!value.trim()) {

      // Use setTimeout to avoid setState during render

      setTimeout(() => {

        setFormData((prev) => {

          const next = {

            ...prev,

            selectedCustomer: null

          };

          onChange?.(next);

          return next;

        });

      }, 0);

    }

  };



  const handleBankSelect = (bank) => {

    console.log('Selected Bank:', bank);

    setSelectedBank(bank);

    setShowBankDropdown(false);

    setBankSearchTerm('');



    // Use setTimeout to avoid setState during render

    setTimeout(() => {

      setFormData((prev) => {

        const branches = parseBranches(bank?.branchName);

        const nextSelectedBranch = branches.length === 1 ? branches[0] : '';

        const next = {

          ...prev,

          selectedBankName: bank?.name || '',

          selectedBranch: nextSelectedBranch,

          billedToName: bank?.name || prev.billedToName,

          billedToAddress: bank?.address || prev.billedToAddress

        };

        console.log('handleBankSelect - formData after:', { selectedBankName: next.selectedBankName, selectedCustomer: next.selectedCustomer?.name });

        onChange?.(next);

        return next;

      });

    }, 0);

  };



  const handleBranchSelect = (branch) => {

    // Use setTimeout to avoid setState during render

    setTimeout(() => {

      setFormData((prev) => {

        const next = {

          ...prev,

          selectedBranch: branch || ''

        };

        onChange?.(next);

        return next;

      });

    }, 0);

  };



  const handleManualBankNameChange = (value) => {

    setBankSearchTerm(value);

    setShowBankDropdown(true);



    if (!value.trim()) {

      setSelectedBank(null);

      // Use setTimeout to avoid setState during render

      setTimeout(() => {

        setFormData((prev) => {

          const next = {

            ...prev,

            selectedBankName: '',

            selectedBranch: '',

            billedToName: '',

            billedToAddress: ''

          };

          onChange?.(next);

          return next;

        });

      }, 0);

    }



    if (!selectedBank) {

      // Use setTimeout to avoid setState during render

      setTimeout(() => {

        setFormData((prev) => {

          const next = {

            ...prev,

            selectedBankName: value,

            billedToName: value

          };

          onChange?.(next);

          return next;

        });

      }, 0);

    }

  };



  // Fetch client's deal products

  const fetchClientProducts = async (clientId) => {

    setLoadingClientProducts(true);

    try {

      const products = await invoiceService.getClientDealProducts(clientId);

      

      if (products && products.length > 0) {

        // Map deal products to invoice items

        const invoiceItems = products.map(product => ({

          id: Date.now() + Math.random(), // temporary ID

          name: product.productName || '',

          description: '',

          qty: product.quantity || 1,

          rate: product.unitPrice || 0,

          discount: product.discount || 0,

          tax: product.tax || 0,

          total: product.total || (product.quantity * product.unitPrice) || 0

        }));

        

        setFormData((prev) => {

          const next = {

            ...prev,

            items: invoiceItems

          };

          onChange?.(next);

          return next;

        });

      }

    } catch (error) {

      console.error('Failed to fetch client products:', error);

    } finally {

      setLoadingClientProducts(false);

    }

  };



  // Filter clients based on search term

  const filteredClients = clients.filter(client =>

    client.name?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||

    client.email?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||

    client.contactPhone?.includes(clientSearchTerm)

  );



  const filteredBanks = banks.filter(bank =>

    bank.name?.toLowerCase().includes(bankSearchTerm.toLowerCase()) ||

    bank.branchName?.toLowerCase().includes(bankSearchTerm.toLowerCase())

  );



  // Load persisted fields from localStorage

  const loadPersistedFields = () => {

    const persistedFields = [

      'billedByName', 'billedByAddress', 'billedByEmail', 'gstin', 'pan',

      'accountName', 'accountNumber', 'ifsc', 'accountType', 'bank', 'upiId', 'terms'

    ];

    

    const loaded = {};

    persistedFields.forEach(field => {

      const value = localStorage.getItem(`invoice_${field}`);

      if (value) loaded[field] = value;

    });

    

    setFormData(prev => ({ ...prev, ...loaded }));

  };



  // Save field to localStorage

  const saveField = (field, value) => {

    localStorage.setItem(`invoice_${field}`, value);

  };



  // Calculate totals

  const calculateTotals = () => {

    const subtotal = formData.items.reduce((sum, item) => sum + (item.qty * item.rate), 0);

    const cgst = formData.includeGst ? subtotal * 0.09 : 0;

    const sgst = formData.includeGst ? subtotal * 0.09 : 0;

    const grandTotal = subtotal + cgst + sgst;

    

    return { subtotal, cgst, sgst, grandTotal };

  };



  const { subtotal, cgst, sgst, grandTotal } = calculateTotals();



  const upiUri = useMemo(() => {

    if (!formData.upiId || !formData.accountName) return '';



    const amount = Number(grandTotal) || 0;

    const params = new URLSearchParams({

      pa: formData.upiId.trim(),

      pn: formData.accountName.trim(),

      am: amount.toFixed(2),

      cu: 'INR',

      tn: 'Invoice Payment'

    });



    const uri = `upi://pay?${params.toString()}`;

    console.log('[UPI] QR payload:', { upiId: formData.upiId, accountName: formData.accountName, grandTotal: amount, uri });

    return uri;

  }, [formData.upiId, formData.accountName, grandTotal]);



  // Format currency

  const formatCurrency = (amount) => {

    return new Intl.NumberFormat('en-IN', {

      style: 'currency',

      currency: 'INR'

    }).format(amount);

  };



  // Convert amount to words (Indian format)

  const amountInWords = (num) => {

    const units = ['', 'ONE', 'TWO', 'THREE', 'FOUR', 'FIVE', 'SIX', 'SEVEN', 'EIGHT', 'NINE', 'TEN',

      'ELEVEN', 'TWELVE', 'THIRTEEN', 'FOURTEEN', 'FIFTEEN', 'SIXTEEN', 'SEVENTEEN', 'EIGHTEEN', 'NINETEEN'];

    const tens = ['', '', 'TWENTY', 'THIRTY', 'FORTY', 'FIFTY', 'SIXTY', 'SEVENTY', 'EIGHTY', 'NINETY'];



    const two = (n) => {

      if (n < 20) return units[n];

      const t = Math.floor(n / 10);

      const u = n % 10;

      return u === 0 ? tens[t] : `${tens[t]} ${units[u]}`;

    };



    const three = (n) => {

      const h = Math.floor(n / 100);

      const rest = n % 100;

      if (h === 0) return two(rest);

      return rest === 0 ? `${units[h]} HUNDRED` : `${units[h]} HUNDRED ${two(rest)}`;

    };



    if (num === 0) return '';



    let n = Math.round(num);

    const crore = Math.floor(n / 10000000);

    n %= 10000000;

    const lakh = Math.floor(n / 100000);

    n %= 100000;

    const thousand = Math.floor(n / 1000);

    n %= 1000;

    const hundred = n;



    let result = '';

    if (crore > 0) result += `${two(crore)} CRORE `;

    if (lakh > 0) result += `${two(lakh)} LAKH `;

    if (thousand > 0) result += `${two(thousand)} THOUSAND `;

    if (hundred > 0) result += `${three(hundred)} `;



    return result.trim();

  };



  // Generate UPI URI

  const generateUpiUri = () => upiUri;



  // Handle form submission

  const handleSubmit = async (e) => {

    e.preventDefault();

    

    // Prevent duplicate submissions

    if (loading || isSubmitting.current) {

      console.log('Form already submitting, ignoring...');

      return;

    }

    

    if (formData.items.length === 0) {

      alert('Please add at least one item');

      return;

    }

    

    if (!formData.billedByName.trim() || !formData.billedToName.trim()) {

      alert('Please fill in Billed By and Billed To names');

      return;

    }



    isSubmitting.current = true;

    setLoading(true);

    try {

      const invoiceData = {

        ...formData,

        subtotal,

        cgst,

        sgst,

        grandTotal,

        // Convert dates to ISO strings for proper serialization

        invoiceDate: formData.invoiceDate.toISOString(),

        dueDate: formData.dueDate.toISOString()

      };

      

      // Remove null/empty logo and signature from payload to prevent overwriting

      if (!invoiceData.companyLogo || invoiceData.companyLogo === 'null') delete invoiceData.companyLogo;

      if (!invoiceData.signature || invoiceData.signature === 'null') delete invoiceData.signature;

      

      // Also remove any undefined values

      Object.keys(invoiceData).forEach(key => {

        if (invoiceData[key] === undefined) delete invoiceData[key];

      });

      

      console.log('Submitting invoice data:', invoiceData); // Debug log

      console.log('Payload size:', JSON.stringify(invoiceData).length, 'characters'); // Debug payload size

      console.log('Has companyLogo:', !!invoiceData.companyLogo, invoiceData.companyLogo?.length || 0);

      console.log('Has signature:', !!invoiceData.signature, invoiceData.signature?.length || 0);

      

      if (initialData?.id) {

        // Update existing invoice - let parent handle API call

        onSave?.(invoiceData);

      } else {

        // Create new invoice

        await backendApi.post('/invoices', invoiceData);

      }

    } catch (err) {

      console.error('Failed to save invoice', err);

      // Let parent handle error with toast notification

      throw err;

    } finally {

      setLoading(false);

      isSubmitting.current = false;

    }

  };



  // Handle field changes

  const handleFieldChange = (field, value) => {

    const newFormData = { ...formData, [field]: value };

    setFormData(newFormData);

    

    // Call onChange callback if provided

    if (onChange) {

      onChange(newFormData);

    }

    

    // Auto-save certain fields

    const autoSaveFields = ['billedByName', 'billedByAddress', 'billedByEmail', 'gstin', 'pan',

      'accountName', 'accountNumber', 'ifsc', 'accountType', 'bank', 'upiId', 'terms'];

    

    if (autoSaveFields.includes(field)) {

      saveField(field, value);

    }

  };



  // Handle items

  const handleAddItem = (item) => {

    const newFormData = {

      ...formData,

      items: [...formData.items, item]

    };

    setFormData(newFormData);

    if (onChange) {

      onChange(newFormData);

    }

  };



  const handleUpdateItem = (index, item) => {

    const newFormData = {

      ...formData,

      items: formData.items.map((i, idx) => idx === index ? item : i)

    };

    setFormData(newFormData);

    if (onChange) {

      onChange(newFormData);

    }

  };



  const handleDeleteItem = (index) => {

    const newFormData = {

      ...formData,

      items: formData.items.filter((_, idx) => idx !== index)

    };

    setFormData(newFormData);

    if (onChange) {

      onChange(newFormData);

    }

  };



  return (

    <form id="invoice-form" onSubmit={handleSubmit} className="space-y-8">

      {/* Invoice Details */}

      <div className="bg-white rounded-lg shadow p-6">

        <div className="flex items-center justify-between mb-6">

          <h2 className="text-lg font-semibold text-gray-900">Invoice Details</h2>

          <div className="flex items-center gap-2">

            <label className="flex items-center gap-2">

              <input

                type="radio"

                checked={!formData.isProForma}

                onChange={() => handleFieldChange('isProForma', false)}

                className="text-indigo-600"

              />

              <span className="text-sm">Invoice</span>

            </label>

            <label className="flex items-center gap-2">

              <input

                type="radio"

                checked={formData.isProForma}

                onChange={() => handleFieldChange('isProForma', true)}

                className="text-indigo-600"

              />

              <span className="text-sm">Pro Forma Invoice</span>

            </label>

          </div>

        </div>

        

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Invoice No

            </label>

            <input

              type="text"

              value={formData.invoiceNo}

              onChange={(e) => handleFieldChange('invoiceNo', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

              required

            />

          </div>

          

          <DateField

            label="Invoice Date"

            value={formData.invoiceDate}

            onChange={(date) => handleFieldChange('invoiceDate', date)}

          />

          

          <DateField

            label="Due Date"

            value={formData.dueDate}

            onChange={(date) => handleFieldChange('dueDate', date)}

          />

        </div>

      </div>



      {/* Billed By */}

      <div className="bg-white rounded-lg shadow p-6">

        <div className="flex justify-between items-start mb-6">

          <h2 className="text-lg font-semibold text-gray-900">Billed By</h2>

          <LogoSignatureUpload

            type="logo"

            value={formData.companyLogo}

            onChange={(value) => handleFieldChange('companyLogo', value)}

          />

        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Name

            </label>

            <input

              type="text"

              value={formData.billedByName}

              onChange={(e) => handleFieldChange('billedByName', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

              required

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Email

            </label>

            <input

              type="email"

              value={formData.billedByEmail}

              onChange={(e) => handleFieldChange('billedByEmail', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div className="md:col-span-2">

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Address

            </label>

            <textarea

              value={formData.billedByAddress}

              onChange={(e) => handleFieldChange('billedByAddress', e.target.value)}

              rows={3}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              GSTIN

            </label>

            <input

              type="text"

              value={formData.gstin}

              onChange={(e) => handleFieldChange('gstin', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              PAN

            </label>

            <input

              type="text"

              value={formData.pan}

              onChange={(e) => handleFieldChange('pan', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

        </div>

      </div>



      {/* Billed To */}

      <div className="bg-white rounded-lg shadow p-6">

        <h2 className="text-lg font-semibold text-gray-900 mb-6">Billed To</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="relative">

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Bank

            </label>

            <div className="relative">

              <input

                type="text"

                value={bankSearchTerm || formData.selectedBankName || formData.billedToName}

                onChange={(e) => handleManualBankNameChange(e.target.value)}

                onFocus={() => setShowBankDropdown(true)}

                placeholder="Select bank or type name"

                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

                required

              />

              {loadingBanks ? (

                <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-gray-400" />

              ) : (

                <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />

              )}

              

              {/* Bank Dropdown */}

              {showBankDropdown && (

                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">

                  {filteredBanks.length > 0 ? (

                    filteredBanks.map((bank) => (

                      <div

                        key={bank.id}

                        onClick={() => {

                          console.log('Dropdown clicked - bank:', bank);

                          handleBankSelect(bank);

                        }}

                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"

                      >

                        <div className="font-medium text-gray-900">{bank.name}</div>

                        <div className="text-sm text-gray-500">{bank.branchName}</div>

                      </div>

                    ))

                  ) : (

                    <div className="px-3 py-2 text-gray-500 text-sm">

                      {bankSearchTerm ? 'No banks found' : 'No banks available'}

                    </div>

                  )}

                </div>

              )}

            </div>

            {/* Click outside to close dropdown */}

            {showBankDropdown && (

              <div

                className="fixed inset-0 z-0"

                onClick={() => setShowBankDropdown(false)}

              />

            )}

          </div>



          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Branch

            </label>

            <select

              value={formData.selectedBranch || ''}

              onChange={(e) => handleBranchSelect(e.target.value)}

              disabled={!formData.selectedBankName}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 disabled:bg-gray-100 disabled:text-gray-500"

            >

              <option value="">{formData.selectedBankName ? 'Select branch' : 'Select bank first'}</option>

              {parseBranches(selectedBank?.branchName).map((b) => (

                <option key={b} value={b}>{b}</option>

              ))}

            </select>

          </div>

          

          {!formData.selectedBankName && (

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-1">

                Mobile

              </label>

              <input

                type="tel"

                value={formData.billedToMobile}

                onChange={(e) => handleFieldChange('billedToMobile', e.target.value)}

                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

              />

            </div>

          )}

          

          {!formData.selectedBankName && (

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-1">

                Email

              </label>

              <input

                type="email"

                value={formData.billedToEmail}

                onChange={(e) => handleFieldChange('billedToEmail', e.target.value)}

                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

              />

            </div>

          )}

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              GSTIN

            </label>

            <input

              type="text"

              value={formData.billedToGstin}

              onChange={(e) => handleFieldChange('billedToGstin', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div className="md:col-span-2">

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Address

            </label>

            <textarea

              value={formData.billedToAddress}

              onChange={(e) => handleFieldChange('billedToAddress', e.target.value)}

              rows={3}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

        </div>

      </div>



      {/* Customer */}

      <div className="bg-white rounded-lg shadow p-6">

        <h2 className="text-lg font-semibold text-gray-900 mb-6">Customer</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div className="relative">

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Customer

            </label>

            <div className="relative">

              <input

                type="text"

                value={clientSearchTerm || (formData.selectedCustomer ? formData.selectedCustomer.name : '')}

                onChange={(e) => handleManualNameChange(e.target.value)}

                onFocus={() => setShowClientDropdown(true)}

                placeholder="Select customer or type to search"

                className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

              />

              {loadingClients ? (

                <Loader2 className="absolute right-3 top-2.5 h-5 w-5 animate-spin text-gray-400" />

              ) : (

                <Search className="absolute right-3 top-2.5 h-5 w-5 text-gray-400" />

              )}



              {showClientDropdown && (

                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">

                  {filteredClients.length > 0 ? (

                    filteredClients.map((client) => (

                      <div

                        key={client.id}

                        onClick={() => {

                          console.log('Customer dropdown clicked - client:', client);

                          handleClientSelect(client);

                        }}

                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0"

                      >

                        <div className="font-medium text-gray-900">{client.name}</div>

                        <div className="text-sm text-gray-500">

                          {client.email && `${client.email}`}

                          {client.email && client.contactPhone && ' • '}

                          {client.contactPhone}

                        </div>

                      </div>

                    ))

                  ) : (

                    <div className="px-3 py-2 text-gray-500 text-sm">

                      {clientSearchTerm ? 'No clients found' : 'No clients available'}

                    </div>

                  )}

                </div>

              )}

            </div>



            {showClientDropdown && (

              <div

                className="fixed inset-0 z-0"

                onClick={() => setShowClientDropdown(false)}

              />

            )}

          </div>



          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Selected Customer

            </label>

            <input

              type="text"

              value={formData.selectedCustomer?.name || ''}

              readOnly

              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"

            />

          </div>

        </div>

      </div>



      {/* Items */}

      <div className="bg-white rounded-lg shadow p-6">

        <div className="flex items-center justify-between mb-6">

          <h2 className="text-lg font-semibold text-gray-900">Items</h2>

          <div className="flex items-center gap-4">

            {loadingClientProducts && (

              <div className="flex items-center gap-2 text-sm text-indigo-600">

                <Loader2 className="h-4 w-4 animate-spin" />

                Loading products...

              </div>

            )}

            <div className="flex items-center gap-2">

              <label className="flex items-center gap-2">

                <input

                  type="radio"

                  checked={formData.includeGst}

                  onChange={() => handleFieldChange('includeGst', true)}

                  className="text-indigo-600"

                />

                <span className="text-sm">GST</span>

              </label>

              <label className="flex items-center gap-2">

                <input

                  type="radio"

                  checked={!formData.includeGst}

                  onChange={() => handleFieldChange('includeGst', false)}

                  className="text-indigo-600"

                />

                <span className="text-sm">Without GST</span>

              </label>

            </div>

          </div>

        </div>

        

        <InvoiceItemTable

          items={formData.items}

          includeGst={formData.includeGst}

          onAddItem={handleAddItem}

          onUpdateItem={handleUpdateItem}

          onDeleteItem={handleDeleteItem}

        />

      </div>



      {/* Bank Details */}

      <div className="bg-white rounded-lg shadow p-6">

        <h2 className="text-lg font-semibold text-gray-900 mb-6">Bank Details</h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Account Name

            </label>

            <input

              type="text"

              value={formData.accountName}

              onChange={(e) => handleFieldChange('accountName', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Account Number

            </label>

            <input

              type="text"

              value={formData.accountNumber}

              onChange={(e) => handleFieldChange('accountNumber', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              IFSC

            </label>

            <input

              type="text"

              value={formData.ifsc}

              onChange={(e) => handleFieldChange('ifsc', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Account Type

            </label>

            <input

              type="text"

              value={formData.accountType}

              onChange={(e) => handleFieldChange('accountType', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              Bank

            </label>

            <input

              type="text"

              value={formData.bank}

              onChange={(e) => handleFieldChange('bank', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

          

          <div>

            <label className="block text-sm font-medium text-gray-700 mb-1">

              UPI ID

            </label>

            <input

              type="text"

              value={formData.upiId}

              onChange={(e) => handleFieldChange('upiId', e.target.value)}

              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

            />

          </div>

        </div>

        

        {formData.upiId && (

          <div className="mt-6">

            <h3 className="text-md font-medium text-gray-900 mb-4">UPI QR Code</h3>

            <UpiQrCode 

              upiUri={upiUri} 

              amount={grandTotal}

              upiId={formData.upiId}

            />

          </div>

        )}

      </div>



      {/* Signature */}

      <div className="bg-white rounded-lg shadow p-6">

        <h2 className="text-lg font-semibold text-gray-900 mb-6">Signature</h2>

        <LogoSignatureUpload

          type="signature"

          value={formData.signature}

          onChange={(value) => handleFieldChange('signature', value)}

        />

      </div>



      {/* Terms & Conditions */}

      <div className="bg-white rounded-lg shadow p-6">

        <h2 className="text-lg font-semibold text-gray-900 mb-6">Terms & Conditions</h2>

        <div>

          <label className="block text-sm font-medium text-gray-700 mb-1">

            Terms (one per line)

          </label>

          <textarea

            value={formData.terms}

            onChange={(e) => handleFieldChange('terms', e.target.value)}

            rows={4}

            placeholder="e.g. Please pay within 15 days..."

            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"

          />

        </div>

      </div>



      {/* Summary */}

      {formData.items.length > 0 && (

        <div className="bg-white rounded-lg shadow p-6">

          <h2 className="text-lg font-semibold text-gray-900 mb-6">Summary</h2>

          <div className="space-y-2">

            <div className="flex justify-between">

              <span className="text-gray-600">Subtotal:</span>

              <span className="font-medium">{formatCurrency(subtotal)}</span>

            </div>

            {formData.includeGst && (

              <>

                <div className="flex justify-between">

                  <span className="text-gray-600">CGST (9%):</span>

                  <span className="font-medium">{formatCurrency(cgst)}</span>

                </div>

                <div className="flex justify-between">

                  <span className="text-gray-600">SGST (9%):</span>

                  <span className="font-medium">{formatCurrency(sgst)}</span>

                </div>

              </>

            )}

            <div className="flex justify-between text-lg font-bold">

              <span>Grand Total:</span>

              <span>{formatCurrency(grandTotal)}</span>

            </div>

          </div>

        </div>

      )}



      {/* Actions */}

      <div className="flex justify-end gap-4">

        <button

          type="button"

          onClick={onCancel}

          className="flex items-center gap-2 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"

        >

          <X className="h-4 w-4" />

          Cancel

        </button>

        <button

          type="submit"

          disabled={loading}

          className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"

        >

          <Save className="h-4 w-4" />

          {loading ? 'Saving...' : (initialData ? 'Update Invoice' : 'Create Invoice')}

        </button>

      </div>

    </form>

  );

}


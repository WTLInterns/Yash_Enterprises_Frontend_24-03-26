"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { taskApi, taskEmployeesApi, taskCustomFieldsApi } from "@/services/taskApi";
import { ArrowLeft, Save, X } from "lucide-react";

const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  };

  // Add auth token if available
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(url, config);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return { data };
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
};

export default function CreateTask() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    taskName: "",
    taskDescription: "",
    customTaskType: "Default Task",
    assignedToEmployeeId: "",
    scheduledStartTime: "",
    scheduledEndTime: "",
    repeatTask: false,
    taskAgainst: "",
    clientId: "",
    customerAddressId: "",
    routeId: "",
    address: "",
    internalTaskId: "",
    customFields: {},
  });

  const [clients, setClients] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [customFields, setCustomFields] = useState([]);
  const [customerAddresses, setCustomerAddresses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (!formData.clientId) {
      setCustomerAddresses([]);
      setFormData(prev => ({ ...prev, customerAddressId: "" }));
      return;
    }

    fetchCustomerAddresses(formData.clientId);
  }, [formData.clientId]);

  const loadInitialData = async () => {
    try {
      // Load employees from real API
      const employeesRes = await apiRequest('/api/employees', { method: 'GET' });
      setEmployees(employeesRes.data || []);

      // Load clients from real API
      const clientsRes = await apiRequest('/api/clients', { method: 'GET' });
      setClients(clientsRes.data || []);

      // Load custom fields from real API
      const fieldsRes = await apiRequest('/api/task-custom-fields?customTaskType=Default Task', { method: 'GET' });
      setCustomFields(fieldsRes.data || []);
      
      // Initialize custom fields
      const initialCustomFields = {};
      fieldsRes.data?.forEach(field => {
        initialCustomFields[field.id] = "";
      });
      setFormData(prev => ({ ...prev, customFields: initialCustomFields }));
      
    } catch (error) {
      console.error("Failed to load data:", error);
      
      // Show error message to user
      alert("Failed to load data. Please check if the backend server is running on http://localhost:8080");
      
      // Set empty arrays to prevent infinite loading
      setEmployees([]);
      setClients([]);
      setCustomFields([]);
    }
  };

  const fetchCustomerAddresses = async (clientId) => {
    try {
      const res = await apiRequest(`/api/customer-addresses?clientId=${encodeURIComponent(clientId)}&withCoordinates=true`, { method: 'GET' });
      setCustomerAddresses(res.data || []);
    } catch (error) {
      console.error("Failed to load customer addresses:", error);
      setCustomerAddresses([]);
    }
  };

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  };

  const handleCustomFieldChange = (fieldId, value) => {
    setFormData(prev => ({
      ...prev,
      customFields: {
        ...prev.customFields,
        [fieldId]: value
      }
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (!formData.customerAddressId) {
        alert("Customer location is required. Please select a customer address with coordinates.");
        return;
      }

      // Prepare payload with custom fields
      const payload = {
        ...formData,
        customerAddressId: Number(formData.customerAddressId),
        customFieldValues: customFields.map(field => ({
          taskCustomFieldId: field.id,
          value: formData.customFields[field.id] || ""
        }))
      };

      await taskApi.create(payload);
      router.push("/tasks/tasks-management");
    } catch (error) {
      console.error("Failed to create task:", error);
      alert("Failed to create task. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    router.push("/tasks/tasks-management");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 text-slate-600 hover:text-slate-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
              Back to Tasks
            </button>
            <div>
              <h1 className="text-3xl font-bold text-slate-900">Create New Task</h1>
              <p className="text-slate-600">Create a new task with dynamic custom fields</p>
            </div>
          </div>
        </div>

        {/* Form */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200">
          <form onSubmit={handleSubmit} className="p-6 space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Task Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="taskName"
                  value={formData.taskName}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter task name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Assign To <span className="text-red-500">*</span>
                </label>
                <select
                  name="assignedToEmployeeId"
                  value={formData.assignedToEmployeeId}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Select employee</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.firstName} {emp.lastName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Task Description */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Task Description
              </label>
              <textarea
                name="taskDescription"
                value={formData.taskDescription}
                onChange={handleInputChange}
                rows={4}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter task description"
              />
            </div>

            {/* Task Type and Related Fields */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Custom Task Type
                </label>
                <select
                  name="customTaskType"
                  value={formData.customTaskType}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="Default Task">Default Task</option>
                  <option value="Collect Payment">Collect Payment</option>
                  <option value="Site Visit">Site Visit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Task Against
                </label>
                <input
                  type="text"
                  name="taskAgainst"
                  value={formData.taskAgainst}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter task against"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Internal Task ID
                </label>
                <input
                  type="text"
                  name="internalTaskId"
                  value={formData.internalTaskId}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter internal task ID"
                />
              </div>
            </div>

            {/* Scheduled Times */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Scheduled Start Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="scheduledStartTime"
                  value={formData.scheduledStartTime}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Scheduled End Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  name="scheduledEndTime"
                  value={formData.scheduledEndTime}
                  onChange={handleInputChange}
                  required
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                />
              </div>
            </div>

            {/* Client and Route */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Client ID
                </label>
                <select
                  name="clientId"
                  value={formData.clientId}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                >
                  <option value="">Select client</option>
                  {clients.map(client => (
                    <option key={client.id} value={client.id}>
                      {client.name || `Client ID: ${client.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Customer Location <span className="text-red-500">*</span>
                </label>
                <select
                  name="customerAddressId"
                  value={formData.customerAddressId}
                  onChange={handleInputChange}
                  required
                  disabled={!formData.clientId}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500 disabled:bg-slate-100"
                >
                  <option value="">{formData.clientId ? "Select customer location" : "Select a client first"}</option>
                  {customerAddresses.map(addr => (
                    <option key={addr.id} value={addr.id}>
                      {addr.addressText || addr.fullAddress || `Address ID: ${addr.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Route ID
                </label>
                <input
                  type="text"
                  name="routeId"
                  value={formData.routeId}
                  onChange={handleInputChange}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                  placeholder="Enter route ID"
                />
              </div>
            </div>

            {/* Address */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Address
              </label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleInputChange}
                rows={3}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                placeholder="Enter task address"
              />
            </div>

            {/* Repeat Task */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  name="repeatTask"
                  checked={formData.repeatTask}
                  onChange={handleInputChange}
                  className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                />
                Repeat Task
              </label>
            </div>

            {/* Dynamic Custom Fields */}
            {customFields.length > 0 && (
              <div className="border-t border-slate-200 pt-6">
                <h3 className="text-lg font-semibold text-slate-900 mb-4">Custom Fields</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {customFields.map(field => (
                    <div key={field.id}>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        {field.fieldLabel}
                        {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.fieldType === 'TEXT' && (
                        <input
                          type="text"
                          value={formData.customFields[field.id] || ""}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          required={field.required}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder={field.fieldLabel}
                        />
                      )}
                      {field.fieldType === 'NUMBER' && (
                        <input
                          type="number"
                          value={formData.customFields[field.id] || ""}
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.value)}
                          required={field.required}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                          placeholder={field.fieldLabel}
                        />
                      )}
                      {field.fieldType === 'PHOTO' && (
                        <input
                          type="file"
                          accept="image/*"
                          onChange={(e) => handleCustomFieldChange(field.id, e.target.files[0])}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 focus:border-indigo-500 focus:ring-indigo-500"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Form Actions */}
            <div className="flex justify-end gap-3 pt-6 border-t border-slate-200">
              <button
                type="button"
                onClick={handleCancel}
                className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Save className="h-4 w-4" />
                {loading ? "Creating..." : "Create Task"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

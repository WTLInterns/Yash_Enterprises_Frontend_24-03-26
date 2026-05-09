"use client";

import { useState, useEffect } from "react";
import { X, Plus, Trash2, Settings } from "lucide-react";
import { toast } from "react-toastify";

export default function DynamicFieldsModal({ isOpen, onClose, entity, onFieldsUpdated }) {
  const [fields, setFields] = useState([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newField, setNewField] = useState({
    fieldKey: "",
    fieldName: "",
    fieldType: "TEXT",
    required: false,
    optionsJson: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && entity) {
      fetchFields();
    }
  }, [isOpen, entity]);

  const fetchFields = async () => {
    try {
      const response = await fetch(`http://localhost:8080/api/fields?entity=${entity}`);
      if (response.ok) {
        const data = await response.json();
        setFields(data);
      }
    } catch (error) {
      console.error("Failed to fetch fields:", error);
      toast.error("Failed to load custom fields");
    }
  };

  const handleCreateField = async () => {
    if (!newField.fieldKey || !newField.fieldName) {
      toast.error("Field Key and Field Name are required");
      return;
    }

    setLoading(true);
    try {
      const payload = { ...newField };
      if (newField.fieldType === "SELECT" && !newField.optionsJson) {
        payload.optionsJson = '["Option 1", "Option 2"]';
      }

      const response = await fetch(`http://localhost:8080/api/fields?entity=${entity}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        toast.success("Custom field created successfully");
        setNewField({
          fieldKey: "",
          fieldName: "",
          fieldType: "TEXT",
          required: false,
          optionsJson: ""
        });
        setShowAddForm(false);
        fetchFields();
        onFieldsUpdated?.();
      } else {
        const error = await response.json().catch(() => ({}));
        toast.error(error.message || "Failed to create field");
      }
    } catch (error) {
      console.error("Failed to create field:", error);
      toast.error("Failed to create custom field");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (!confirm("Are you sure you want to delete this field?")) return;

    try {
      const response = await fetch(`http://localhost:8080/api/fields/${fieldId}`, {
        method: "DELETE"
      });

      if (response.ok) {
        toast.success("Custom field deleted successfully");
        fetchFields();
        onFieldsUpdated?.();
      } else {
        toast.error("Failed to delete field");
      }
    } catch (error) {
      console.error("Failed to delete field:", error);
      toast.error("Failed to delete custom field");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">Custom Fields Configuration</h2>
            <p className="text-sm text-slate-500 mt-1">Manage dynamic fields for {entity}</p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {/* Add Field Button */}
          <div className="mb-6">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
              >
                <Plus className="h-4 w-4" />
                Add New Field
              </button>
            ) : (
              <div className="bg-slate-50 rounded-lg p-4 border">
                <h3 className="text-sm font-medium text-slate-900 mb-4">Create New Field</h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Field Key</label>
                    <input
                      type="text"
                      value={newField.fieldKey}
                      onChange={(e) => setNewField({ ...newField, fieldKey: e.target.value.toLowerCase().replace(/\s+/g, "_") })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="e.g., account_number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Field Name</label>
                    <input
                      type="text"
                      value={newField.fieldName}
                      onChange={(e) => setNewField({ ...newField, fieldName: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      placeholder="e.g., Account Number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Field Type</label>
                    <select
                      value={newField.fieldType}
                      onChange={(e) => setNewField({ ...newField, fieldType: e.target.value })}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                      <option value="TEXT">Text</option>
                      <option value="NUMBER">Number</option>
                      <option value="DATE">Date</option>
                      <option value="SELECT">Select</option>
                      <option value="BOOLEAN">Boolean</option>
                      <option value="TEXTAREA">Textarea</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Options (for Select type)</label>
                    <input
                      type="text"
                      value={newField.optionsJson}
                      onChange={(e) => setNewField({ ...newField, optionsJson: e.target.value })}
                      disabled={newField.fieldType !== "SELECT"}
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-100"
                      placeholder='["Option 1", "Option 2"]'
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="required"
                    checked={newField.required}
                    onChange={(e) => setNewField({ ...newField, required: e.target.checked })}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <label htmlFor="required" className="text-sm text-slate-700">Required Field</label>
                </div>
                <div className="flex items-center gap-2 mt-4">
                  <button
                    onClick={handleCreateField}
                    disabled={loading}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {loading ? "Creating..." : "Create Field"}
                  </button>
                  <button
                    onClick={() => {
                      setShowAddForm(false);
                      setNewField({
                        fieldKey: "",
                        fieldName: "",
                        fieldType: "TEXT",
                        required: false,
                        optionsJson: ""
                      });
                    }}
                    className="rounded-lg bg-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Fields List */}
          <div className="space-y-3">
            {fields.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <Settings className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No custom fields configured yet</p>
                <p className="text-sm">Click "Add New Field" to get started</p>
              </div>
            ) : (
              fields.map((field) => (
                <div key={field.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="font-medium text-slate-900">{field.fieldName}</h4>
                      <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800">
                        {field.fieldType}
                      </span>
                      {field.required && (
                        <span className="inline-flex items-center px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                          Required
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-500 mt-1">Key: {field.fieldKey}</p>
                    {field.optionsJson && (
                      <p className="text-sm text-slate-500 mt-1">Options: {field.optionsJson}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleDeleteField(field.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

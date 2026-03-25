"use client";

import { useState, useEffect } from "react";
import { Settings } from "lucide-react";
import DynamicFieldsModal from "./DynamicFieldsModal";

export default function DynamicFieldsSection({ entity, entityId, values, onChange, showConfigure = true, definitions }) {
  const [fields, setFields] = useState(definitions || []);
  const [showModal, setShowModal] = useState(false);
  const [fieldValues, setFieldValues] = useState(values || {});

  useEffect(() => {
    setFields(definitions || []);
  }, [definitions]);

  useEffect(() => {
    if (!definitions && entity) {
      fetchFields();
    }
  }, [entity, definitions]);

  useEffect(() => {
    setFieldValues(values || {});
  }, [values]);

  const fetchFields = async () => {
    try {
      // Use the correct endpoint for client field definitions
      const endpoint = entity === 'client' 
        ? 'http://localhost:8080/api/client-fields'
        : `http://localhost:8080/api/fields?entity=${entity}`;
      
      const response = await fetch(endpoint);
      if (response.ok) {
        const data = await response.json();
        setFields(data);
      }
    } catch (error) {
      console.error("Failed to fetch fields:", error);
    }
  };

  const handleFieldValueChange = (fieldKey, value) => {
    const newValues = { ...(fieldValues || {}), [fieldKey]: value };
    setFieldValues(newValues);
    onChange?.(newValues);
  };

  const renderFieldInput = (field) => {
    const value = fieldValues[field.fieldKey] || "";
    
    switch (field.fieldType) {
      case "TEXT":
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldValueChange(field.fieldKey, e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder={`Enter ${field.fieldName}`}
          />
        );
      
      case "NUMBER":
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => handleFieldValueChange(field.fieldKey, e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder={`Enter ${field.fieldName}`}
          />
        );
      
      case "DATE":
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => handleFieldValueChange(field.fieldKey, e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        );
      
      case "SELECT":
        let options = [];
        try {
          options = field.optionsJson ? JSON.parse(field.optionsJson) : [];
        } catch (e) {
          console.error("Invalid options JSON:", field.optionsJson);
        }
        
        return (
          <select
            value={value}
            onChange={(e) => handleFieldValueChange(field.fieldKey, e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="">Select {field.fieldName}</option>
            {options.map((option, index) => (
              <option key={index} value={option}>
                {option}
              </option>
            ))}
          </select>
        );
      
      case "BOOLEAN":
        return (
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id={field.fieldKey}
              checked={value === "true"}
              onChange={(e) => handleFieldValueChange(field.fieldKey, e.target.checked ? "true" : "false")}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor={field.fieldKey} className="text-sm text-slate-700">
              {field.fieldName}
            </label>
          </div>
        );
      
      case "TEXTAREA":
        return (
          <textarea
            value={value}
            onChange={(e) => handleFieldValueChange(field.fieldKey, e.target.value)}
            rows={3}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder={`Enter ${field.fieldName}`}
          />
        );
      
      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => handleFieldValueChange(field.fieldKey, e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
            placeholder={`Enter ${field.fieldName}`}
          />
        );
    }
  };

  if (fields.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          {/* <h3 className="text-lg font-medium text-slate-900">Custom Fields</h3> */}
          {showConfigure && (
            <button
              onClick={() => setShowModal(true)}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Settings className="h-4 w-4" />
              Custom Fields
            </button>
          )}
        </div>
        {/* <div className="text-center py-6 bg-slate-50 rounded-lg border-2 border-dashed border-slate-200">
          <p className="text-slate-500">No custom fields configured</p>
          {showConfigure && (
            <button
              onClick={() => setShowModal(true)}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Configure custom fields
            </button>
          )}
        </div> */}
        
        <DynamicFieldsModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          entity={entity}
          onFieldsUpdated={fetchFields}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-slate-900">Custom Fields</h3>
        {showConfigure && (
          <button
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            <Settings className="h-4 w-4" />
            Configure
          </button>
        )}
      </div>
      
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.id}>
            <label className="block text-sm font-medium text-slate-700 mb-1">
              {field.fieldName}
              {field.required && <span className="text-red-500 ml-1">*</span>}
            </label>
            {renderFieldInput(field)}
          </div>
        ))}
      </div>
      
      <DynamicFieldsModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        entity={entity}
        onFieldsUpdated={fetchFields}
      />
    </div>
  );
}

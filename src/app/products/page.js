"use client";

import { useState, useEffect } from "react";
import { Search, Edit2, Trash2, Eye, Settings, X } from "lucide-react";
import { backendApi } from "@/services/api";
import DashboardLayout from "@/components/layout/DashboardLayout";
import DynamicFieldsSection from "@/components/DynamicFieldsSection";
import CreatableCategorySelect from "@/components/CreatableCategorySelect";
import { getCurrentUserName, getCurrentUserRole, getCurrentUserId } from "@/utils/userUtils";
import {
  fetchFieldDefinitions,
  fetchFieldValues,
  normalizeDefinitions,
  normalizeValues,
  upsertFieldValue,
} from "@/services/crmFields";
import { toast } from "react-toastify";

export default function ProductsPage() {
  // ✅ FIXED: Get dynamic user data
  const userName = getCurrentUserName();
  const userRole = getCurrentUserRole();
  const userId = getCurrentUserId();
  
  const [userData, setUserData] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    // ✅ FIXED: Use dynamic user data
    setUserData({ id: userId, name: userName, role: userRole });
  }, [userId, userName, userRole]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState(null);

  const [form, setForm] = useState({
    name: "",
    code: "",
    description: "",
    categoryId: "",
    price: "",
    active: true,
    customFields: {},
  });

  const [fieldDefs, setFieldDefs] = useState([]);
  const [dynamicColumns, setDynamicColumns] = useState([]);
  const [productFieldValuesById, setProductFieldValuesById] = useState({});
  const [currentFieldValues, setCurrentFieldValues] = useState({});

  // ✅ Normalize backend response (array or Page response)
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

  const getLoggedInUser = () => {
    if (typeof window === "undefined") return { name: "Admin", role: "Administrator" };
    try {
      const raw = localStorage.getItem("user_data");
      const obj = raw ? JSON.parse(raw) : null;
      const name = obj?.name || obj?.fullName || obj?.username || obj?.email || "Admin";
      const role = obj?.role || obj?.designation || "Administrator";
      return { name, role };
    } catch {
      return { name: "Admin", role: "Administrator" };
    }
  };

  const fetchProductFieldDefinitions = async () => {
    try {
      const defsRes = await fetchFieldDefinitions("product");
      const defs = normalizeDefinitions(defsRes);
      setFieldDefs(defs);
      setDynamicColumns(defs.filter((d) => d.active !== false).map((d) => d.fieldKey));
    } catch (err) {
      console.error("Failed to fetch product field definitions", err);
      setFieldDefs([]);
      setDynamicColumns([]);
    }
  };

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await backendApi.get("/products");
      const productsData = normalizeList(res);
      setProducts(productsData);

      // If currently editing a product and it got removed, close modal
      if (
        selectedProduct &&
        !productsData.some((p) => p.id === selectedProduct.id)
      ) {
        setSelectedProduct(null);
        setShowCreateModal(false);
      }

      // dynamic columns from definitions
      setDynamicColumns((fieldDefs || []).filter((d) => d.active !== false).map((d) => d.fieldKey));

      // values map for list table
      const entries = await Promise.all(
        (productsData || []).map(async (p) => {
          try {
            const vals = await fetchFieldValues("product", p.id);
            return [p.id, normalizeValues(vals)];
          } catch (_e) {
            return [p.id, {}];
          }
        })
      );
      setProductFieldValuesById(Object.fromEntries(entries));
    } catch (err) {
      console.error("Failed to fetch products:", err);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await backendApi.get("/categories");
      const cats = normalizeList(res);
      setCategories(cats);
    } catch (err) {
      console.error("Failed to fetch categories:", err);
    }
  };

  useEffect(() => {
    fetchProductFieldDefinitions();
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const formatLabel = (key) => {
    return key
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase())
      .trim();
  };

  const filtered = products.filter((p) => {
    const name = (p.name || "").toLowerCase();
    const sku = (p.code || p.sku || "").toLowerCase();
    const q = search.toLowerCase();
    return name.includes(q) || sku.includes(q);
  });

  // ✅ Reset modal and open create
  const openCreate = () => {
    setSelectedProduct(null);
    setForm({
      name: "",
      code: "",
      description: "",
      categoryId: "",
      price: "",
      active: true,
    });
    setCurrentFieldValues({});
    setShowCreateModal(true);
  };

  // ✅ Edit: always fetch fresh data
  const openEdit = async (product) => {
    try {
      const [freshProduct, fieldValues] = await Promise.all([
        backendApi.get(`/products/${product.id}`),
        fetch(`http://localhost:8080/api/field-values?entity=product&entityId=${product.id}`).then(r => r.json()).catch(() => [])
      ]);

      // Convert field values to object
      const customFields = {};
      fieldValues.forEach(field => {
        customFields[field.fieldKey] = field.value;
      });

      const valuesMap = {};
      if (Array.isArray(freshProduct.fieldValues)) {
        freshProduct.fieldValues.forEach((fv) => {
          valuesMap[fv.fieldKey] = fv.value;
        });
      }

      setSelectedProduct(freshProduct);
      setForm({
        name: freshProduct.name || "",
        code: freshProduct.code || "",
        description: freshProduct.description || "",
        categoryId: freshProduct.categoryId || "",
        price:
          freshProduct.price !== null && freshProduct.price !== undefined
            ? String(freshProduct.price)
            : "",
        active:
          freshProduct.active !== undefined && freshProduct.active !== null
            ? freshProduct.active
            : true,
        customFields: customFields,
      });

      setCurrentFieldValues(valuesMap);
      setShowCreateModal(true);
    } catch (err) {
      console.error("Failed to open edit:", err);
      const status = getStatusFromError(err);
      if (status === 404) {
        toast.error("Product not found. Reloading list...");
        await fetchProducts();
        return;
      }
      toast.error("Failed to load product details");
    }
  };

  const openDetails = (product) => {
    setSelectedProduct(product);
    setShowDetailsDrawer(true);
  };

  const handleCreateOrUpdate = async () => {
    try {
      if (!form.name?.trim()) {
        toast.error("Product Name is required");
        return;
      }

      const payload = {
        name: form.name?.trim(),
        code: form.code?.trim() || null,
        description: form.description || "",
        categoryId: form.categoryId || null,
        price: Number(form.price) || 0,
        active: true,
        customFields: JSON.stringify(form.customFields || {}),
      };

      let savedId = selectedProduct?.id;
      if (selectedProduct?.id) {
        await backendApi.put(`/products/${selectedProduct.id}`, payload);
        toast.success("Product updated successfully");
      } else {
        const created = await backendApi.post("/products", payload);
        savedId = created?.id;
        toast.success("Product created successfully");
      }

      // Save custom field values
      if (form.customFields && Object.keys(form.customFields).length > 0) {
        await fetch(`http://localhost:8080/api/field-values/batch?entity=product&entityId=${savedId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form.customFields)
        });
      }

      if (savedId) {
        const activeDefs = (fieldDefs || []).filter((d) => d.active !== false);
        await Promise.all(
          activeDefs.map((d) =>
            upsertFieldValue("product", savedId, d.fieldKey, currentFieldValues?.[d.fieldKey] ?? "")
          )
        );
      }

      await fetchProducts();
      setShowCreateModal(false);
      setSelectedProduct(null);
      setCurrentFieldValues({});
      setForm({
        name: "",
        code: "",
        description: "",
        categoryId: "",
        price: "",
        active: true,
        customFields: {},
      });
    } catch (err) {
      console.error("Save failed:", err);
      const status = getStatusFromError(err);

      if (status === 404) {
        toast.error("Product not found. Reloading list...");
        await fetchProducts();
        setShowCreateModal(false);
        setSelectedProduct(null);
        return;
      }

      const errorMsg = err?.data?.message || err?.message || "Unknown error";
      toast.error(`Failed to save product: ${errorMsg}`);
      await fetchProducts();
    }
  };

  const handleDelete = async (id) => {
    if (!confirm("Delete this product?")) return;

    try {
      await backendApi.delete(`/products/${id}`);

      // optimistic remove
      setProducts((prev) => prev.filter((p) => p.id !== id));

      // if editing same product, close
      if (selectedProduct?.id === id) {
        setSelectedProduct(null);
        setShowCreateModal(false);
      }

      toast.success("Product deleted successfully");
      await fetchProducts();
    } catch (err) {
      console.error("Delete failed:", err);
      const status = getStatusFromError(err);

      if (status === 404) {
        toast.info("Product already deleted. Refreshing list...");
        setProducts((prev) => prev.filter((p) => p.id !== id));

        if (selectedProduct?.id === id) {
          setSelectedProduct(null);
          setShowCreateModal(false);
        }

        await fetchProducts();
        return;
      }

      toast.error("Failed to delete product");
      await fetchProducts();
    }
  };

  return (
    <DashboardLayout
      header={{
        project: "Products",
        user: getLoggedInUser(),
        notifications: [],
      }}
    >
      <div className="flex flex-col space-y-4">
        {/* HEADER */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-lg font-semibold text-slate-900">Products</div>
            <p className="text-sm text-slate-500">Manage your product catalog</p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={openCreate}
              className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 transition-colors"
            >
              <span className="text-lg leading-none">+</span>
              <span>Add Product</span>
            </button>
          </div>
        </div>

        {/* SEARCH */}
        <div className="mb-4 flex items-center gap-2 border rounded px-3 py-2 w-96">
          <Search size={18} className="text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 outline-none"
          />
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
                      Product Name
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      SKU
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Category
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Price
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Created
                    </th>

                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Updated
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-slate-500">
                      Owner
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
                  {filtered.map((product) => (
                    <tr key={product.id} className="hover:bg-slate-50">
                      {/* Product Name */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {product.name}
                      </td>

                      {/* SKU */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {product.code || product.sku || "-"}
                      </td>

                      {/* Category */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {product.categoryName ||
                          categories.find((c) => c.id === product.categoryId)?.name ||
                          "-"}
                      </td>

                      {/* Price */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        ₹{product.price ?? 0}
                      </td>

                      {/* Created (matches header) */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {product.createdAt
                          ? new Date(product.createdAt).toLocaleDateString()
                          : "-"}
                      </td>

                      {/* Updated (matches header) */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {product.updatedAt
                          ? new Date(product.updatedAt).toLocaleDateString()
                          : "-"}
                      </td>

                      {/* Owner (logged-in user) */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        {userData?.name || "Admin User"}
                      </td>

                      {/* Dynamic custom fields */}
                      {dynamicColumns.map((col) => (
                        <td
                          key={col}
                          className="px-6 py-4 whitespace-nowrap text-sm text-slate-700"
                        >
                          {productFieldValuesById?.[product.id]?.[col] || "-"}
                        </td>
                      ))}

                      {/* Actions column */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => openDetails(product)}
                            className="text-green-600 hover:text-green-800"
                            title="View"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => openEdit(product)}
                            className="text-blue-600 hover:text-blue-800"
                            title="Edit"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={() => handleDelete(product.id)}
                            className="text-red-600 hover:text-red-800"
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}

                  {!filtered.length && (
                    <tr>
                      <td
                        colSpan={8 + dynamicColumns.length}
                        className="px-6 py-8 text-center text-sm text-slate-500"
                      >
                        No products found
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ✅ CREATE/EDIT MODAL */}
        {showCreateModal && (
          <>
            <div
              className="fixed inset-0 z-[60] bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
              onClick={() => setShowCreateModal(false)}
            />

            <div className="fixed inset-0 z-[70] flex items-center justify-center px-4 py-6">
              <div
                className="relative w-full max-w-2xl h-[80vh] transform overflow-hidden rounded-2xl border border-slate-200/80 bg-white/95 shadow-2xl shadow-slate-900/50 animate-slideInRight flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                {/* HEADER */}
                <div className="flex items-start justify-between border-b border-slate-200/80 px-6 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {selectedProduct ? "Edit Product" : "Create Product"}
                    </h2>
                    <p className="mt-1 text-sm text-slate-500">
                      {selectedProduct
                        ? "Update product information"
                        : "Add a new product to your catalog"}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* BODY */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Product Name <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) =>
                            setForm({ ...form, name: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                          placeholder="Enter product name"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          SKU / Code
                        </label>
                        <input
                          type="text"
                          value={form.code}
                          onChange={(e) =>
                            setForm({ ...form, code: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                          placeholder="Enter SKU or product code"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-2">
                        Description
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) =>
                          setForm({ ...form, description: e.target.value })
                        }
                        rows={3}
                        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors resize-none"
                        placeholder="Enter product description"
                      />
                    </div>

                    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Category
                        </label>
                        <CreatableCategorySelect
                          value={form.categoryId}
                          onChange={(value) =>
                            setForm({ ...form, categoryId: value })
                          }
                          isAdmin={userData?.role === "Administrator"}
                          className="w-full"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-2">
                          Price (₹) <span className="text-rose-500">*</span>
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={form.price}
                          onChange={(e) =>
                            setForm({ ...form, price: e.target.value })
                          }
                          className="w-full rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
                          placeholder="0.00"
                        />
                      </div>
                    </div>

                    {/* Audit Information */}
                    <div className="border-t border-slate-200/80 pt-6">
                      <h4 className="text-base font-semibold text-slate-900 mb-4">Audit Information</h4>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Owner
                          </label>
                          <input
                            type="text"
                            value={userData?.name || "Admin User"}
                            readOnly
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Created Date
                          </label>
                          <input
                            type="text"
                            value={selectedProduct?.createdAt 
                              ? new Date(selectedProduct.createdAt).toLocaleString() 
                              : new Date().toLocaleString()}
                            readOnly
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Created By
                          </label>
                          <input
                            type="text"
                            value={selectedProduct?.createdByName || userData?.name || "Admin User"}
                            readOnly
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-slate-700 mb-2">
                            Last Updated
                          </label>
                          <input
                            type="text"
                            value={selectedProduct?.updatedAt 
                              ? new Date(selectedProduct.updatedAt).toLocaleString() 
                              : "-"}
                            readOnly
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-sm text-slate-900"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Custom Fields */}
                {/* <DynamicFieldsSection
                  entity="product"
                  entityId={selectedProduct?.id}
                  values={form.customFields}
                  onChange={(values) => setForm({ ...form, customFields: values })}
                /> */}

                {/* FOOTER */}
                <div className="border-t border-slate-200/80 px-6 py-4">
                  <div className="flex items-center justify-between">
                    {/* <div className="text-sm text-slate-500">
                      <span className="text-rose-500">*</span> Required fields
                    </div> */}
                     {/* Custom Fields */}
                <DynamicFieldsSection
                  entity="product"
                  entityId={selectedProduct?.id}
                  values={form.customFields}
                  onChange={(values) => setForm({ ...form, customFields: values })}
                />

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => setShowCreateModal(false)}
                        className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        onClick={handleCreateOrUpdate}
                        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 transition-colors"
                      >
                        {selectedProduct ? "Update Product" : "Create Product"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* DETAILS DRAWER */}
        {showDetailsDrawer && selectedProduct && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white w-full max-w-lg max-h-[80vh] overflow-y-auto p-6 rounded-2xl shadow-xl border border-slate-200">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-slate-900">Product Details</h2>
                <button
                  type="button"
                  onClick={() => setShowDetailsDrawer(false)}
                  className="rounded-full p-1 text-gray-500 hover:text-gray-700 hover:bg-slate-100"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 text-sm text-slate-800">
                <div>
                  <strong>Product Name:</strong> {selectedProduct.name}
                </div>
                <div>
                  <strong>SKU:</strong> {selectedProduct.code || "-"}
                </div>
                <div>
                  <strong>Description:</strong> {selectedProduct.description || "-"}
                </div>
                <div>
                  <strong>Category:</strong>{" "}
                  {selectedProduct.categoryName ||
                    categories.find((c) => c.id === selectedProduct.categoryId)?.name ||
                    "-"}
                </div>
                <div>
                  <strong>Price:</strong> ₹{selectedProduct.price ?? 0}
                </div>
                <div>
                  <strong>Status:</strong>{" "}
                  <span
                    className={`px-2 py-1 rounded text-xs ${
                      selectedProduct.active
                        ? "bg-green-100 text-green-800"
                        : "bg-red-100 text-red-800"
                    }`}
                  >
                    {selectedProduct.active ? "Active" : "Inactive"}
                  </span>
                </div>
                <div>
                  <strong>Owner:</strong> {selectedProduct.ownerName || userData?.name || "-"}
                </div>

                {/* Audit Fields */}
                <div className="pt-3 border-t border-gray-200 mt-2">
                  <h4 className="font-medium text-gray-900 mb-2">Audit Information</h4>
                  <div className="space-y-1 text-sm text-gray-600">
                    <div>
                      <strong>Created Date:</strong>{" "}
                      {selectedProduct.createdAt
                        ? new Date(selectedProduct.createdAt).toLocaleString()
                        : "-"}
                    </div>
                    <div>
                      <strong>Created By:</strong> {selectedProduct.createdByName || "-"}
                    </div>
                    <div>
                      <strong>Last Updated:</strong>{" "}
                      {selectedProduct.updatedAt
                        ? new Date(selectedProduct.updatedAt).toLocaleString()
                        : "-"}
                    </div>
                    <div>
                      <strong>Last Updated By:</strong> {selectedProduct.updatedByName || "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
}

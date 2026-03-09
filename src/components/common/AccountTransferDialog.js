"use client";

import { useState } from "react";
import { AlertTriangle, Users, ArrowRight } from "lucide-react";

/**
 * 🎯 Professional Confirmation Dialog for Account Department Transfer
 * 
 * Shows when TL selects "ACCOUNT" stage to confirm the deal transfer
 */
export default function AccountTransferDialog({ 
  isOpen, 
  onConfirm, 
  onCancel, 
  dealName,
  customerName,
  customerEmail,
  customerPhone,
  customerAddress,
  customerProducts,
  dealValue
}) {
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleConfirm = async () => {
    setIsSubmitting(true);
    try {
      await onConfirm();
    } finally {
      setIsSubmitting(false);
    }
  };

  // Format address for display
  const formatAddress = (address) => {
    if (!address) return "Not available";
    
    // Handle address object from addresses array
    if (typeof address === 'object') {
      const parts = [
        address.addressLine || address.address,
        address.city,
        address.state,
        address.pincode,
        address.country
      ].filter(Boolean);
      return parts.join(", ") || "Not available";
    }
    return address;
  };

  // Format currency
  const formatCurrency = (amount) => {
    if (!amount) return "Not specified";
    return new Intl.NumberFormat('en-IN', { 
      style: 'currency', 
      currency: 'INR',
      maximumFractionDigits: 0 
    }).format(amount);
  };

  return (
    <div className="fixed inset-0 bg-white/30 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full mx-4 transform transition-all border border-gray-100">
        {/* Header */}
        <div className="p-5 border-b border-gray-100">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
            </div>
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Transfer to Accounts
              </h3>
              <p className="text-xs text-gray-500">
                Department handover confirmation
              </p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          <div className="space-y-4">
            {/* Professional Message */}
            <div className="bg-blue-50 rounded-xl p-3 border border-blue-100">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0 w-4 h-4 rounded-full bg-blue-200 flex items-center justify-center mt-0.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-medium text-blue-900 mb-1">
                    Department Transfer
                  </p>
                  <p className="text-xs text-blue-700 leading-relaxed">
                    This deal will be transferred to the Accounts Department for final closure and payment processing.
                  </p>
                </div>
              </div>
            </div>

            {/* Customer Information */}
            <div className="bg-white rounded-xl p-4 border border-gray-200">
              <div className="flex items-center space-x-2 mb-3">
                <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                </div>
                <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Customer Details</p>
              </div>
              
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Name</p>
                    <p className="text-xs font-semibold text-gray-900 truncate">{customerName || "Not specified"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Deal</p>
                    <p className="text-xs font-semibold text-gray-900 truncate">{dealName || "Untitled Deal"}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Email</p>
                    <p className="text-xs font-medium text-gray-900 truncate">{customerEmail || "Not available"}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Phone</p>
                    <p className="text-xs font-medium text-gray-900">{customerPhone || "Not available"}</p>
                  </div>
                </div>

                <div>
                  <p className="text-xs text-gray-500 mb-1">Address</p>
                  <p className="text-xs font-medium text-gray-900 leading-relaxed">
                    {formatAddress(customerAddress)}
                  </p>
                </div>

                {dealValue && (
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Deal Value</p>
                    <p className="text-sm font-bold text-green-700">{formatCurrency(dealValue)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Products Information */}
            {customerProducts && customerProducts.length > 0 && (
              <div className="bg-white rounded-xl p-4 border border-gray-200">
                <div className="flex items-center space-x-2 mb-3">
                  <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center">
                    <div className="w-2 h-2 rounded-full bg-gray-600"></div>
                  </div>
                  <p className="text-xs font-semibold text-gray-900 uppercase tracking-wide">Products</p>
                </div>
                
                <div className="space-y-2">
                  {customerProducts.slice(0, 3).map((product, index) => (
                    <div key={index} className="flex items-center justify-between py-1 border-b border-gray-50 last:border-0">
                      <div className="flex-1">
                        <p className="text-xs font-medium text-gray-900 truncate">
                          {product.productName || product.name || `Product ${index + 1}`}
                        </p>
                        <div className="flex items-center space-x-2">
                          {product.quantity && (
                            <p className="text-xs text-gray-500">Qty: {product.quantity}</p>
                          )}
                          {product.finalAmount && (
                            <p className="text-xs text-green-600 font-medium">
                              Total: {formatCurrency(product.finalAmount)}
                            </p>
                          )}
                        </div>
                      </div>
                      {product.price && (
                        <p className="text-xs font-semibold text-gray-900 ml-2">
                          {formatCurrency(product.price)}
                        </p>
                      )}
                    </div>
                  ))}
                  {customerProducts.length > 3 && (
                    <p className="text-xs text-gray-500 text-center pt-1">
                      +{customerProducts.length - 3} more products
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Professional Notice */}
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-100">
              <div className="flex items-start space-x-2">
                <div className="flex-shrink-0">
                  <div className="w-4 h-4 rounded-full bg-amber-200 flex items-center justify-center mt-0.5">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-600"></div>
                  </div>
                </div>
                <div className="flex-1">
                  <p className="text-xs font-semibold text-amber-900 mb-2 uppercase tracking-wide">
                    Important Notice
                  </p>
                  <div className="space-y-2">
                    <p className="text-xs text-amber-800 leading-relaxed">
                      Upon confirmation, this deal will be transferred to the Accounts Department. The Accounts team will take over complete management for final closure and payment processing.
                    </p>
                    <div className="space-y-1">
                      <div className="flex items-start space-x-2">
                        <div className="w-1 h-1 rounded-full bg-amber-600 mt-1 flex-shrink-0"></div>
                        <p className="text-xs text-amber-800">All previous department access will be revoked</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="w-1 h-1 rounded-full bg-amber-600 mt-1 flex-shrink-0"></div>
                        <p className="text-xs text-amber-800">Accounts team will manage payment collection</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="w-1 h-1 rounded-full bg-amber-600 mt-1 flex-shrink-0"></div>
                        <p className="text-xs text-amber-800">Final closure will be handled by Accounts</p>
                      </div>
                      <div className="flex items-start space-x-2">
                        <div className="w-1 h-1 rounded-full bg-amber-600 mt-1 flex-shrink-0"></div>
                        <p className="text-xs text-amber-800">No further modifications will be permitted</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-2xl">
          <div className="flex space-x-2">
            <button
              onClick={onCancel}
              disabled={isSubmitting}
              className="flex-1 px-3 py-2 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
            >
              Cancel Transfer
            </button>
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className="flex-1 px-3 py-2 text-xs font-medium text-white bg-gray-900 border border-transparent rounded-lg hover:bg-gray-800 focus:outline-none focus:ring-1 focus:ring-offset-1 focus:ring-gray-900 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 flex items-center justify-center space-x-1"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Transferring...</span>
                </>
              ) : (
                <>
                  <Users className="w-3 h-3" />
                  <span>Confirm Transfer</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

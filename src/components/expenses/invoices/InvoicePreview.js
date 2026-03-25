'use client';

import { Download } from 'lucide-react';

export default function InvoicePreview({ data: invoice }) {
  // Safety check
  if (!invoice) {
    return (
      <div className="p-8 text-center text-gray-500">
        <p>No invoice data available</p>
      </div>
    );
  }

  // Debug logging
  console.log('InvoicePreview - invoice data:', invoice);
  console.log('InvoicePreview - items:', invoice.items);

  // Ensure invoice has required properties
  const safeInvoice = {
    ...invoice,
    invoiceDate: invoice.invoiceDate || new Date(),
    dueDate: invoice.dueDate || new Date(),
    items: invoice.items || []
  };

  const billedToDisplayName =
    safeInvoice.selectedBankName ||
    safeInvoice.selectedCustomer?.name ||
    safeInvoice.billedToName;

  const hasBank = !!safeInvoice.selectedBankName;

  console.log('InvoicePreview - hasBank:', hasBank, 'selectedBankName:', safeInvoice.selectedBankName, 'selectedCustomer:', safeInvoice.selectedCustomer?.name);

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (date) => {
    if (!date) return 'N/A';
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) return 'Invalid Date';
      return new Intl.DateTimeFormat('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      }).format(dateObj);
    } catch (error) {
      console.error('Date formatting error:', error);
      return 'Invalid Date';
    }
  };

  const calculateItemTotals = (item) => {
    const amount = item.qty * item.rate;
    const cgst = safeInvoice.includeGst ? amount * 0.09 : 0;
    const sgst = safeInvoice.includeGst ? amount * 0.09 : 0;
    const total = amount + cgst + sgst;
    return { amount, cgst, sgst, total };
  };

  const calculateTotals = () => {
    const subtotal = safeInvoice.items?.reduce((sum, item) => sum + (item.qty * item.rate), 0) || 0;
    const cgst = safeInvoice.includeGst ? subtotal * 0.09 : 0;
    const sgst = safeInvoice.includeGst ? subtotal * 0.09 : 0;
    const grandTotal = subtotal + cgst + sgst;
    
    return { subtotal, cgst, sgst, grandTotal };
  };

  const { subtotal, cgst, sgst, grandTotal } = calculateTotals();

  const generateUpiUri = () => {
    if (!safeInvoice?.upiId || !safeInvoice?.accountName) return '';
    
    const params = new URLSearchParams({
      pa: safeInvoice.upiId.trim(),
      pn: safeInvoice.accountName.trim(),
      am: Number(grandTotal || 0).toFixed(2),
      cu: 'INR',
      tn: 'Invoice Payment'
    });
    return `upi://pay?${params.toString()}`;
  };

  const qrCodeUrl = generateUpiUri() 
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(generateUpiUri())}`
    : null;

  return (
    <div className="bg-white p-8 max-w-4xl mx-auto border border-gray-300">
      {/* Header */}
      <div className="border-b-2 border-black pb-4 mb-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-bold text-black mb-2">
              {safeInvoice.isProForma ? 'PRO FORMA INVOICE' : 'INVOICE'}
            </h1>
            <div className="space-y-1 text-sm">
              <div className="flex">
                <span className="font-medium w-24">Invoice No:</span>
                <span>{safeInvoice.invoiceNo}</span>
              </div>
              <div className="flex">
                <span className="font-medium w-24">Date:</span>
                <span>{formatDate(safeInvoice.invoiceDate)}</span>
              </div>
              <div className="flex">
                <span className="font-medium w-24">Due Date:</span>
                <span>{formatDate(safeInvoice.dueDate)}</span>
              </div>
            </div>
          </div>
          
          {/* Company Logo */}
          <div className="w-32 h-24 border border-gray-300 flex items-center justify-center overflow-hidden bg-gray-50">
            {safeInvoice.companyLogo ? (
              <img 
                src={safeInvoice.companyLogo} 
                alt="Company Logo" 
                className="w-full h-full object-contain"
              />
            ) : (
              <span className="text-gray-400 text-xs">LOGO</span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8 mb-6">
        {/* Billed By */}
        <div>
          <h3 className="font-bold text-black mb-2">BILLED BY</h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{safeInvoice.billedByName}</p>
            <p className="text-gray-600">{safeInvoice.billedByAddress}</p>
            {safeInvoice.gstin && <p className="text-gray-600">GSTIN: {safeInvoice.gstin}</p>}
            {safeInvoice.pan && <p className="text-gray-600">PAN: {safeInvoice.pan}</p>}
            {safeInvoice.billedByEmail && <p className="text-gray-600">Email: {safeInvoice.billedByEmail}</p>}
          </div>
        </div>

        {/* Billed To */}
        <div>
          <h3 className="font-bold text-black mb-2">BILLED TO</h3>
          <div className="space-y-1 text-sm">
            <p className="font-medium">{billedToDisplayName}</p>
            <p className="text-gray-600">{safeInvoice.billedToAddress}</p>
            {safeInvoice.billedToGstin && <p className="text-gray-600">GSTIN: {safeInvoice.billedToGstin}</p>}
            {!hasBank && safeInvoice.billedToMobile && <p className="text-gray-600">Mobile: {safeInvoice.billedToMobile}</p>}
            {!hasBank && safeInvoice.billedToEmail && <p className="text-gray-600">Email: {safeInvoice.billedToEmail}</p>}
          </div>
        </div>
      </div>

      {/* Customer Name Display */}
      {safeInvoice.selectedCustomer?.name && (
        <div className="mb-4">
          <p className="text-sm font-medium">
            <span className="font-semibold">Customer Name :</span>{' '}
            {safeInvoice.selectedCustomer.name}
          </p>
        </div>
      )}

      {/* Items Table */}
      <div className="mb-6">
        <table className="w-full border-collapse border border-black">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-black p-2 text-left text-sm font-bold">#</th>
              <th className="border border-black p-2 text-left text-sm font-bold">ITEM DESCRIPTION</th>
              {safeInvoice.includeGst && <th className="border border-black p-2 text-center text-sm font-bold">GST RATE</th>}
              <th className="border border-black p-2 text-center text-sm font-bold">QTY</th>
              <th className="border border-black p-2 text-right text-sm font-bold">RATE</th>
              <th className="border border-black p-2 text-right text-sm font-bold">AMOUNT</th>
              {safeInvoice.includeGst && (
                <>
                  <th className="border border-black p-2 text-right text-sm font-bold">CGST</th>
                  <th className="border border-black p-2 text-right text-sm font-bold">SGST</th>
                </>
              )}
              <th className="border border-black p-2 text-right text-sm font-bold">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {safeInvoice.items?.length === 0 ? (
              <tr>
                <td colSpan={safeInvoice.includeGst ? 9 : 6} className="border border-black p-8 text-center text-gray-500">
                  No items added
                </td>
              </tr>
            ) : (
              safeInvoice.items.map((item, index) => {
                const { amount, cgst, sgst, total } = calculateItemTotals(item);
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="border border-black p-2 text-sm">{index + 1}</td>
                    <td className="border border-black p-2 text-sm">
                      <div className="font-medium">{item.name}</div>
                      {item.description && (
                        <div className="text-gray-600 text-xs">{item.description}</div>
                      )}
                    </td>
                    {safeInvoice.includeGst && <td className="border border-black p-2 text-center text-sm">18%</td>}
                    <td className="border border-black p-2 text-center text-sm">
                      {item.qty % 1 === 0 ? item.qty : item.qty}
                    </td>
                    <td className="border border-black p-2 text-right text-sm">{formatCurrency(item.rate)}</td>
                    <td className="border border-black p-2 text-right text-sm">{formatCurrency(amount)}</td>
                    {safeInvoice.includeGst && (
                      <>
                        <td className="border border-black p-2 text-right text-sm">{formatCurrency(cgst)}</td>
                        <td className="border border-black p-2 text-right text-sm">{formatCurrency(sgst)}</td>
                      </>
                    )}
                    <td className="border border-black p-2 text-right text-sm font-medium">{formatCurrency(total)}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Total Section */}
      {safeInvoice.items?.length > 0 && (
        <div className="mb-6">
          <div className="flex justify-end">
            <div className="w-64">
              <table className="w-full border-collapse border border-black">
                <tbody>
                  <tr>
                    <td className="border border-black p-2 text-sm font-medium">SUBTOTAL</td>
                    <td className="border border-black p-2 text-right text-sm">{formatCurrency(subtotal)}</td>
                  </tr>
                  {safeInvoice.includeGst && (
                    <>
                      <tr>
                        <td className="border border-black p-2 text-sm">CGST @ 9%</td>
                        <td className="border border-black p-2 text-right text-sm">{formatCurrency(cgst)}</td>
                      </tr>
                      <tr>
                        <td className="border border-black p-2 text-sm">SGST @ 9%</td>
                        <td className="border border-black p-2 text-right text-sm">{formatCurrency(sgst)}</td>
                      </tr>
                    </>
                  )}
                  <tr className="bg-gray-100 font-bold">
                    <td className="border border-black p-2 text-sm">GRAND TOTAL</td>
                    <td className="border border-black p-2 text-right text-sm">{formatCurrency(grandTotal)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bank Details */}
      {(safeInvoice.accountName || safeInvoice.upiId) && (
        <div className="grid grid-cols-2 gap-8 mb-6">
          {safeInvoice.accountName && (
            <div>
              <h3 className="font-bold text-black mb-2">BANK DETAILS</h3>
              <div className="space-y-1 text-sm">
                <p className="font-medium">{safeInvoice.accountName}</p>
                {safeInvoice.accountNumber && <p className="text-gray-600">A/C No: {safeInvoice.accountNumber}</p>}
                {safeInvoice.ifsc && <p className="text-gray-600">IFSC: {safeInvoice.ifsc}</p>}
                {safeInvoice.accountType && <p className="text-gray-600">Type: {safeInvoice.accountType}</p>}
                {safeInvoice.bank && <p className="text-gray-600">Bank: {safeInvoice.bank}</p>}
              </div>
            </div>
          )}

          {safeInvoice.upiId && (
            <div>
              <h3 className="font-bold text-black mb-2">UPI DETAILS</h3>
              <div className="space-y-1 text-sm">
                <p className="text-gray-600">UPI ID: {safeInvoice.upiId}</p>
                <p className="text-gray-600">Maximum ₹1,00,000 via UPI</p>
                {qrCodeUrl && (
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <img
                        src={qrCodeUrl}
                        alt="UPI QR Code"
                        className="w-32 h-32 border-2 border-gray-300 rounded-lg"
                      />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs text-gray-600">Amount: ₹{Number(grandTotal || 0).toFixed(2)}</p>
                      <p className="text-sm text-gray-600">Maximum ₹1,00,000 via UPI</p>
                      <p className="text-xs font-medium text-gray-700">UPI ID: {safeInvoice.upiId}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Terms and Conditions */}
      {safeInvoice.terms && (
        <div className="mb-6">
          <h3 className="font-bold text-black mb-2">TERMS AND CONDITIONS</h3>
          <div className="space-y-1 text-sm text-gray-600">
            {safeInvoice.terms.split('\n').filter(line => line.trim()).map((line, index) => (
              <p key={index}>• {line.trim()}</p>
            ))}
          </div>
        </div>
      )}

      {/* Signature */}
      {safeInvoice.signature && (
        <div className="mb-6">
          <h3 className="font-bold text-black mb-2">AUTHORIZED SIGNATURE</h3>
          <div className="flex justify-center">
            <img 
              src={safeInvoice.signature} 
              alt="Signature" 
              className="w-48 h-24 object-contain border border-gray-300"
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="text-center text-xs text-gray-500 mt-8 pt-4 border-t border-gray-300">
        This is an electronically generated document, no signature is required.
      </div>
    </div>
  );
}

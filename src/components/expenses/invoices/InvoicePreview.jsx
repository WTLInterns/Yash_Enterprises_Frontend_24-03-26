'use client';

import { format } from 'date-fns';

export default function InvoicePreview({ invoice, data }) {
  // Support both prop names for compatibility
  const invoiceData = invoice || data;
  
  if (!invoiceData) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No invoice data available</p>
      </div>
    );
  }

  const formatDate = (dateStr) => {
    try {
      return format(new Date(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr || '';
    }
  };

  const formatAmount = (amount) => {
    return amount ? `₹${Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '₹0.00';
  };

  const amountInWords = (amount) => {
    const num = Math.round(Number(amount) || 0);
    const words = numberToWords(num);
    return words.charAt(0).toUpperCase() + words.slice(1) + ' Only';
  };

  // Simple number to words converter
  const numberToWords = (num) => {
    if (num === 0) return 'zero';
    const ones = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];
    const tens = ['', '', 'twenty', 'thirty', 'forty', 'fifty', 'sixty', 'seventy', 'eighty', 'ninety'];
    const teens = ['ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen'];
    
    const convertLessThanThousand = (n) => {
      if (n === 0) return '';
      if (n < 10) return ones[n];
      if (n < 20) return teens[n - 10];
      if (n < 100) {
        const ten = Math.floor(n / 10);
        const one = n % 10;
        return tens[ten] + (one ? ' ' + ones[one] : '');
      }
      const hundred = Math.floor(n / 100);
      const rest = n % 100;
      return ones[hundred] + ' hundred' + (rest ? ' and ' + convertLessThanThousand(rest) : '');
    };

    if (num < 1000) return convertLessThanThousand(num);
    
    const lakh = Math.floor(num / 100000);
    const remainingAfterLakh = num % 100000;
    
    if (lakh > 0) {
      const lakhWords = convertLessThanThousand(lakh) + ' lakh';
      const restWords = remainingAfterLakh > 0 ? ' ' + convertLessThanThousand(remainingAfterLakh) : '';
      return lakhWords + restWords;
    }
    
    return convertLessThanThousand(num);
  };

  return (
    <div id="invoice-preview-content" style={{ width: '100%', maxWidth: '800px', margin: '0 auto', backgroundColor: 'white', fontFamily: 'Arial, sans-serif' }}>
      {/* Header Section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', padding: '20px' }}>
        {/* Logo Section */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              backgroundColor: '#f59e0b', 
              borderRadius: '50%', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              marginRight: '15px'
            }}>
              <span style={{ color: 'white', fontSize: '24px', fontWeight: 'bold' }}>YE</span>
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#1f2937' }}>Yashraj Enterprises</h1>
              <p style={{ margin: '2px 0', fontSize: '12px', color: '#6b7280' }}>Prop: Yashraj Singh Chouhan</p>
            </div>
          </div>
          <div style={{ fontSize: '11px', color: '#6b7280', lineHeight: '1.4' }}>
            <p>Shop No 05, Bajrang Bali Complex, In Front Of Petrol Pump, Manikpur Naka,</p>
            <p>Ujjain Road, Indore - 452010 (M.P.)</p>
            <p>Mobile: 9522994474, 8827294474 | Email: yashrajenterprises4474@gmail.com</p>
            <p>GSTIN: 23AJRPC4929B1ZV | PAN: AJRPC4929B</p>
          </div>
        </div>

        {/* Invoice Details */}
        <div style={{ textAlign: 'right', flex: 0, minWidth: '200px' }}>
          <div style={{ fontSize: '18px', fontWeight: 'bold', marginBottom: '15px', color: '#1f2937' }}>Tax Invoice</div>
          <div style={{ fontSize: '12px', color: '#374151' }}>
            <p style={{ margin: '4px 0' }}><strong>Invoice No:</strong> {invoiceData.invoiceNo || 'N/A'}</p>
            <p style={{ margin: '4px 0' }}><strong>Date:</strong> {formatDate(invoiceData.invoiceDate)}</p>
            <p style={{ margin: '4px 0' }}><strong>Transport:</strong> {invoiceData.transport || 'Own'}</p>
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ height: '2px', backgroundColor: '#374151', margin: '0 20px 20px 20px' }}></div>

      {/* To Section */}
      <div style={{ padding: '0 20px 20px 20px' }}>
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>To:</p>
          <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
            <p style={{ margin: '2px 0', fontWeight: 'bold' }}>{invoiceData.billedToName || 'N/A'}</p>
            <p style={{ margin: '2px 0' }}>{invoiceData.billedToAddress || ''}</p>
            <p style={{ margin: '2px 0' }}>Mobile: {invoiceData.billedToMobile || 'N/A'}</p>
            <p style={{ margin: '2px 0' }}>GSTIN: {invoiceData.billedToGstin || 'N/A'}</p>
          </div>
        </div>

        {/* Subject/Auction Details */}
        <div style={{ marginBottom: '20px' }}>
          <p style={{ fontSize: '14px', fontWeight: 'bold', marginBottom: '8px', color: '#1f2937' }}>
            Subject: {invoiceData.subject || 'Auction Details'}
          </p>
          <div style={{ fontSize: '12px', color: '#374151', lineHeight: '1.5' }}>
            <p style={{ margin: '2px 0' }}>Auction Name: {invoiceData.auctionName || 'N/A'}</p>
            <p style={{ margin: '2px 0' }}>Auction Date: {formatDate(invoiceData.auctionDate)}</p>
            <p style={{ margin: '2px 0' }}>Auction Place: {invoiceData.auctionPlace || 'N/A'}</p>
          </div>
        </div>

        {/* Main Table */}
        <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
          <thead>
            <tr style={{ backgroundColor: '#fef3c7' }}>
              <th style={{ border: '1px solid #374151', padding: '8px', textAlign: 'center', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fef3c7' }}>Sr.No</th>
              <th style={{ border: '1px solid #374151', padding: '8px', textAlign: 'left', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fef3c7' }}>Particular</th>
              <th style={{ border: '1px solid #374151', padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fef3c7' }}>Amount</th>
              <th style={{ border: '1px solid #374151', padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold', backgroundColor: '#fef3c7' }}>Bill Amt</th>
            </tr>
          </thead>
          <tbody>
            {(invoiceData.items || []).map((item, index) => (
              <tr key={index}>
                <td style={{ border: '1px solid #374151', padding: '8px', textAlign: 'center', fontSize: '12px' }}>
                  {index + 1}
                </td>
                <td style={{ border: '1px solid #374151', padding: '8px', textAlign: 'left', fontSize: '12px' }}>
                  {item.description || item.particular || 'N/A'}
                </td>
                <td style={{ border: '1px solid #374151', padding: '8px', textAlign: 'right', fontSize: '12px' }}>
                  {formatAmount(item.amount)}
                </td>
                <td style={{ border: '1px solid #374151', padding: '8px', textAlign: 'right', fontSize: '12px' }}>
                  {formatAmount(item.billAmount || item.amount)}
                </td>
              </tr>
            ))}
            
            {/* Total Row */}
            <tr style={{ fontWeight: 'bold' }}>
              <td colSpan="3" style={{ border: '1px solid #374151', padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>
                Total
              </td>
              <td style={{ border: '1px solid #374151', padding: '8px', textAlign: 'right', fontSize: '12px', fontWeight: 'bold' }}>
                {formatAmount(invoiceData.grandTotal)}
              </td>
            </tr>
          </tbody>
        </table>

        {/* Amount in Words */}
        <div style={{ marginBottom: '20px', fontSize: '12px', color: '#374151' }}>
          <p style={{ margin: '0', fontWeight: 'bold' }}>Amount in Words:</p>
          <p style={{ margin: '4px 0 0 0' }}>{amountInWords(invoiceData.grandTotal)}</p>
        </div>

        {/* Terms & Conditions */}
        <div style={{ fontSize: '11px', color: '#374151', lineHeight: '1.4' }}>
          <p style={{ margin: '0 0 8px 0', fontWeight: 'bold', fontSize: '12px' }}>Terms & Conditions:</p>
          <ol style={{ margin: 0, paddingLeft: '20px' }}>
            <li style={{ margin: '2px 0' }}>1. Once goods sold will not be taken back.</li>
            <li style={{ margin: '2px 0' }}>2. Interest @ 18% p.a. will be charged if payment not made within 30 days.</li>
            <li style={{ margin: '2px 0' }}>3. Subject to Indore Jurisdiction.</li>
          </ol>
          
          <div style={{ marginTop: '15px', paddingTop: '10px', borderTop: '1px solid #d1d5db' }}>
            <p style={{ margin: '2px 0' }}><strong>Bank Details:</strong></p>
            <p style={{ margin: '2px 0' }}>Bank Name: {invoiceData.bankName || 'Bank of Baroda'}</p>
            <p style={{ margin: '2px 0' }}>Branch: {invoiceData.branchName || 'Palasia, Indore'}</p>
            <p style={{ margin: '2px 0' }}>A/c No: {invoiceData.accountNumber || 'XXXXXXXXXXXXXXX4046'}</p>
            <p style={{ margin: '2px 0' }}>IFSC: {invoiceData.ifscCode || 'BARB0PALASX'}</p>
          </div>
        </div>

        {/* Signature Section */}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', paddingTop: '20px' }}>
          <div style={{ width: '45%' }}>
            <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 40px 0' }}>Receiver's Signature</p>
            <div style={{ height: '2px', backgroundColor: '#374151', width: '100%' }}></div>
          </div>
          <div style={{ width: '45%', textAlign: 'right' }}>
            <p style={{ fontSize: '12px', color: '#374151', margin: '0 0 40px 0' }}>For Yashraj Enterprises</p>
            <div style={{ height: '2px', backgroundColor: '#374151', width: '100%' }}></div>
            <p style={{ fontSize: '12px', color: '#374151', marginTop: '10px' }}>Authorised Signatory</p>
          </div>
        </div>
      </div>
    </div>
  );
}

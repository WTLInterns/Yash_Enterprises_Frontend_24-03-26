'use client';

import { useRef, useState } from 'react';

export default function InvoicePreview({ invoice, data }) {
  const inv = invoice || data || {};
  const printRef = useRef(null);
  const [downloading, setDownloading] = useState(false);

  /* ── helpers ── */
  const fmt = (amount) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount) || 0);

  const fmtDate = (d) => {
    if (!d) return '';
    try {
      return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(d));
    } catch { return ''; }
  };

  const numberToWords = (num) => {
    const n = Math.floor(Number(num) || 0);
    if (n === 0) return 'Zero Rupees Only';
    const u = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten','Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const t = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const two = (x) => x < 20 ? u[x] : (t[Math.floor(x/10)] + (x % 10 ? ' ' + u[x % 10] : ''));
    const three = (x) => x >= 100 ? u[Math.floor(x/100)] + ' Hundred' + (x % 100 ? ' ' + two(x % 100) : '') : two(x);
    let r = '', x = n;
    const cr = Math.floor(x / 10000000); x %= 10000000;
    const lk = Math.floor(x / 100000);   x %= 100000;
    const th = Math.floor(x / 1000);     x %= 1000;
    if (cr) r += two(cr) + ' Crore ';
    if (lk) r += two(lk) + ' Lakh ';
    if (th) r += two(th) + ' Thousand ';
    if (x)  r += three(x) + ' ';
    return r.trim() + ' Rupees Only';
  };

  /* ── totals ── */
  const items = Array.isArray(inv.items) ? inv.items : [];
  const subtotal   = items.reduce((s, i) => s + (Number(i.qty) || 0) * (Number(i.rate) || 0), 0);
  const cgst       = inv.includeGst ? subtotal * 0.09 : 0;
  const sgst       = inv.includeGst ? subtotal * 0.09 : 0;
  const grandTotal = Number(inv.grandTotal) || subtotal + cgst + sgst;

  const bankName    = inv.selectedBankName || inv.billedToName || '';
  const branchName  = inv.selectedBranch   || inv.billedToBranch || '';
  const customerName = inv.selectedCustomer?.name || '';

  const upiUri = inv.upiId && inv.accountName
    ? `upi://pay?${new URLSearchParams({ pa: inv.upiId, pn: inv.accountName, am: grandTotal.toFixed(2), cu: 'INR', tn: 'Invoice Payment' })}`
    : '';
  const qrUrl = upiUri
    ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiUri)}`
    : null;

  /* ── PDF download: html2canvas → jsPDF, ALWAYS single page ── */
  const handleDownload = async () => {
    if (!printRef.current || downloading) return;
    setDownloading(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas'),
        import('jspdf'),
      ]);

      const el = printRef.current;
      const prevStyle = el.getAttribute('style') || '';
      el.style.width = '860px';
      el.style.maxWidth = '860px';

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
        imageTimeout: 15000,
      });

      el.setAttribute('style', prevStyle);

      // Always fit entire content into ONE A4 page — scale down if needed
      const A4_W = 210;
      const A4_H = 297;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
      // Scale image to fill full A4 width; height is scaled proportionally
      // but capped at A4_H so it never overflows to page 2
      const imgW = A4_W;
      const naturalH = (canvas.height * A4_W) / canvas.width;
      const imgH = Math.min(naturalH, A4_H); // cap at page height → single page guaranteed
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, imgW, imgH);
      pdf.save(`Invoice_${inv.invoiceNo || 'Draft'}.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF generation failed. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  /* ── inline styles (same as UI) ── */
  const S = {
    wrap:    { fontFamily: "'Segoe UI', Arial, Helvetica, sans-serif", background: '#f3f4f6', padding: '24px' },
    sheet:   { background: '#fff', maxWidth: '860px', margin: '0 auto', boxShadow: '0 4px 24px rgba(0,0,0,0.12)', borderRadius: '8px', overflow: 'hidden' },
    hdr:     { background: 'linear-gradient(135deg,#e8eeff 0%,#f0f4ff 100%)', padding: '20px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #c7d2fe' },
    co:      { color: '#1e1b4b', fontSize: '20px', fontWeight: '700', margin: 0, letterSpacing: '0.3px' },
    coMeta:  { color: '#4b5563', fontSize: '11px', marginTop: '2px', lineHeight: '1.4' },
    badge:   { background: 'rgba(99,102,241,0.1)', borderRadius: '10px', padding: '10px 16px', textAlign: 'right', minWidth: '180px', border: '1px solid #c7d2fe' },
    badgeT:  { color: '#3730a3', fontSize: '15px', fontWeight: '700', letterSpacing: '1.5px' },
    badgeM:  { color: '#4b5563', fontSize: '11px', marginTop: '4px' },
    body:    { padding: '16px 24px' },
    twoCol:  { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '12px' },
    secLbl:  { fontSize: '9px', fontWeight: '700', color: '#6366f1', letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: '5px', borderBottom: '1px solid #e0e7ff', paddingBottom: '3px' },
    fName:   { fontSize: '12px', fontWeight: '600', color: '#111827', margin: '1px 0' },
    fVal:    { fontSize: '11px', color: '#6b7280', margin: '1px 0', lineHeight: '1.4' },
    custBnr: { background: '#fef3c7', border: '1px solid #fcd34d', borderRadius: '4px', padding: '6px 12px', marginBottom: '10px', fontSize: '11px', fontWeight: '600', color: '#92400e' },
    divider: { height: '1px', background: '#e5e7eb', margin: '0 0 10px 0' },
    tbl:     { width: '100%', borderCollapse: 'collapse', marginBottom: '10px', fontSize: '11px' },
    th:      { background: '#fbbf24', color: '#1f2937', fontWeight: '700', padding: '6px 6px', border: '1px solid #d1d5db', textAlign: 'left', whiteSpace: 'nowrap' },
    thR:     { background: '#fbbf24', color: '#1f2937', fontWeight: '700', padding: '6px 6px', border: '1px solid #d1d5db', textAlign: 'right', whiteSpace: 'nowrap' },
    thC:     { background: '#fbbf24', color: '#1f2937', fontWeight: '700', padding: '6px 6px', border: '1px solid #d1d5db', textAlign: 'center', whiteSpace: 'nowrap' },
    td:      { padding: '5px 6px', border: '1px solid #e5e7eb', color: '#374151', verticalAlign: 'top' },
    tdR:     { padding: '5px 6px', border: '1px solid #e5e7eb', color: '#374151', textAlign: 'right' },
    tdC:     { padding: '5px 6px', border: '1px solid #e5e7eb', color: '#374151', textAlign: 'center' },
    tdA:     { padding: '5px 6px', border: '1px solid #e5e7eb', color: '#374151', background: '#f9fafb', verticalAlign: 'top' },
    tdAR:    { padding: '5px 6px', border: '1px solid #e5e7eb', color: '#374151', background: '#f9fafb', textAlign: 'right' },
    tdAC:    { padding: '5px 6px', border: '1px solid #e5e7eb', color: '#374151', background: '#f9fafb', textAlign: 'center' },
    totWrap: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' },
    totBox:  { width: '260px', border: '1px solid #d1d5db', borderRadius: '6px', overflow: 'hidden' },
    totRow:  { display: 'flex', justifyContent: 'space-between', padding: '5px 12px', borderBottom: '1px solid #e5e7eb', fontSize: '11px', color: '#374151' },
    totGrand:{ display: 'flex', justifyContent: 'space-between', padding: '7px 12px', background: '#fef3c7', fontSize: '13px', fontWeight: '700', color: '#92400e' },
    words:   { background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '4px', padding: '6px 12px', marginBottom: '10px', fontSize: '11px', color: '#166534', lineHeight: '1.4' },
    bankGrid:{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '10px' },
    bankBox: { border: '1px solid #e5e7eb', borderRadius: '6px', padding: '10px' },
    terms:   { background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '8px 12px', marginBottom: '10px' },
    sigWrap: { display: 'flex', justifyContent: 'flex-end', marginBottom: '10px' },
    sigBox:  { textAlign: 'center', width: '180px' },
    footer:  { background: '#f9fafb', borderTop: '1px solid #e5e7eb', padding: '8px 24px', textAlign: 'center', fontSize: '10px', color: '#9ca3af' },
  };

  return (
    <div style={S.wrap}>
      {/* Download button — outside the captured div */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '16px' }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            background: downloading ? '#86efac' : '#16a34a',
            color: '#fff', border: 'none', borderRadius: '8px',
            padding: '10px 22px', fontSize: '14px', fontWeight: '600',
            cursor: downloading ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 8px rgba(22,163,74,0.3)',
            transition: 'background 0.2s',
          }}
        >
          {downloading ? (
            <>
              <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid #fff', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
              Generating PDF…
            </>
          ) : (
            <>⬇ Download PDF</>
          )}
        </button>
      </div>

      {/* ── Invoice sheet — this exact div is captured ── */}
      <div ref={printRef} data-pdf-root="true" style={S.sheet}>

        {/* Gradient header */}
        <div style={S.hdr}>
          <div>
            {inv.companyLogo && (
              <img src={inv.companyLogo} alt="logo"
                style={{ height: '40px', marginBottom: '6px', objectFit: 'contain', display: 'block' }}
                crossOrigin="anonymous"
              />
            )}
            <p style={S.co}>{inv.billedByName || 'Company Name'}</p>
            {/* Single-line owner info — no duplicate stacking */}
            <p style={S.coMeta}>
              {[inv.billedByAddress, inv.billedByEmail, inv.gstin && `GST: ${inv.gstin}`, inv.pan && `PAN: ${inv.pan}`]
                .filter(Boolean).join('  |  ')}
            </p>
          </div>
          <div style={S.badge}>
            <div style={S.badgeT}>{inv.isProForma ? 'PRO FORMA INVOICE' : 'TAX INVOICE'}</div>
            <div style={S.badgeM}>Invoice No: <strong style={{ color: '#fff' }}>{inv.invoiceNo || '—'}</strong></div>
            <div style={S.badgeM}>Date: {fmtDate(inv.invoiceDate)}</div>
            {inv.dueDate && <div style={S.badgeM}>Due: {fmtDate(inv.dueDate)}</div>}
          </div>
        </div>

        <div style={S.body}>

          {/* Billed By (GSTIN/PAN only — name already in header) / Billed To */}
          <div style={S.twoCol}>
            <div>
              <div style={S.secLbl}>Billed By</div>
              {inv.gstin && <p style={S.fVal}>GSTIN: {inv.gstin}</p>}
              {inv.pan   && <p style={S.fVal}>PAN: {inv.pan}</p>}
              {!inv.gstin && !inv.pan && inv.billedByAddress && <p style={S.fVal}>{inv.billedByAddress}</p>}
            </div>
            <div>
              <div style={S.secLbl}>Billed To</div>
              <p style={{ ...S.fVal, marginBottom: '2px' }}>The Branch Manager,</p>
              {bankName   && <p style={S.fName}>{bankName}</p>}
              {branchName && <p style={S.fVal}>{branchName}</p>}
              {inv.billedToAddress && <p style={S.fVal}>{inv.billedToAddress}</p>}
              {inv.billedToGstin   && <p style={S.fVal}>GSTIN: {inv.billedToGstin}</p>}
              {!bankName && inv.billedToMobile && <p style={S.fVal}>Mobile: {inv.billedToMobile}</p>}
              {!bankName && inv.billedToEmail  && <p style={S.fVal}>Email: {inv.billedToEmail}</p>}
            </div>
          </div>

          {/* Customer banner */}
          {customerName && (
            <div style={S.custBnr}>
              Customer: {customerName}
              {inv.billedToMobile && ` | Mobile: ${inv.billedToMobile}`}
              {inv.billedToEmail  && ` | Email: ${inv.billedToEmail}`}
            </div>
          )}

          <div style={S.divider} />

          {/* Items table */}
          <table style={S.tbl}>
            <thead>
              <tr>
                <th style={{ ...S.th, width: '36px', textAlign: 'center' }}>#</th>
                <th style={S.th}>Particular</th>
                {inv.includeGst && <th style={{ ...S.thC, width: '60px' }}>GST %</th>}
                <th style={{ ...S.thC, width: '48px' }}>Qty</th>
                <th style={{ ...S.thR, width: '88px' }}>Rate</th>
                <th style={{ ...S.thR, width: '96px' }}>Amount</th>
                {inv.includeGst && <th style={{ ...S.thR, width: '80px' }}>CGST</th>}
                {inv.includeGst && <th style={{ ...S.thR, width: '80px' }}>SGST</th>}
                <th style={{ ...S.thR, width: '96px' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={inv.includeGst ? 9 : 6}
                    style={{ ...S.td, textAlign: 'center', color: '#9ca3af', padding: '32px' }}>
                    No items added
                  </td>
                </tr>
              ) : items.map((item, i) => {
                const amt = (Number(item.qty) || 0) * (Number(item.rate) || 0);
                const cg  = inv.includeGst ? amt * 0.09 : 0;
                const sg  = inv.includeGst ? amt * 0.09 : 0;
                const tot = amt + cg + sg;
                const alt = i % 2 !== 0;
                return (
                  <tr key={i}>
                    <td style={{ ...(alt ? S.tdA : S.td), textAlign: 'center' }}>{i + 1}</td>
                    <td style={alt ? S.tdA : S.td}>
                      <div style={{ fontWeight: '600' }}>{item.name || item.productName || '—'}</div>
                      {item.description && (
                        <div style={{ fontSize: '11px', color: '#9ca3af', marginTop: '2px' }}>{item.description}</div>
                      )}
                    </td>
                    {inv.includeGst && <td style={alt ? S.tdAC : S.tdC}>18%</td>}
                    <td style={alt ? S.tdAC : S.tdC}>{item.qty}</td>
                    <td style={alt ? S.tdAR : S.tdR}>{fmt(item.rate)}</td>
                    <td style={alt ? S.tdAR : S.tdR}>{fmt(amt)}</td>
                    {inv.includeGst && <td style={alt ? S.tdAR : S.tdR}>{fmt(cg)}</td>}
                    {inv.includeGst && <td style={alt ? S.tdAR : S.tdR}>{fmt(sg)}</td>}
                    <td style={{ ...(alt ? S.tdAR : S.tdR), fontWeight: '600' }}>{fmt(tot)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Totals + Amount in words */}
          {items.length > 0 && (
            <>
              <div style={S.totWrap}>
                <div style={S.totBox}>
                  <div style={S.totRow}><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
                  {inv.includeGst && <div style={S.totRow}><span>CGST @ 9%</span><span>{fmt(cgst)}</span></div>}
                  {inv.includeGst && <div style={S.totRow}><span>SGST @ 9%</span><span>{fmt(sgst)}</span></div>}
                  <div style={S.totGrand}><span>Grand Total</span><span>{fmt(grandTotal)}</span></div>
                </div>
              </div>
              <div style={S.words}>
                <strong>Amount in Words: </strong>{numberToWords(grandTotal)}
              </div>
            </>
          )}

          {/* Bank Details + UPI */}
          {(inv.accountName || inv.upiId) && (
            <div style={S.bankGrid}>
              {inv.accountName && (
                <div style={S.bankBox}>
                  <div style={S.secLbl}>Bank Details</div>
                  <p style={S.fName}>{inv.accountName}</p>
                  {inv.accountNumber && <p style={S.fVal}>A/C No: {inv.accountNumber}</p>}
                  {inv.ifsc          && <p style={S.fVal}>IFSC: {inv.ifsc}</p>}
                  {inv.accountType   && <p style={S.fVal}>Type: {inv.accountType}</p>}
                  {inv.bank          && <p style={S.fVal}>Bank: {inv.bank}</p>}
                </div>
              )}
              {inv.upiId && (
                <div style={S.bankBox}>
                  <div style={S.secLbl}>UPI Payment</div>
                  <p style={S.fVal}>UPI ID: <strong style={{ color: '#374151' }}>{inv.upiId}</strong></p>
                  <p style={{ ...S.fVal, marginBottom: '8px' }}>Max ₹1,00,000 via UPI</p>
                  {qrUrl && (
                    <div style={{ textAlign: 'center' }}>
                      <img src={qrUrl} alt="UPI QR Code" crossOrigin="anonymous"
                        style={{ width: '130px', height: '130px', border: '2px solid #e5e7eb', borderRadius: '8px', display: 'block', margin: '0 auto' }}
                      />
                      <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '6px' }}>
                        Scan to pay {fmt(grandTotal)}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Terms & Conditions */}
          {inv.terms && (
            <div style={S.terms}>
              <div style={S.secLbl}>Terms &amp; Conditions</div>
              {inv.terms.split('\n').filter(l => l.trim()).map((l, i) => (
                <p key={i} style={{ fontSize: '12px', color: '#6b7280', margin: '3px 0' }}>• {l.trim()}</p>
              ))}
            </div>
          )}

          {/* Authorized Signature */}
          {inv.signature && (
            <div style={S.sigWrap}>
              <div style={S.sigBox}>
                <img src={inv.signature} alt="Signature" crossOrigin="anonymous"
                  style={{ width: '180px', height: '70px', objectFit: 'contain', border: '1px solid #e5e7eb', borderRadius: '4px', display: 'block', margin: '0 auto' }}
                />
                <div style={{ height: '1px', background: '#374151', marginTop: '10px' }} />
                <p style={{ fontSize: '11px', color: '#6b7280', marginTop: '4px' }}>Authorized Signatory</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={S.footer}>
          This is a computer generated invoice and does not require a physical signature.
        </div>
      </div>

      {/* Spinner keyframe */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

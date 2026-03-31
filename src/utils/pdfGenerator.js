import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class InvoicePdfGenerator {
  constructor(invoice) {
    this.invoice = invoice || {};
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' });

    this.W  = this.doc.internal.pageSize.getWidth();   // 210
    this.H  = this.doc.internal.pageSize.getHeight();  // 297
    this.m  = 12;                                       // margin
    this.cW = this.W - this.m * 2;                     // content width

    // ── Palette ──────────────────────────────────────────────
    this.c = {
      black:      [15,  15,  15],
      gray:       [100, 100, 100],
      lightGray:  [210, 210, 210],
      border:     [200, 200, 200],
      // Light premium header (soft indigo-blue)
      hdrBg:      [235, 240, 255],
      hdrAccent:  [99,  102, 241],
      hdrText:    [30,  30,  80],
      // Title bar
      titleBg:    [99,  102, 241],
      // Sections
      sectionLbl: [67,  56,  202],
      paleYellow: [255, 251, 210],
      yellow:     [255, 204,   0],
      green:      [22,  163,  74],
      white:      [255, 255, 255],
    };
  }

  // ── Utilities ────────────────────────────────────────────────

  n(v)  { const x = Number(v); return Number.isFinite(x) ? x : 0; }
  s(v, fb = '') { if (v == null) return fb; const t = String(v).trim(); return t || fb; }

  fc(amount) { return `Rs.${this.n(amount).toFixed(2)}`; }

  fd(date) {
    if (!date) return '';
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
  }

  txt(text, x, y, opts = {}) { this.doc.text(String(text ?? ''), x, y, opts); }

  line(x1, y1, x2, y2, color = this.c.border, w = 0.25) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(w);
    this.doc.line(x1, y1, x2, y2);
  }

  // ── Number to words ──────────────────────────────────────────

  n2w(value) {
    let num = Math.floor(this.n(value));
    if (num === 0) return 'Zero Rupees Only';
    const u = ['','One','Two','Three','Four','Five','Six','Seven','Eight','Nine','Ten',
               'Eleven','Twelve','Thirteen','Fourteen','Fifteen','Sixteen','Seventeen','Eighteen','Nineteen'];
    const t = ['','','Twenty','Thirty','Forty','Fifty','Sixty','Seventy','Eighty','Ninety'];
    const two   = (n) => n < 20 ? u[n] : (t[Math.floor(n/10)] + (n%10 ? ' '+u[n%10] : ''));
    const three = (n) => n >= 100 ? u[Math.floor(n/100)]+' Hundred'+(n%100?' '+two(n%100):'') : two(n);
    const parts = [];
    const cr = Math.floor(num/10000000); num %= 10000000;
    const lk = Math.floor(num/100000);   num %= 100000;
    const th = Math.floor(num/1000);     num %= 1000;
    if (cr) parts.push(two(cr)+' Crore');
    if (lk) parts.push(two(lk)+' Lakh');
    if (th) parts.push(two(th)+' Thousand');
    if (num) parts.push(three(num));
    return parts.join(' ') + ' Rupees Only';
  }

  // ── Data helpers ─────────────────────────────────────────────

  getItems()    { return Array.isArray(this.invoice.items) ? this.invoice.items : []; }
  companyName() { return this.s(this.invoice.billedByName) || 'Company'; }
  bankName()    { return this.s(this.invoice.selectedBankName) || this.s(this.invoice.billedToName); }
  branchName()  { return this.s(this.invoice.selectedBranch)   || this.s(this.invoice.billedToBranch); }
  customerName(){ return this.s(this.invoice.selectedCustomer?.name) || this.s(this.invoice.billedToName); }

  grandTotal() {
    const gt = this.n(this.invoice.grandTotal);
    if (gt > 0) return gt;
    const items = this.getItems();
    const sub = items.reduce((s, i) => s + this.n(i.qty) * this.n(i.rate), 0);
    const cgst = this.n(this.invoice.cgst);
    const sgst = this.n(this.invoice.sgst);
    return sub + cgst + sgst;
  }

  // ── 1. HEADER — light premium, single-line owner info ────────

  addHeader(y) {
    const hH = 22; // compact header height

    // Light background rect
    this.doc.setFillColor(...this.c.hdrBg);
    this.doc.rect(0, 0, this.W, hH, 'F');

    // Left accent bar
    this.doc.setFillColor(...this.c.hdrAccent);
    this.doc.rect(0, 0, 3, hH, 'F');

    // Logo (if present)
    let logoEndX = this.m + 3;
    if (this.invoice.companyLogo) {
      try {
        this.doc.addImage(this.invoice.companyLogo, 'PNG', this.m + 3, 3, 14, 14);
        logoEndX = this.m + 20;
      } catch (_) { /* skip */ }
    }

    // Company name — bold, dark
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(13);
    this.doc.setTextColor(...this.c.hdrText);
    this.txt(this.companyName(), logoEndX, 10);

    // Single-line owner info below name
    const addr  = this.s(this.invoice.billedByAddress);
    const email = this.s(this.invoice.billedByEmail);
    const gstin = this.s(this.invoice.gstin);
    const pan   = this.s(this.invoice.pan);
    const phone = this.s(this.invoice.billedByMobile) || this.s(this.invoice.phone);

    const parts = [];
    if (addr)  parts.push(addr);
    if (email) parts.push(email);
    if (gstin) parts.push(`GST: ${gstin}`);
    if (pan)   parts.push(`PAN: ${pan}`);
    if (phone) parts.push(`Ph: ${phone}`);

    if (parts.length) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...this.c.gray);
      // Truncate to fit page width
      const infoLine = parts.join('  |  ');
      const maxW = this.W - logoEndX - 60;
      const fitted = this.doc.splitTextToSize(infoLine, maxW)[0] || infoLine;
      this.txt(fitted, logoEndX, 17);
    }

    // Right side: invoice type badge
    const badgeW = 52;
    const badgeX = this.W - this.m - badgeW;
    this.doc.setFillColor(...this.c.hdrAccent);
    this.doc.roundedRect(badgeX, 5, badgeW, 12, 2, 2, 'F');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.c.white);
    const label = this.invoice.isProForma ? 'PRO FORMA INVOICE' : 'TAX INVOICE';
    this.txt(label, badgeX + badgeW / 2, 12.5, { align: 'center' });

    this.doc.setTextColor(...this.c.black);
    return hH + 2;
  }

  // ── 2. INVOICE META — invoice no / date / due date ───────────

  addInvoiceMeta(y) {
    const invoiceNo  = this.s(this.invoice.invoiceNo, 'INV-001');
    const invoiceDate = this.fd(this.invoice.invoiceDate);
    const dueDate    = this.fd(this.invoice.dueDate);

    // Light background strip
    this.doc.setFillColor(248, 249, 255);
    this.doc.rect(this.m, y, this.cW, 10, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...this.c.sectionLbl);

    const col1 = this.m + 2;
    const col2 = this.m + 60;
    const col3 = this.m + 120;

    this.txt('Invoice No:', col1, y + 4);
    this.txt('Date:', col2, y + 4);
    if (dueDate) this.txt('Due Date:', col3, y + 4);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...this.c.black);
    this.doc.setFontSize(8);

    this.txt(invoiceNo, col1 + 20, y + 4);
    this.txt(invoiceDate, col2 + 12, y + 4);
    if (dueDate) this.txt(dueDate, col3 + 18, y + 4);

    this.line(this.m, y + 10, this.m + this.cW, y + 10, this.c.border);
    return y + 13;
  }

  // ── 3. BILLED TO (no duplicate — owner already in header) ────

  addBilledToSection(y) {
    const halfW    = (this.cW - 6) / 2;
    const rightColX = this.m + halfW + 6;

    // Section labels
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...this.c.sectionLbl);
    this.txt('BILLED BY', this.m, y);
    this.txt('BILLED TO', rightColX, y);
    y += 4;

    // ── LEFT: only GSTIN / PAN (name already in header) ──
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...this.c.gray);

    let leftY = y;
    const gstin = this.s(this.invoice.gstin);
    const pan   = this.s(this.invoice.pan);
    const byAddr = this.s(this.invoice.billedByAddress);

    if (byAddr) {
      const lines = this.doc.splitTextToSize(byAddr, halfW);
      lines.slice(0, 2).forEach(l => { this.txt(l, this.m, leftY); leftY += 4; });
    }
    if (gstin) { this.txt(`GSTIN: ${gstin}`, this.m, leftY); leftY += 4; }
    if (pan)   { this.txt(`PAN: ${pan}`,     this.m, leftY); leftY += 4; }

    // ── RIGHT: Billed To ──
    let rightY = y;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...this.c.gray);
    this.txt('The Branch Manager,', rightColX, rightY);
    rightY += 4;

    const bank   = this.bankName();
    const branch = this.branchName();
    const toAddr = this.s(this.invoice.billedToAddress);
    const toGst  = this.s(this.invoice.billedToGstin);
    const mobile = this.s(this.invoice.billedToMobile) || this.s(this.invoice.selectedCustomer?.contactPhone);
    const toEmail = this.s(this.invoice.billedToEmail) || this.s(this.invoice.selectedCustomer?.email);

    if (bank) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(...this.c.black);
      this.txt(bank, rightColX, rightY);
      rightY += 4.5;
    }
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...this.c.gray);
    if (branch) { this.txt(branch, rightColX, rightY); rightY += 4; }
    if (toAddr) {
      const lines = this.doc.splitTextToSize(toAddr, halfW);
      lines.slice(0, 2).forEach(l => { this.txt(l, rightColX, rightY); rightY += 4; });
    }
    if (toGst)   { this.txt(`GSTIN: ${toGst}`, rightColX, rightY); rightY += 4; }
    if (!bank && mobile) { this.txt(`Mobile: ${mobile}`, rightColX, rightY); rightY += 4; }
    if (!bank && toEmail){ this.txt(`Email: ${toEmail}`, rightColX, rightY); rightY += 4; }

    this.doc.setTextColor(...this.c.black);
    y = Math.max(leftY, rightY) + 2;

    // Customer banner (compact)
    const cust = this.customerName();
    if (cust) {
      this.doc.setFillColor(...this.c.paleYellow);
      this.doc.rect(this.m, y, this.cW, 7, 'F');
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(8);
      this.doc.setTextColor(120, 80, 0);
      let banner = `Customer: ${cust}`;
      if (mobile) banner += `  |  ${mobile}`;
      this.txt(banner, this.m + 2, y + 4.8);
      y += 9;
    }

    this.line(this.m, y, this.m + this.cW, y, this.c.border);
    return y + 3;
  }

  // ── 4. ITEMS TABLE — compact ──────────────────────────────────

  addItemsTable(y) {
    const items = this.getItems();
    if (!items.length) return y + 4;

    const includeGst = this.invoice.includeGst !== false;

    const body = items.map((item, i) => {
      const qty  = this.n(item.qty) || 1;
      const rate = this.n(item.rate);
      const amt  = qty * rate;
      const cg   = includeGst ? amt * 0.09 : 0;
      const sg   = includeGst ? amt * 0.09 : 0;
      const tot  = amt + cg + sg;
      const name = this.s(item.name || item.productName || item.title || 'Item');

      if (includeGst) {
        return [String(i+1), name, '18%', String(qty), this.fc(rate), this.fc(amt), this.fc(cg), this.fc(sg), this.fc(tot)];
      }
      return [String(i+1), name, String(qty), this.fc(rate), this.fc(amt), this.fc(tot)];
    });

    const head = includeGst
      ? [['#', 'Particular', 'GST%', 'Qty', 'Rate', 'Amount', 'CGST', 'SGST', 'Total']]
      : [['#', 'Particular', 'Qty', 'Rate', 'Amount', 'Total']];

    const colStyles = includeGst ? {
      0: { halign: 'center', cellWidth: 8  },
      1: { halign: 'left',   cellWidth: 52 },
      2: { halign: 'center', cellWidth: 12 },
      3: { halign: 'center', cellWidth: 10 },
      4: { halign: 'right',  cellWidth: 22 },
      5: { halign: 'right',  cellWidth: 22 },
      6: { halign: 'right',  cellWidth: 20 },
      7: { halign: 'right',  cellWidth: 20 },
      8: { halign: 'right',  cellWidth: 20 },
    } : {
      0: { halign: 'center', cellWidth: 10 },
      1: { halign: 'left',   cellWidth: 80 },
      2: { halign: 'center', cellWidth: 14 },
      3: { halign: 'right',  cellWidth: 26 },
      4: { halign: 'right',  cellWidth: 26 },
      5: { halign: 'right',  cellWidth: 30 },
    };

    autoTable(this.doc, {
      startY: y,
      head,
      body,
      theme: 'grid',
      pageBreak: 'avoid',          // ← prevent auto page break
      rowPageBreak: 'avoid',
      styles: {
        fontSize: 7.5,
        cellPadding: 1.8,
        valign: 'middle',
        lineColor: [200, 200, 200],
        lineWidth: 0.2,
        overflow: 'linebreak',
      },
      headStyles: {
        fillColor: this.c.yellow,
        textColor: [20, 20, 20],
        fontStyle: 'bold',
        fontSize: 7.5,
        cellPadding: 2,
      },
      alternateRowStyles: { fillColor: [250, 250, 255] },
      columnStyles: colStyles,
      margin: { left: this.m, right: this.m },
    });

    return this.doc.lastAutoTable.finalY + 3;
  }

  // ── 5. TOTALS — compact right-aligned box ────────────────────

  addTotalSection(y) {
    const total   = this.grandTotal();
    const sub     = this.n(this.invoice.subtotal) || total / (this.invoice.includeGst !== false ? 1.18 : 1);
    const cgst    = this.n(this.invoice.cgst);
    const sgst    = this.n(this.invoice.sgst);
    const inclGst = this.invoice.includeGst !== false;

    const boxW = 80;
    const boxX = this.W - this.m - boxW;
    const rowH = 5.5;
    const rows = inclGst ? 4 : 2; // subtotal + cgst + sgst + grand  OR  subtotal + grand
    const boxH = rows * rowH + 2;

    // Grand total highlight box
    this.doc.setFillColor(...this.c.paleYellow);
    this.doc.setDrawColor(...this.c.border);
    this.doc.setLineWidth(0.3);
    this.doc.rect(boxX, y, boxW, boxH);
    this.doc.rect(boxX, y, boxW, boxH, 'F');

    let ry = y + rowH;
    const drawRow = (label, value, bold = false) => {
      this.doc.setFont('helvetica', bold ? 'bold' : 'normal');
      this.doc.setFontSize(bold ? 8.5 : 7.5);
      this.doc.setTextColor(...this.c.black);
      this.txt(label, boxX + 3, ry);
      this.txt(value, boxX + boxW - 3, ry, { align: 'right' });
      ry += rowH;
    };

    if (inclGst) {
      drawRow('Subtotal',   this.fc(sub));
      drawRow('CGST @ 9%', this.fc(cgst));
      drawRow('SGST @ 9%', this.fc(sgst));
    }
    drawRow('Grand Total', this.fc(total), true);

    // Amount in words — left side, same row band
    const words = this.n2w(total);
    const wordsLines = this.doc.splitTextToSize(`In Words: ${words}`, this.cW - boxW - 6);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...this.c.green);
    wordsLines.slice(0, 3).forEach((l, i) => {
      this.txt(l, this.m, y + rowH + i * 4);
    });

    this.doc.setTextColor(...this.c.black);
    return y + boxH + 3;
  }

  // ── 6. BANK DETAILS — compact two-column ─────────────────────

  addBankDetailsSection(y) {
    const has = this.invoice.accountName || this.invoice.accountNumber ||
                this.invoice.ifsc || this.invoice.bank || this.invoice.upiId;
    if (!has) return y;

    this.line(this.m, y, this.m + this.cW, y, this.c.border);
    y += 3;

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...this.c.sectionLbl);
    this.txt('BANK DETAILS', this.m, y);
    y += 4;

    const halfW    = (this.cW - 6) / 2;
    const rightColX = this.m + halfW + 6;
    let leftY = y, rightY = y;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...this.c.black);

    const kv = (label, val, x, cy) => {
      this.doc.setFont('helvetica', 'bold');
      this.txt(`${label}:`, x, cy);
      this.doc.setFont('helvetica', 'normal');
      this.txt(val, x + 22, cy);
      return cy + 4;
    };

    if (this.invoice.accountName)   leftY = kv('Acc Name', this.invoice.accountName,   this.m, leftY);
    if (this.invoice.accountNumber) leftY = kv('A/C No',   this.invoice.accountNumber,  this.m, leftY);
    if (this.invoice.ifsc)          leftY = kv('IFSC',     this.invoice.ifsc,            this.m, leftY);
    if (this.invoice.bank)          leftY = kv('Bank',     this.invoice.bank,            this.m, leftY);
    if (this.invoice.accountType)   leftY = kv('Type',     this.invoice.accountType,     this.m, leftY);

    if (this.invoice.upiId) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(7);
      this.doc.setTextColor(...this.c.sectionLbl);
      this.txt('UPI PAYMENT', rightColX, rightY);
      rightY += 4;
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7.5);
      this.doc.setTextColor(...this.c.black);
      rightY = kv('UPI ID', this.invoice.upiId, rightColX, rightY);
    }

    return Math.max(leftY, rightY) + 2;
  }

  // ── 7. TERMS — compact ───────────────────────────────────────

  addTermsSection(y) {
    const custom = this.s(this.invoice.terms);
    const defaults = [
      'GST on reverse charge basis as applicable.',
      'This is a computer generated invoice.',
    ];
    const lines = custom
      ? custom.split('\n').map(l => l.trim()).filter(Boolean)
      : defaults;
    if (!lines.length) return y;

    this.line(this.m, y, this.m + this.cW, y, this.c.border);
    y += 3;

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...this.c.sectionLbl);
    this.txt('TERMS & CONDITIONS', this.m, y);
    y += 4;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7);
    this.doc.setTextColor(...this.c.gray);
    lines.forEach(l => { this.txt(`• ${l}`, this.m, y); y += 3.8; });

    return y + 1;
  }

  // ── 8. SIGNATURE — FIXED at bottom of page ───────────────────

  addSignature() {
    // Always pinned to bottom — never overflows
    const sigY = this.H - 28;
    const sigX = this.W - this.m - 45;

    // Line above signature
    this.line(sigX - 2, sigY, sigX + 45, sigY, this.c.black, 0.4);

    if (this.invoice.signature) {
      try {
        this.doc.addImage(this.invoice.signature, 'PNG', sigX, sigY - 14, 45, 12);
      } catch (_) { /* skip */ }
    }

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7.5);
    this.doc.setTextColor(...this.c.gray);
    this.txt('Authorized Signatory', sigX + 22, sigY + 5, { align: 'center' });
    this.txt(this.companyName(), sigX + 22, sigY + 9, { align: 'center' });
  }

  // ── 9. FOOTER ─────────────────────────────────────────────────

  addFooter() {
    const fy = this.H - 6;
    this.line(this.m, fy - 3, this.m + this.cW, fy - 3, this.c.lightGray);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(6.5);
    this.doc.setTextColor(160, 160, 160);
    this.txt('This is a computer generated invoice and does not require a physical signature.', this.W / 2, fy, { align: 'center' });
    this.doc.setTextColor(...this.c.black);
  }

  // ── 10. WATERMARK ─────────────────────────────────────────────

  addWatermark() {
    this.doc.setTextColor(240, 240, 240);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(38);
    const name = this.companyName();
    this.txt(name, this.W / 2, this.H / 2, { align: 'center', angle: 35 });
    this.doc.setTextColor(...this.c.black);
  }

  // ── GENERATE ──────────────────────────────────────────────────

  async generatePdf() {
    this.addWatermark();

    let y = 0;
    y = this.addHeader(y);
    y = this.addInvoiceMeta(y);
    y = this.addBilledToSection(y);
    y = this.addItemsTable(y);
    y = this.addTotalSection(y);
    y = this.addBankDetailsSection(y);
    y = this.addTermsSection(y);

    // Signature always at fixed bottom position
    this.addSignature();
    this.addFooter();

    return this.doc.output('blob');
  }
}

export async function generateInvoicePdf(invoice) {
  const gen = new InvoicePdfGenerator(invoice);
  return gen.generatePdf();
}

export default generateInvoicePdf;

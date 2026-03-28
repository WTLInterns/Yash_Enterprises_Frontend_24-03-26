import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export class InvoicePdfGenerator {
  constructor(invoice) {
    this.invoice = invoice || {};
    this.doc = new jsPDF({ unit: 'mm', format: 'a4' });

    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();

    this.margin = 16;
    this.contentWidth = this.pageWidth - this.margin * 2;

    this.colors = {
      black: [0, 0, 0],
      gray: [92, 92, 92],
      lightGray: [220, 220, 220],
      border: [180, 180, 180],
      indigo: [99, 102, 241],
      indigoDark: [67, 56, 202],
      yellow: [255, 235, 120],
      yellowDark: [255, 204, 0],
      paleYellow: [255, 250, 205],
      white: [255, 255, 255],
      green: [22, 163, 74],
    };
  }

  toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }

  safeString(value, fallback = '') {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text.length ? text : fallback;
  }

  formatCurrency(amount) {
    const value = this.toNumber(amount);
    return `Rs. ${value.toFixed(2)}`;
  }

  formatDate(date) {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';

    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  }

  formatDateTime(date) {
    if (!date) return '';
    const d = new Date(date);
    if (Number.isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }

  convertTwoDigits(num) {
    const units = [
      '',
      'One',
      'Two',
      'Three',
      'Four',
      'Five',
      'Six',
      'Seven',
      'Eight',
      'Nine',
      'Ten',
      'Eleven',
      'Twelve',
      'Thirteen',
      'Fourteen',
      'Fifteen',
      'Sixteen',
      'Seventeen',
      'Eighteen',
      'Nineteen',
    ];

    const tens = [
      '',
      '',
      'Twenty',
      'Thirty',
      'Forty',
      'Fifty',
      'Sixty',
      'Seventy',
      'Eighty',
      'Ninety',
    ];

    if (num < 20) return units[num];
    const t = Math.floor(num / 10);
    const u = num % 10;
    return u ? `${tens[t]} ${units[u]}` : tens[t];
  }

  convertThreeDigits(num) {
    const hundreds = Math.floor(num / 100);
    const rest = num % 100;
    let result = '';

    if (hundreds) result += `${this.convertTwoDigits(hundreds)} Hundred`;
    if (hundreds && rest) result += ' ';
    if (rest) result += this.convertTwoDigits(rest);

    return result.trim();
  }

  numberToWords(value) {
    let num = Math.floor(this.toNumber(value));
    if (num === 0) return 'Zero Rupees Only';

    const parts = [];

    const crore = Math.floor(num / 10000000);
    num %= 10000000;

    const lakh = Math.floor(num / 100000);
    num %= 100000;

    const thousand = Math.floor(num / 1000);
    num %= 1000;

    const belowThousand = num;

    if (crore) parts.push(`${this.convertTwoDigits(crore)} Crore`);
    if (lakh) parts.push(`${this.convertTwoDigits(lakh)} Lakh`);
    if (thousand) parts.push(`${this.convertTwoDigits(thousand)} Thousand`);
    if (belowThousand) parts.push(this.convertThreeDigits(belowThousand));

    return `${parts.filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()} Rupees Only`;
  }

  addText(text, x, y, options = {}) {
    this.doc.text(String(text ?? ''), x, y, options);
  }

  drawLine(x1, y1, x2, y2, color = this.colors.border, width = 0.3) {
    this.doc.setDrawColor(...color);
    this.doc.setLineWidth(width);
    this.doc.line(x1, y1, x2, y2);
  }

  ensureSpace(currentY, requiredHeight) {
    if (currentY + requiredHeight > this.pageHeight - this.margin - 8) {
      this.doc.addPage();
      return this.margin;
    }
    return currentY;
  }

  getCompanyName() {
    return (
      this.safeString(this.invoice.billedByName) ||
      this.safeString(this.invoice.companyName) ||
      'YASH ENTERPRISES'
    );
  }

  getCustomerName() {
    return (
      this.safeString(this.invoice.selectedCustomer?.name) ||
      this.safeString(this.invoice.billedToName) ||
      this.safeString(this.invoice.customerName)
    );
  }

  getBankName() {
    return (
      this.safeString(this.invoice.selectedBankName) ||
      this.safeString(this.invoice.bank) ||
      this.safeString(this.invoice.billedToName)
    );
  }

  getBranchName() {
    return this.safeString(this.invoice.selectedBranch) || this.safeString(this.invoice.billedToBranch);
  }

  getItems() {
    return Array.isArray(this.invoice.items) ? this.invoice.items : [];
  }

  shouldUsePercentMode() {
    const items = this.getItems();
    if (!items.length) return false;

    return items.some((item) => {
      const percent =
        this.toNumber(item?.percent) ||
        this.toNumber(item?.percentage) ||
        this.toNumber(item?.billPercent);
      return percent > 0;
    });
  }

  calculatePercentRow(item) {
    const amount =
      this.toNumber(item?.amount) ||
      (this.toNumber(item?.qty) * this.toNumber(item?.rate)) ||
      this.toNumber(item?.auctionAmount) ||
      0;

    const percent =
      this.toNumber(item?.percent) ||
      this.toNumber(item?.percentage) ||
      this.toNumber(item?.billPercent) ||
      1.5;

    const billAmount = amount * (percent / 100);

    return { amount, percent, billAmount };
  }

  calculateStandardRow(item) {
    const qty = this.toNumber(item?.qty) || 1;
    const rate = this.toNumber(item?.rate) || this.toNumber(item?.amount);
    const amount = this.toNumber(item?.amount) || qty * rate;
    const tax = this.toNumber(item?.tax) || 0;
    const total = this.toNumber(item?.total) || amount + tax;

    return { qty, rate, amount, total };
  }

  calculateGrandTotal() {
    const items = this.getItems();
    if (!items.length) {
      const invoiceTotal = this.toNumber(this.invoice.grandTotal);
      return invoiceTotal > 0 ? invoiceTotal : 0;
    }

    if (this.shouldUsePercentMode()) {
      const total = items.reduce((sum, item) => sum + this.calculatePercentRow(item).billAmount, 0);
      return this.toNumber(this.invoice.grandTotal) > 0 ? this.toNumber(this.invoice.grandTotal) || total : total;
    }

    const subtotal = items.reduce((sum, item) => {
      const row = this.calculateStandardRow(item);
      return sum + row.amount;
    }, 0);

    const cgst = this.toNumber(this.invoice.cgst);
    const sgst = this.toNumber(this.invoice.sgst);
    const grandTotal = this.toNumber(this.invoice.grandTotal);

    if (grandTotal > 0) return grandTotal;
    if (cgst > 0 || sgst > 0) return subtotal + cgst + sgst;
    return items.reduce((sum, item) => sum + this.calculateStandardRow(item).total, 0);
  }

  addWatermark() {
    const company = this.getCompanyName();

    this.doc.setTextColor(235, 235, 235);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(32);

    const textWidth = this.doc.getTextWidth(company);
    const x = (this.pageWidth - textWidth) / 2;
    const y = this.pageHeight / 2 + 8;

    this.addText(company, x, y, { angle: 35 });
    this.doc.setTextColor(...this.colors.black);
  }

  addHeader(y) {
    const companyName = this.getCompanyName();
    const companyAddress =
      this.safeString(this.invoice.billedByAddress) ||
      this.safeString(this.invoice.address) ||
      'Pune';

    const gst =
      this.safeString(this.invoice.gstin) ||
      this.safeString(this.invoice.billedByGstin) ||
      '';

    const phone =
      this.safeString(this.invoice.billedByMobile) ||
      this.safeString(this.invoice.phone) ||
      '';

    const email = this.safeString(this.invoice.billedByEmail) || '';

    const logo = this.invoice.companyLogo;

    if (logo) {
      try {
        this.doc.addImage(logo, 'PNG', this.margin, y, 24, 24);
      } catch (error) {
        console.warn('Failed to add company logo:', error);
      }
    }

    const leftX = logo ? this.margin + 30 : this.margin;
    const centerX = 78;
    const boxX = this.pageWidth - this.margin - 66;
    const boxY = y - 1;
    const boxW = 66;
    const boxH = 34;

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(18);
    this.doc.setTextColor(...this.colors.black);
    this.addText(companyName, leftX, y + 8);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...this.colors.gray);
    this.addText('Property & Legal Services', leftX, y + 14);

    const centerBlockX = centerX;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.indigoDark);
    this.addText('Professional Invoice & Recovery Services', centerBlockX, y + 8);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.gray);
    const centerLines = this.doc.splitTextToSize(companyAddress, 65);
    centerLines.slice(0, 2).forEach((line, index) => {
      this.addText(line, centerBlockX, y + 13 + index * 4.2);
    });

    this.doc.setDrawColor(...this.colors.border);
    this.doc.setLineWidth(0.3);
    this.doc.rect(boxX, boxY, boxW, boxH);

    let contactY = boxY + 6;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(...this.colors.black);
    this.addText('Contact Details', boxX + 3, contactY);

    contactY += 5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    if (gst) {
      this.addText(`GST: ${gst}`, boxX + 3, contactY);
      contactY += 4.3;
    }
    if (phone) {
      this.addText(`Phone: ${phone}`, boxX + 3, contactY);
      contactY += 4.3;
    }
    if (email) {
      const emailText = this.doc.splitTextToSize(`Email: ${email}`, boxW - 6);
      this.addText(emailText[0] || `Email: ${email}`, boxX + 3, contactY);
    }

    y += 28;
    this.drawLine(this.margin, y, this.pageWidth - this.margin, y);
    return y + 7;
  }

  addTitleBar(y) {
    const barH = 11;

    this.doc.setFillColor(...this.colors.indigo);
    this.doc.rect(this.margin, y, this.contentWidth, barH, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.setTextColor(255, 255, 255);
    this.addText(
      this.invoice.isProForma ? 'PRO FORMA INVOICE' : 'TAX INVOICE',
      this.pageWidth / 2,
      y + 7.5,
      { align: 'center' }
    );

    this.doc.setTextColor(...this.colors.black);
    return y + barH + 5;
  }

  addInvoiceMeta(y) {
    y = this.ensureSpace(y, 18);

    const rightX = this.pageWidth - this.margin - 56;
    const invoiceNo = this.safeString(this.invoice.invoiceNo, 'INV-001');
    const invoiceDate = this.formatDate(this.invoice.invoiceDate);
    const dueDate = this.formatDate(this.invoice.dueDate);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.addText('Invoice No:', rightX, y);
    this.doc.setFont('helvetica', 'normal');
    this.addText(invoiceNo, rightX + 20, y);

    y += 6;

    this.doc.setFont('helvetica', 'bold');
    this.addText('Date:', rightX, y);
    this.doc.setFont('helvetica', 'normal');
    this.addText(invoiceDate, rightX + 20, y);

    y += 6;

    if (dueDate) {
      this.doc.setFont('helvetica', 'bold');
      this.addText('Due Date:', rightX, y);
      this.doc.setFont('helvetica', 'normal');
      this.addText(dueDate, rightX + 20, y);
      y += 6;
    }

    this.drawLine(this.margin, y, this.pageWidth - this.margin, y);
    return y + 6;
  }

  addClientBankSection(y) {
    y = this.ensureSpace(y, 28);

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(12);
    this.doc.setTextColor(...this.colors.black);
    this.addText('To,', this.margin, y);

    y += 5.5;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10.5);
    this.addText('The Branch Manager,', this.margin, y);
    y += 5.2;

    const bankName = this.getBankName();
    const branchName = this.getBranchName();

    if (bankName) {
      this.doc.setFont('helvetica', 'bold');
      this.addText(bankName, this.margin, y);
      y += 5.2;
    }

    if (branchName) {
      this.doc.setFont('helvetica', 'normal');
      this.addText(branchName, this.margin, y);
      y += 5.2;
    }

    const address =
      this.safeString(this.invoice.billedToAddress) ||
      this.safeString(this.invoice.selectedCustomer?.address) ||
      '';

    if (address && !bankName) {
      const lines = this.doc.splitTextToSize(address, this.contentWidth);
      this.doc.setFont('helvetica', 'normal');
      lines.slice(0, 2).forEach((line) => {
        this.addText(line, this.margin, y);
        y += 4.8;
      });
    }

    const customerName = this.getCustomerName();
    if (customerName) {
      y += 1.5;
      this.doc.setFillColor(...this.colors.paleYellow);
      this.doc.rect(this.margin, y, this.contentWidth, 9, 'F');

      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(10.5);
      this.addText(`Customer Name: ${customerName}`, this.margin + 3, y + 6.1);
      y += 11;
    }

    const mobile =
      this.safeString(this.invoice.billedToMobile) ||
      this.safeString(this.invoice.selectedCustomer?.contactPhone) ||
      this.safeString(this.invoice.selectedCustomer?.contactNumber) ||
      '';

    const email =
      this.safeString(this.invoice.billedToEmail) ||
      this.safeString(this.invoice.selectedCustomer?.email) ||
      '';

    const gstin =
      this.safeString(this.invoice.billedToGstin) ||
      this.safeString(this.invoice.selectedCustomer?.gstin) ||
      '';

    if (!bankName && (mobile || email || gstin)) {
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9.5);

      if (mobile) {
        this.addText(`Mobile: ${mobile}`, this.margin, y);
        y += 4.8;
      }
      if (email) {
        this.addText(`Email: ${email}`, this.margin, y);
        y += 4.8;
      }
      if (gstin) {
        this.addText(`GSTIN: ${gstin}`, this.margin, y);
        y += 4.8;
      }
    }

    return y + 2;
  }

  addSubjectSection(y) {
    const subject = this.safeString(
      this.invoice.subject ||
        this.invoice.invoiceSubject ||
        'Bill For Property Sale'
    );

    const auctionDate =
      this.invoice.auctionDate ||
      this.invoice.subjectDate ||
      this.invoice.dealDate ||
      this.invoice.invoiceDate ||
      null;

    const auctionAmount =
      this.toNumber(this.invoice.auctionAmount) ||
      this.toNumber(this.invoice.subjectAmount) ||
      this.toNumber(this.invoice.amount) ||
      0;

    const hasContent = subject || auctionAmount > 0 || auctionDate;

    if (!hasContent) return y;

    y = this.ensureSpace(y, 22);

    this.drawLine(this.margin, y, this.pageWidth - this.margin, y);
    y += 5;

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10.5);
    this.addText(`Sub: ${subject}`, this.margin, y);
    y += 5.2;

    if (auctionDate) {
      this.doc.setFont('helvetica', 'normal');
      this.addText(`Auction Date: ${this.formatDate(auctionDate)}`, this.margin, y);
      y += 4.8;
    }

    if (auctionAmount > 0) {
      this.doc.setFont('helvetica', 'bold');
      this.addText(`Auction Amount: ${this.formatCurrency(auctionAmount)}`, this.margin, y);
      y += 4.8;
    }

    return y + 2;
  }

  addItemsTable(y) {
    const items = this.getItems();
    if (!items.length) return y + 5;

    y = this.ensureSpace(y, 30);

    const percentMode = this.shouldUsePercentMode();

    if (percentMode) {
      const body = items.map((item, index) => {
        const row = this.calculatePercentRow(item);
        const particular = this.safeString(
          item?.name ||
            item?.productName ||
            item?.title ||
            'Professional Fees'
        );

        return [
          String(index + 1),
          particular,
          this.formatCurrency(row.amount),
          `${Number(row.percent).toFixed(1)}%`,
          this.formatCurrency(row.billAmount),
        ];
      });

      autoTable(this.doc, {
        startY: y,
        head: [['Sr No', 'Particular', 'Amount', '%', 'Bill Amt']],
        body,
        theme: 'grid',
        styles: {
          fontSize: 9,
          cellPadding: 3.2,
          valign: 'middle',
          lineColor: [180, 180, 180],
          lineWidth: 0.2,
        },
        headStyles: {
          fillColor: [255, 204, 0],
          textColor: 0,
          fontStyle: 'bold',
        },
        columnStyles: {
          0: { halign: 'center', cellWidth: 16 },
          1: { halign: 'left', cellWidth: 86 },
          2: { halign: 'right', cellWidth: 30 },
          3: { halign: 'center', cellWidth: 20 },
          4: { halign: 'right', cellWidth: 30 },
        },
        margin: { left: this.margin, right: this.margin },
      });

      return this.doc.lastAutoTable.finalY + 8;
    }

    const body = items.map((item, index) => {
      const row = this.calculateStandardRow(item);
      const particular = this.safeString(
        item?.name ||
          item?.productName ||
          item?.title ||
          item?.description ||
          'Item'
      );

      return [
        String(index + 1),
        particular,
        String(row.qty),
        this.formatCurrency(row.rate),
        this.formatCurrency(row.amount),
        this.formatCurrency(row.total),
      ];
    });

    autoTable(this.doc, {
      startY: y,
      head: [['Sr No', 'Particular', 'Qty', 'Rate', 'Amount', 'Total']],
      body,
      theme: 'grid',
      styles: {
        fontSize: 9,
        cellPadding: 3.2,
        valign: 'middle',
        lineColor: [180, 180, 180],
        lineWidth: 0.2,
      },
      headStyles: {
        fillColor: [255, 204, 0],
        textColor: 0,
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 14 },
        1: { halign: 'left', cellWidth: 72 },
        2: { halign: 'center', cellWidth: 16 },
        3: { halign: 'right', cellWidth: 28 },
        4: { halign: 'right', cellWidth: 30 },
        5: { halign: 'right', cellWidth: 30 },
      },
      margin: { left: this.margin, right: this.margin },
    });

    return this.doc.lastAutoTable.finalY + 8;
  }

  addTotalSection(y) {
    const items = this.getItems();
    const total = this.calculateGrandTotal();

    y = this.ensureSpace(y, 28);

    const boxW = 92;
    const boxH = 19;
    const boxX = this.pageWidth - this.margin - boxW;
    const boxY = y;

    this.doc.setDrawColor(...this.colors.black);
    this.doc.setLineWidth(0.5);
    this.doc.rect(boxX, boxY, boxW, boxH);

    this.doc.setFillColor(...this.colors.paleYellow);
    this.doc.rect(boxX, boxY, boxW, boxH, 'F');

    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(10);
    this.doc.setTextColor(...this.colors.black);
    this.addText('TOTAL INVOICE AMOUNT', boxX + 3, boxY + 6.8);

    this.doc.setFontSize(11);
    this.addText(this.formatCurrency(total), boxX + boxW - 3, boxY + 6.8, {
      align: 'right',
    });

    y += 22;

    const subtotal = this.toNumber(this.invoice.subtotal);
    const cgst = this.toNumber(this.invoice.cgst);
    const sgst = this.toNumber(this.invoice.sgst);

    if (subtotal > 0 || cgst > 0 || sgst > 0 || items.length > 0) {
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9.5);
      this.addText('TOTAL AMOUNT IN WORDS:', this.margin, y);
      y += 5;

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(9);
      const words = this.numberToWords(total);
      const wordLines = this.doc.splitTextToSize(words, this.contentWidth);
      wordLines.forEach((line) => {
        this.addText(line, this.margin, y);
        y += 4.6;
      });
    }

    return y + 2;
  }

  addBankDetailsSection(y) {
    const hasBankDetails =
      this.invoice.accountName ||
      this.invoice.accountNumber ||
      this.invoice.ifsc ||
      this.invoice.bank ||
      this.invoice.accountType ||
      this.invoice.upiId;

    if (!hasBankDetails) return y;

    y = this.ensureSpace(y, 34);
    y = this.addSectionHeader('Bank Details', y);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9.5);

    if (this.invoice.accountName) {
      y = this.addKeyValue('Account Name', this.invoice.accountName, this.margin, y, 34, this.contentWidth - 34);
    }
    if (this.invoice.accountNumber) {
      y = this.addKeyValue('Account Number', this.invoice.accountNumber, this.margin, y, 34, this.contentWidth - 34);
    }
    if (this.invoice.ifsc) {
      y = this.addKeyValue('IFSC Code', this.invoice.ifsc, this.margin, y, 34, this.contentWidth - 34);
    }
    if (this.invoice.bank) {
      y = this.addKeyValue('Bank Name', this.invoice.bank, this.margin, y, 34, this.contentWidth - 34);
    }
    if (this.invoice.accountType) {
      y = this.addKeyValue('Account Type', this.invoice.accountType, this.margin, y, 34, this.contentWidth - 34);
    }
    if (this.invoice.upiId) {
      y = this.addKeyValue('UPI ID', this.invoice.upiId, this.margin, y, 34, this.contentWidth - 34);
    }

    return y + 2;
  }

  addTermsSection(y) {
    const customTerms = this.safeString(this.invoice.terms);
    const defaultTerms = [
      'GST on reverse charge basis as applicable',
      'This is computer generated invoice',
      'Subject to jurisdiction of courts in [City]',
    ];

    const lines = customTerms
      ? customTerms
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
      : defaultTerms;

    if (!lines.length) return y;

    y = this.ensureSpace(y, 24);
    y = this.addSectionHeader('Terms & Conditions', y);

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(9);

    lines.forEach((line) => {
      y = this.ensureSpace(y, 5);
      this.addText(`• ${line}`, this.margin, y);
      y += 4.6;
    });

    return y + 2;
  }

  addSignatureSection(y) {
    const signature = this.invoice.signature;
    if (!signature) return y;

    y = this.ensureSpace(y, 24);
    y = this.addSectionHeader('Authorized Signatory', y);

    try {
      const sigW = 42;
      const sigH = 16;
      const sigX = this.pageWidth - this.margin - sigW;

      this.doc.addImage(signature, 'PNG', sigX, y, sigW, sigH);

      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8.5);
      this.doc.setTextColor(80, 80, 80);
      this.addText('Authorized Signatory', sigX, y + sigH + 4.5, {
        align: 'left',
      });

      this.doc.setTextColor(...this.colors.black);
      return y + sigH + 8;
    } catch (error) {
      console.warn('Failed to add signature to PDF:', error);
      this.doc.setFont('helvetica', 'italic');
      this.doc.setFontSize(9);
      this.doc.setTextColor(120, 120, 120);
      this.addText('[Signature]', this.pageWidth - this.margin - 25, y + 6, {
        align: 'left',
      });
      this.doc.setTextColor(...this.colors.black);
      return y + 12;
    }
  }

  addFooter() {
    const footerY = this.pageHeight - 8;
    this.doc.setFont('helvetica', 'italic');
    this.doc.setFontSize(8);
    this.doc.setTextColor(140, 140, 140);
    this.addText(
      'This is a computer generated invoice and does not require signature',
      this.pageWidth / 2,
      footerY,
      { align: 'center' }
    );
    this.doc.setTextColor(...this.colors.black);
  }

  async generatePdf() {
    this.addWatermark();

    let y = this.margin;

    y = this.addHeader(y);
    y = this.addTitleBar(y);
    y = this.addInvoiceMeta(y);
    y = this.addClientBankSection(y);
    y = this.addSubjectSection(y);
    y = this.addItemsTable(y);
    y = this.addTotalSection(y);
    y = this.addBankDetailsSection(y);
    y = this.addTermsSection(y);
    y = this.addSignatureSection(y);

    this.addFooter();

    return this.doc.output('blob');
  }
}

export async function generateInvoicePdf(invoice) {
  const generator = new InvoicePdfGenerator(invoice);
  return await generator.generatePdf();
}

export default generateInvoicePdf;
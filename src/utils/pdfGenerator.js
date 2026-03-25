import jsPDF from 'jspdf';

import 'jspdf-autotable';



export class InvoicePdfGenerator {

  constructor(invoice) {

    this.invoice = invoice;

    this.doc = new jsPDF();

    this.pageWidth = this.doc.internal.pageSize.getWidth();

    this.pageHeight = this.doc.internal.pageSize.getHeight();

    this.margin = 20;

    this.contentWidth = this.pageWidth - 2 * this.margin;

  }



  // Helper function to format currency

  formatCurrency(amount) {

    return new Intl.NumberFormat('en-IN', {

      style: 'currency',

      currency: 'INR'

    }).format(amount);

  }



  // Helper function to format date

  formatDate(date) {

    return new Intl.DateTimeFormat('en-IN', {

      day: 'numeric',

      month: 'short',

      year: 'numeric'

    }).format(new Date(date));

  }



  // Add text with proper formatting

  addText(text, x, y, options = {}) {

    this.doc.text(text, x, y, options);

  }



  // Add section header

  addSectionHeader(title, y) {

    this.doc.setFontSize(16);

    this.doc.setFont('helvetica', 'bold');

    this.doc.setTextColor(99, 102, 241); // Indigo color

    this.addText(title, this.margin, y);

    this.doc.setTextColor(0, 0, 0); // Reset to black

    this.doc.setFont('helvetica', 'normal');

    return y + 10;

  }



  // Add key-value pairs

  addKeyValue(key, value, x, y, keyWidth = 60) {

    this.doc.setFont('helvetica', 'bold');

    this.addText(key, x, y);

    this.doc.setFont('helvetica', 'normal');

    this.addText(value, x + keyWidth, y);

    return y + 7;

  }



  // Generate PDF

  async generatePdf() {

    let currentY = this.margin;



    // Header Section

    currentY = this.addHeader(currentY);



    // Billed By and Billed To

    currentY = this.addBillingSection(currentY);



    // Items Table

    currentY = this.addItemsTable(currentY);



    // Total Section

    currentY = this.addTotalSection(currentY);



    // Bank Details and UPI

    currentY = this.addPaymentSection(currentY);



    // Terms and Conditions

    currentY = this.addTermsSection(currentY);



    // Signature

    currentY = this.addSignatureSection(currentY);



    // Footer

    this.addFooter();



    return this.doc.output('blob');

  }



  addHeader(y) {

    // Title

    this.doc.setFontSize(20);

    this.doc.setFont('helvetica', 'bold');

    this.doc.setTextColor(0, 0, 0); // Black text

    this.addText(this.invoice.isProForma ? 'PRO FORMA INVOICE' : 'INVOICE', this.margin, y);

    

    // Invoice details

    y += 12;

    this.doc.setFontSize(10);

    this.doc.setFont('helvetica', 'normal');

    

    y = this.addKeyValue('Invoice No:', this.invoice.invoiceNo, this.margin, y, 35);

    y = this.addKeyValue('Date:', this.formatDate(this.invoice.invoiceDate), this.margin, y, 35);

    y = this.addKeyValue('Due Date:', this.formatDate(this.invoice.dueDate), this.margin, y, 35);

    

    // Add company logo if available

    if (this.invoice.companyLogo) {

      try {

        // Add logo on the right side

        const logoX = this.pageWidth - this.margin - 60;

        const logoY = y - 25;

        this.doc.addImage(this.invoice.companyLogo, 'PNG', logoX, logoY, 50, 30);

      } catch (error) {

        console.warn('Failed to add logo to PDF:', error);

      }

    }

    

    return y + 40;

  }



  addBillingSection(y) {

    // Check if we need a new page

    if (y > this.pageHeight - 80) {

      this.doc.addPage();

      y = this.margin;

    }



    const columnWidth = this.contentWidth / 2 - 10;



    // Billed By

    this.addSectionHeader('Billed By', y);

    y += 10;

    

    this.doc.setFontSize(11);

    y = this.addKeyValue('Name', this.invoice.billedByName, this.margin, y);

    

    if (this.invoice.billedByAddress) {

      const lines = this.doc.splitTextToSize(this.invoice.billedByAddress, columnWidth - 10);

      lines.forEach(line => {

        this.addText(line, this.margin + 60, y);

        y += 5;

      });

    }



    if (this.invoice.gstin) {

      y = this.addKeyValue('GSTIN', this.invoice.gstin, this.margin, y);

    }

    if (this.invoice.pan) {

      y = this.addKeyValue('PAN', this.invoice.pan, this.margin, y);

    }

    if (this.invoice.billedByEmail) {

      y = this.addKeyValue('Email', this.invoice.billedByEmail, this.margin, y);

    }



    // Billed To (right column)

    const billedToY = y - (this.invoice.billedByAddress ? 15 : 0);

    this.addSectionHeader('Billed To', billedToY);

    

    let billedToYCurrent = billedToY + 10;

    const billedToX = this.margin + columnWidth + 20;

    

    this.doc.setFontSize(11);

    billedToYCurrent = this.addKeyValue('Name', this.invoice.billedToName, billedToX, billedToYCurrent);

    

    if (this.invoice.billedToAddress) {

      const lines = this.doc.splitTextToSize(this.invoice.billedToAddress, columnWidth - 10);

      lines.forEach(line => {

        this.addText(line, billedToX + 60, billedToYCurrent);

        billedToYCurrent += 5;

      });

    }



    if (this.invoice.billedToGstin) {

      billedToYCurrent = this.addKeyValue('GSTIN', this.invoice.billedToGstin, billedToX, billedToYCurrent);

    }

    if (this.invoice.billedToMobile) {

      billedToYCurrent = this.addKeyValue('Mobile', this.invoice.billedToMobile, billedToX, billedToYCurrent);

    }

    if (this.invoice.billedToEmail) {

      billedToYCurrent = this.addKeyValue('Email', this.invoice.billedToEmail, billedToX, billedToYCurrent);

    }



    return Math.max(y, billedToYCurrent) + 15;

  }



  addItemsTable(y) {

    if (!this.invoice.items || this.invoice.items.length === 0) {

      return y + 20;

    }



    // Check if we need a new page

    if (y > this.pageHeight - 100) {

      this.doc.addPage();

      y = this.margin;

    }



    // Table headers

    const headers = this.invoice.includeGst 

      ? ['#', 'Item', 'GST Rate', 'Qty', 'Rate', 'Amount', 'CGST', 'SGST', 'Total']

      : ['#', 'Item', 'Qty', 'Rate', 'Amount', 'Total'];



    const columnWidths = this.invoice.includeGst

      ? [15, 60, 25, 25, 30, 30, 25, 25, 30]

      : [15, 80, 25, 30, 30, 30];



    // Add table with autoTable

    this.doc.autoTable({

      head: [headers],

      body: this.invoice.items.map((item, index) => {

        const amount = item.qty * item.rate;

        const cgst = this.invoice.includeGst ? amount * 0.09 : 0;

        const sgst = this.invoice.includeGst ? amount * 0.09 : 0;

        const total = amount + cgst + sgst;



        return this.invoice.includeGst

          ? [

              index + 1,

              item.name,

              '18%',

              item.qty % 1 === 0 ? item.qty.toString() : item.qty.toString(),

              this.formatCurrency(item.rate),

              this.formatCurrency(amount),

              this.formatCurrency(cgst),

              this.formatCurrency(sgst),

              this.formatCurrency(total)

            ]

          : [

              index + 1,

              item.name,

              item.qty % 1 === 0 ? item.qty.toString() : item.qty.toString(),

              this.formatCurrency(item.rate),

              this.formatCurrency(amount),

              this.formatCurrency(amount)

            ];

      }),

      startY: y,

      theme: 'grid',

      styles: {

        fontSize: 10,

        cellPadding: 3,

      },

      headStyles: {

        fillColor: [99, 102, 241],

        textColor: 255,

        fontStyle: 'bold',

      },

      columnStyles: columnWidths.reduce((acc, width, index) => {

        acc[index] = { cellWidth: width };

        return acc;

      }, {}),

      margin: { left: this.margin, right: this.margin }

    });



    return this.doc.lastAutoTable.finalY + 10;

  }



  addTotalSection(y) {

    if (!this.invoice.items || this.invoice.items.length === 0) {

      return y + 20;

    }



    // Check if we need a new page

    if (y > this.pageHeight - 60) {

      this.doc.addPage();

      y = this.margin;

    }



    // Total amount box (right aligned)

    const totalBoxX = this.pageWidth - 150;

    const totalBoxY = y - 5;

    const totalBoxWidth = 130;

    const totalBoxHeight = 25;



    this.doc.setDrawColor(0);

    this.doc.setLineWidth(1);

    this.doc.line(totalBoxX, totalBoxY + totalBoxHeight, totalBoxX + totalBoxWidth, totalBoxY + totalBoxHeight);



    this.doc.setFont('helvetica', 'bold');

    this.addText('Total (INR)', totalBoxX, totalBoxY + 15);

    this.addText(this.formatCurrency(this.invoice.grandTotal), totalBoxX + 70, totalBoxY + 15);



    return y + 30;

  }



  addPaymentSection(y) {

    // Check if we need a new page

    if (y > this.pageHeight - 80) {

      this.doc.addPage();

      y = this.margin;

    }



    const columnWidth = this.contentWidth / 2 - 10;



    // Bank Details

    y = this.addSectionHeader('Bank Details', y);

    y += 5;

    

    this.doc.setFontSize(10);

    if (this.invoice.accountName) {

      y = this.addKeyValue('Account Name', this.invoice.accountName, this.margin, y, 70);

    }

    if (this.invoice.accountNumber) {

      y = this.addKeyValue('Account Number', this.invoice.accountNumber, this.margin, y, 70);

    }

    if (this.invoice.ifsc) {

      y = this.addKeyValue('IFSC', this.invoice.ifsc, this.margin, y, 70);

    }

    if (this.invoice.accountType) {

      y = this.addKeyValue('Account Type', this.invoice.accountType, this.margin, y, 70);

    }

    if (this.invoice.bank) {

      y = this.addKeyValue('Bank', this.invoice.bank, this.margin, y, 70);

    }



    // UPI QR Code placeholder

    if (this.invoice.upiId) {

      const upiX = this.margin + columnWidth + 20;

      this.addSectionHeader('UPI - Scan to Pay', y - 25);

      

      // QR Code placeholder

      this.doc.setFillColor(240, 240, 240);

      this.doc.rect(upiX, y - 15, 40, 40, 'F');

      this.doc.setFontSize(8);

      this.doc.setTextColor(128, 128, 128);

      this.addText('QR Code', upiX + 10, y);

      

      this.doc.setTextColor(0, 0, 0);

      this.doc.setFontSize(9);

      this.addText('UPI ID: ' + this.invoice.upiId, upiX, y + 35);

      this.addText('Max ₹1,00,000 via UPI', upiX, y + 42);

    }



    return y + 50;

  }



  addTermsSection(y) {

    if (!this.invoice.terms) {

      return y + 20;

    }



    // Check if we need a new page

    if (y > this.pageHeight - 60) {

      this.doc.addPage();

      y = this.margin;

    }



    y = this.addSectionHeader('Terms and Conditions', y);

    y += 5;



    this.doc.setFontSize(10);

    this.doc.setFont('helvetica', 'normal');

    

    const lines = this.invoice.terms.split('\n').filter(line => line.trim());

    lines.forEach(line => {

      if (y > this.pageHeight - 30) {

        this.doc.addPage();

        y = this.margin;

      }

      this.addText('• ' + line.trim(), this.margin, y);

      y += 6;

    });



    return y + 20;

  }



  addSignatureSection(y) {

    if (!this.invoice.signature) {

      return y + 20;

    }



    // Check if we need a new page

    if (y > this.pageHeight - 80) {

      this.doc.addPage();

      y = this.margin;

    }



    y = this.addSectionHeader('Authorized Signature', y);

    y += 10;



    try {

      // Add signature image

      const signatureX = (this.pageWidth - 120) / 2; // Center the signature

      this.doc.addImage(this.invoice.signature, 'PNG', signatureX, y, 120, 60);

    } catch (error) {

      console.warn('Failed to add signature to PDF:', error);

      // Fallback text

      this.doc.setFontSize(10);

      this.doc.setTextColor(128, 128, 128);

      this.addText('[Signature]', signatureX, y + 20, { align: 'center' });

    }



    return y + 80;

  }



  addFooter() {

    const footerY = this.pageHeight - 20;

    this.doc.setFontSize(10);

    this.doc.setFont('helvetica', 'italic');

    this.doc.setTextColor(128, 128, 128);

    this.addText(

      'This is an electronically generated document, no signature is required.',

      this.pageWidth / 2,

      footerY,

      { align: 'center' }

    );

  }

}



// Main function to generate PDF

export async function generateInvoicePdf(invoice) {

  const generator = new InvoicePdfGenerator(invoice);

  return await generator.generatePdf();

}



export default generateInvoicePdf;


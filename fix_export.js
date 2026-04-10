const fs = require('fs');
const content = fs.readFileSync('src/app/customers/page.js', 'utf8');

const startMarker = 'handleExportData = () => {';
const endMarker = '  const handleDelete = async (id) => {';

const si = content.indexOf(startMarker);
const ei = content.indexOf(endMarker);

if (si === -1 || ei === -1) {
  console.log('Markers not found. si=' + si + ' ei=' + ei);
  process.exit(1);
}

const newFn = `handleExportData = () => {
    if (!flatRows.length) { addToast('No data to export', 'error'); return; }

    const headers = [
      'Deal ID', 'Customer Name', 'Email', 'Phone',
      'Contact Person', 'Contact Number',
      'Primary Address', 'City', 'State', 'Pincode',
      'Bank', 'Branch', 'Taluka', 'District',
      'Deal Stage', 'Department', 'Deal Value',
      'Products', 'Closing Date', 'Owner',
      'Created At', 'Updated At',
    ];

    const rows = flatRows.map(({ customer, deal }) => {
      // Deal ID (dealCode like PPE1 or #id)
      const dealId = deal?.dealCode
        ? deal.dealCode
        : deal?.id ? String(deal.id) : '';

      // Bank details
      const bankObj = deal?.bankId ? banks.find(b => Number(b.id) === Number(deal.bankId)) : null;
      const bankName = deal?.bankName || deal?.relatedBankName || bankObj?.name || '';
      const branchName = deal?.branchName || bankObj?.branchName || '';
      const taluka = bankObj?.taluka || '';
      const district = bankObj?.district || '';

      // Primary address
      const primaryAddr = customer.addresses?.find(a => a.addressType === 'PRIMARY') || customer.addresses?.[0];
      const addressLine = primaryAddr?.addressLine || '';
      const city = primaryAddr?.city || '';
      const state = primaryAddr?.state || '';
      const pincode = primaryAddr?.pincode || '';

      // Stage display name
      const dept = (deal?.department || '').trim();
      const stageCode = (deal?.stageCode || '').toUpperCase();
      const stageStages = getStagesForDepartment(dept) || [];
      const stageObj = stageStages.find(s => s.stageCode === stageCode);
      const stageName = stageObj?.stageName || stageCode;

      // Products — joined with comma
      const products = (deal?.dealProducts || [])
        .map(dp => dp.product?.name || dp.productName || '')
        .filter(Boolean)
        .join(', ');

      // Deal value
      const dealValue = deal?.valueAmount ? String(deal.valueAmount) : '';

      // Closing date
      const closingDate = deal?.closingDate
        ? new Date(deal.closingDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

      // Owner
      const owner = customer.ownerName || '';

      // Dates
      const createdAt = customer.createdAt
        ? new Date(customer.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';
      const updatedAt = customer.updatedAt
        ? new Date(customer.updatedAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
        : '';

      return [
        dealId,
        customer.name ?? '',
        customer.email ?? '',
        customer.contactPhone ?? '',
        customer.contactName ?? '',
        customer.contactNumber ?? '',
        addressLine,
        city,
        state,
        pincode,
        bankName,
        branchName,
        taluka,
        district,
        stageName,
        dept,
        dealValue,
        products,
        closingDate,
        owner,
        createdAt,
        updatedAt,
      ];
    });

    const csv = [headers, ...rows]
      .map(r => r.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(','))
      .join('\\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'customers-export-' + new Date().toISOString().slice(0, 10) + '.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    addToast('Exported ' + flatRows.length + ' records', 'success');
  };

  `;

const newContent = content.slice(0, si) + newFn + content.slice(ei);
fs.writeFileSync('src/app/customers/page.js', newContent, 'utf8');
console.log('Done. Replaced chars ' + si + ' to ' + ei);

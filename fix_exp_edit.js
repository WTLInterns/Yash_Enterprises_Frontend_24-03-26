const fs = require('fs');
let c = fs.readFileSync('src/app/expenses/page.js', 'utf8');

const endMarker = '  }, [showFormModal, editExpense?.id, editExpense?.clientId, editExpense?.clientName, clients, selectedClientId]); // eslint-disable-line';
const ei = c.indexOf(endMarker);
if (ei === -1) { console.log('end not found'); process.exit(1); }

// Find the useEffect that contains this dep array
const si = c.lastIndexOf('useEffect(() => {', ei);
console.log('si=', si, 'ei=', ei);
console.log('block:', JSON.stringify(c.slice(si, si + 60)));

const newEffect = `useEffect(() => {\r\n    if (!showFormModal) return;\r\n\r\n    if (!editExpense) {\r\n      setSelectedClientId('');\r\n      setClientProducts([]);\r\n      setClientDealId(null);\r\n      return;\r\n    }\r\n\r\n    // Wait until clients list is loaded before trying to match\r\n    if (clients.length === 0) return;\r\n\r\n    const normalizedClientName = String(editExpense.clientName || '').trim().toLowerCase();\r\n    let resolvedClientId = editExpense?.clientId ? String(editExpense.clientId) : '';\r\n\r\n    // Fallback: match by clientName when clientId is missing (legacy rows)\r\n    if (!resolvedClientId && normalizedClientName) {\r\n      const matchedClient = clients.find((cl) =>\r\n        getClientDisplayName(cl).trim().toLowerCase() === normalizedClientName\r\n      );\r\n      const matchedId = getClientIdValue(matchedClient);\r\n      if (matchedId) resolvedClientId = matchedId;\r\n    }\r\n\r\n    if (resolvedClientId) {\r\n      setSelectedClientId(resolvedClientId);\r\n      handleClientChange(resolvedClientId);\r\n    } else if (normalizedClientName) {\r\n      // Legacy: clientName only, no clientId match — show name in dropdown\r\n      setSelectedClientId(\`legacy:\${editExpense.clientName}\`);\r\n      setClientProducts([]);\r\n      setClientDealId(null);\r\n    } else {\r\n      setSelectedClientId('');\r\n      setClientProducts([]);\r\n      setClientDealId(null);\r\n    }\r\n  // eslint-disable-next-line react-hooks/exhaustive-deps\r\n  }, [showFormModal, editExpense?.id, editExpense?.clientId, editExpense?.clientName, clients.length]);`;

c = c.slice(0, si) + newEffect + c.slice(ei + endMarker.length);
fs.writeFileSync('src/app/expenses/page.js', c, 'utf8');
console.log('✅ Done');

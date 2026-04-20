const fs = require('fs');
let c = fs.readFileSync('src/app/customers/[id]/page.js', 'utf8');

// Fix fetchExpenses — always use Number(customerId) as primary, not deal?.clientId
// deal?.clientId can be null if deal hasn't loaded yet, causing missed expenses
const old = `  async function fetchExpenses(clientIdOverride) {\r\n    try {\r\n      const cid = clientIdOverride ?? deal?.clientId ?? customerId;\r\n      if (!cid) return;\r\n      const res = await backendApi.get(\`/expenses?clientId=\${cid}\`);\r\n      setExpenses(Array.isArray(res) ? res : []);\r\n    } catch (e) {\r\n      console.error(\"Expense fetch failed\", e);\r\n      setExpenses([]);\r\n    }\r\n  }`;

const neu = `  async function fetchExpenses(clientIdOverride) {\r\n    try {\r\n      // Always use Number(customerId) — deal?.clientId may be null on first load\r\n      const cid = Number(clientIdOverride ?? customerId);\r\n      if (!cid) return;\r\n      const res = await backendApi.get(\`/expenses?clientId=\${cid}\`);\r\n      setExpenses(Array.isArray(res) ? res : []);\r\n    } catch (e) {\r\n      console.error(\"Expense fetch failed\", e);\r\n      setExpenses([]);\r\n    }\r\n  }`;

if (c.includes(old)) {
  c = c.replace(old, neu);
  console.log('✅ fetchExpenses fixed');
} else {
  console.log('❌ not found');
}

// Also fix the expense save — after saving, refresh expenses
const oldAfterSave = `setExpenseForm({ employeeId: \"\", amount: \"\", category: \"\", description: \"\", expenseDate: new Date().toISOString().split('T')[0], status: \"PENDING\" });\r\n                              setExpenseFilePreview(null);\r\n                              setExpenseFile(null);\r\n                              setEditingExpenseId(null);`;

const neuAfterSave = `setExpenseForm({ employeeId: \"\", amount: \"\", category: \"\", description: \"\", expenseDate: new Date().toISOString().split('T')[0], status: \"PENDING\" });\r\n                              setExpenseFilePreview(null);\r\n                              setExpenseFile(null);\r\n                              setEditingExpenseId(null);\r\n                              await fetchExpenses(Number(customerId));`;

if (c.includes(oldAfterSave)) {
  c = c.replace(oldAfterSave, neuAfterSave);
  console.log('✅ expense save refresh fixed');
} else {
  console.log('❌ expense save refresh not found');
}

fs.writeFileSync('src/app/customers/[id]/page.js', c, 'utf8');
console.log('Done');

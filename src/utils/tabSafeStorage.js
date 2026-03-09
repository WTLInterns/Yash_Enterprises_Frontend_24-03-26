// Tab-safe storage utility to prevent cross-tab session conflicts

export const generateTabId = () => {
  // Generate a unique tab ID using timestamp and random number
  return `tab_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const getTabId = () => {
  if (typeof window === 'undefined') return null;
  
  let tabId = sessionStorage.getItem('tab_id');
  if (!tabId) {
    tabId = generateTabId();
    sessionStorage.setItem('tab_id', tabId);
    console.log(`🆔 NEW TAB CREATED: ${tabId}`);
  }
  return tabId;
};

export const setTabSafeItem = (key, value) => {
  if (typeof window === 'undefined') return;
  
  const tabId = getTabId();
  const tabKey = `${key}_${tabId}`;
  
  // ONLY store in sessionStorage (tab-specific) - NO localStorage fallback
  sessionStorage.setItem(tabKey, value);
  
  console.log(`💾 TAB ${tabId}: Stored ${key}`);
};

export const getTabSafeItem = (key) => {
  if (typeof window === 'undefined') return null;
  
  const tabId = getTabId();
  const tabKey = `${key}_${tabId}`;
  
  // ONLY get from sessionStorage (tab-specific) - NO localStorage fallback
  const value = sessionStorage.getItem(tabKey);
  
  console.log(`📖 TAB ${tabId}: Retrieved ${key} = ${value ? '✓' : '✗'}`);
  return value;
};

export const removeTabSafeItem = (key) => {
  if (typeof window === 'undefined') return;
  
  const tabId = getTabId();
  const tabKey = `${key}_${tabId}`;
  
  // ONLY remove from sessionStorage (tab-specific) - NO localStorage cleanup
  sessionStorage.removeItem(tabKey);
};

export const clearTabData = () => {
  if (typeof window === 'undefined') return;
  
  const tabId = getTabId();
  const keys = ['auth_token', 'user_role', 'user_data', 'employee_id'];
  
  keys.forEach(key => {
    const tabKey = `${key}_${tabId}`;
    sessionStorage.removeItem(tabKey);
  });
  
  sessionStorage.removeItem('tab_id');
};

export const clearOldLocalStorage = () => {
  if (typeof window === 'undefined') return;
  
  // Clear old localStorage data to prevent conflicts
  const keys = ['auth_token', 'user_role', 'user_data', 'employee_id'];
  keys.forEach(key => {
    localStorage.removeItem(key);
  });
  
  console.log('🧹 Cleaned up old localStorage data');
};

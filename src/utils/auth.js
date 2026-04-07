// Independent auth utility - no imports from other modules
export function getLoggedInUser() {
  try {
    if (typeof window === 'undefined') return null;
    const s = sessionStorage.getItem('user_data');
    return s ? JSON.parse(s) : null;
  } catch (e) {
    return null;
  }
}

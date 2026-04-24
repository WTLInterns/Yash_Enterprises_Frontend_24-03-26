export function createApiClient({ baseUrl = "" } = {}) {

  function getUserData() {
    try {
      const raw = sessionStorage.getItem("user_data") || localStorage.getItem("user_data");
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }

  async function request(path, { method = "GET", body, customHeaders = {} } = {}) {
    const user = getUserData();

    const headers = {
      ...(body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      Accept: "application/json",
      ...(user?.id        ? { "X-User-Id":         String(user.id) }         : {}),
      ...(user?.role      ? { "X-User-Role":        user.role }               : {}),
      ...(user?.department? { "X-User-Department":  user.department }         : {}),
      ...customHeaders,
    };

    const res = await fetch(baseUrl + path, {
      method,
      headers,
      body: body instanceof FormData ? body : (body ? JSON.stringify(body) : undefined),
    });

    if (!res.ok) {
      const errorText = await res.text();
      const error = new Error(errorText || `HTTP ${res.status}`);
      error.status = res.status;
      if (res.status >= 500) console.error("Server Error:", res.status, errorText);
      throw error;
    }

    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  return {
    get:    (p)    => request(p),
    post:   (p, b) => request(p, { method: "POST",   body: b }),
    put:    (p, b) => request(p, { method: "PUT",    body: b }),
    delete: (p)    => request(p, { method: "DELETE" }),
  };
}

export const backendApi = createApiClient({ baseUrl: (process.env.NEXT_PUBLIC_BACKEND_URL || "https://api.yashrajent.com") + "/api" });

export function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

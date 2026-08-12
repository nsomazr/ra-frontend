/**
 * Shared API client for the field system.
 * Reads runtime config from /config.js (injected by the Node server).
 */
const AssessAPI = (() => {
  const cfg = () => window.ASSESS_CONFIG || {
    apiUrl: "https://api.assess.nileagi.com",
    apiBase: "https://api.assess.nileagi.com/api",
  };

  const TOKEN_KEY = "p10354-api-tokens";

  const tokens = {
    get() {
      try { return JSON.parse(localStorage.getItem(TOKEN_KEY)) || null; } catch { return null; }
    },
    set(value) {
      localStorage.setItem(TOKEN_KEY, JSON.stringify(value));
    },
    clear() {
      localStorage.removeItem(TOKEN_KEY);
    },
  };

  async function request(path, options = {}) {
    const headers = Object.assign({ Accept: "application/json" }, options.headers || {});
    if (options.body && !(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      if (typeof options.body !== "string") options.body = JSON.stringify(options.body);
    }
    const auth = tokens.get();
    if (auth?.access && !options.skipAuth) {
      headers.Authorization = `Bearer ${auth.access}`;
    }
    const res = await fetch(`${cfg().apiBase}${path}`, { ...options, headers });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = { detail: text }; }
    if (!res.ok) {
      const message = data?.detail || data?.non_field_errors?.[0] || `Request failed (${res.status})`;
      const err = new Error(typeof message === "string" ? message : JSON.stringify(message));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  return {
    config: cfg,
    tokens,
    health: () => request("/health/", { skipAuth: true }),
    login: (username, password) =>
      request("/auth/login/", { method: "POST", body: { username, password }, skipAuth: true }),
    me: () => request("/auth/me/"),
    changePassword: (payload) => request("/auth/change-password/", { method: "POST", body: payload }),
    framework: () => request("/framework/"),
    schools: (params = "") => request(`/schools/${params ? `?${params}` : ""}`),
    reports: (params = "") => request(`/reports/${params ? `?${params}` : ""}`),
    report: (id) => request(`/reports/${id}/`),
    saveReport: (id, body) => request(`/reports/${id}/`, { method: "PATCH", body }),
    createReport: (body) => request("/reports/", { method: "POST", body }),
    submitReport: (id) => request(`/reports/${id}/submit/`, { method: "POST", body: {} }),
    programmes: () => request("/programmes/"),
    programme: (regionId) => request(`/programmes/${regionId}/`),
    saveProgramme: (regionId, body) => request(`/programmes/${regionId}/`, { method: "PATCH", body }),
    consents: (params = "") => request(`/consents/${params ? `?${params}` : ""}`),
    users: () => request("/users/"),
    settings: () => request("/settings/"),
  };
})();

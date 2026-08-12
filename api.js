/**
 * Shared API client for the field system.
 * Reads runtime config from /config.js (injected by the Node server).
 * All assessment pages require a valid JWT via ensureAuth() / requireAuth().
 */
const AssessAPI = (() => {
  const cfg = () => window.ASSESS_CONFIG || {
    apiUrl: "https://api.assess.nileagi.com",
    apiBase: "https://api.assess.nileagi.com/api",
  };

  const TOKEN_KEY = "p10354-api-tokens";
  const SESSION_KEY = "p10354-session";

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

  const session = {
    get() {
      try { return JSON.parse(localStorage.getItem(SESSION_KEY)) || null; } catch { return null; }
    },
    set(value) {
      localStorage.setItem(SESSION_KEY, JSON.stringify(value));
    },
    clear() {
      localStorage.removeItem(SESSION_KEY);
    },
  };

  function logout(redirect = true) {
    tokens.clear();
    session.clear();
    if (redirect) location.replace("login.html");
  }

  /** Sync gate: redirect to login if no access token. */
  function requireAuth() {
    if (tokens.get()?.access) return true;
    const page = `${location.pathname.split("/").pop() || "dashboard.html"}${location.search}`;
    location.replace(`login.html?next=${encodeURIComponent(page)}`);
    return false;
  }

  function rememberUser(user) {
    session.set({
      userId: user.id,
      role: user.role_label || user.role,
      roleCode: user.role,
      username: user.username,
      at: new Date().toISOString(),
    });
  }

  /**
   * Async gate: require token and confirm it with /auth/me/.
   * Clears session and redirects on 401.
   */
  async function ensureAuth() {
    if (!requireAuth()) return false;
    try {
      const user = await me();
      rememberUser(user);
      return user;
    } catch (err) {
      if (err.status === 401 || err.status === 403) {
        logout(true);
        return false;
      }
      // Network / API down: keep local token so field work can continue offline.
      if (session.get()) return session.get();
      return true;
    }
  }

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
      if ((res.status === 401 || res.status === 403) && !options.skipAuth) {
        // Stale session — force re-login for protected calls.
        if (res.status === 401) logout(true);
      }
      const message = data?.detail || data?.non_field_errors?.[0] || `Request failed (${res.status})`;
      const err = new Error(typeof message === "string" ? message : JSON.stringify(message));
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  function me() {
    return request("/auth/me/");
  }

  return {
    config: cfg,
    tokens,
    session,
    logout,
    requireAuth,
    ensureAuth,
    rememberUser,
    request,
    health: () => request("/health/", { skipAuth: true }),
    login: (username, password) =>
      request("/auth/login/", { method: "POST", body: { username, password }, skipAuth: true }),
    me,
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
    createUser: (body) => request("/users/", { method: "POST", body }),
    settings: () => request("/settings/"),
  };
})();

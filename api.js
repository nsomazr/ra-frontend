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
      if (session.get()) return session.get();
      return true;
    }
  }

  /** Map API/network failures to safe, user-facing copy (never expose infra). */
  function friendlyError(err, fallback = "Something went wrong. Please try again.") {
    const status = err?.status;
    const data = err?.data;
    const detail = data?.detail;
    const fieldMsg =
      data?.username?.[0] || data?.password?.[0] || data?.email?.[0] || data?.non_field_errors?.[0];
    const raw = typeof detail === "string" ? detail
      : (typeof fieldMsg === "string" ? fieldMsg : (err?.message || ""));

    if (!status && (err?.name === "TypeError" || /failed to fetch|networkerror|load failed|cors/i.test(raw))) {
      return "We couldn’t connect right now. Please try again in a moment.";
    }
    if (status === 400 || status === 401) {
      if (/already exists|unique|taken/i.test(raw)) return "That username is already taken.";
      if (/no active account|credentials|incorrect|password|username/i.test(raw) && !fieldMsg) {
        return "Incorrect username or password.";
      }
      if (typeof fieldMsg === "string" && fieldMsg.length < 120) return fieldMsg;
      if (status === 401) return "Sign-in details look incorrect. Please check and try again.";
      return fallback;
    }
    if (status === 403) return "You don’t have permission to do that.";
    if (status === 404) return "The requested item could not be found.";
    if (status === 429) return "Too many attempts. Please wait a moment and try again.";
    if (status >= 500 || status === 502 || status === 503 || status === 504) {
      return "The service is temporarily unavailable. Please try again later.";
    }
    if (typeof detail === "string" && detail.length < 120 &&
        !/traceback|exception|\/home\/|venv|gunicorn|pm2|nginx|8087|3087|127\.0\.0\.1|localhost/i.test(detail)) {
      return detail;
    }
    return fallback;
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

    let res;
    try {
      res = await fetch(`${cfg().apiBase}${path}`, { ...options, headers });
    } catch (networkErr) {
      const err = new Error(friendlyError(networkErr));
      err.status = 0;
      err.cause = networkErr;
      if (typeof console !== "undefined") console.warn("[assess-api] network error", networkErr);
      throw err;
    }

    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }

    if (!res.ok) {
      if (res.status === 401 && !options.skipAuth) logout(true);
      const err = new Error(friendlyError({ status: res.status, data, message: data?.detail }));
      err.status = res.status;
      err.data = data;
      if (typeof console !== "undefined") console.warn("[assess-api]", res.status, path, data);
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
    friendlyError,
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

/* Sign-in: Django JWT when available, then local offline account fallback. */
(() => {
  const form = document.querySelector("#login");
  if (!form) return;
  const error = document.querySelector("#error");

  const sha256 = async (value) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };
  const pbkdf2 = async (value, saltBytes, iterations = 210000) => {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt: saltBytes, iterations, hash: "SHA-256" }, key, 256);
    return btoa(String.fromCharCode(...new Uint8Array(bits)));
  };
  const verifyLocal = async (password, verifier) => {
    if (!verifier) return false;
    if (verifier.startsWith("PBKDF2-SHA256$")) {
      const [, iterText, salt64, expected] = verifier.split("$");
      const iterations = Number(iterText);
      if (!iterations || !salt64 || !expected) return false;
      const salt = Uint8Array.from(atob(salt64), (c) => c.charCodeAt(0));
      return (await pbkdf2(password, salt, iterations)) === expected;
    }
    return verifier === await sha256(password);
  };

  const landingFor = (user) => {
    const role = user?.role || user?.roleCode || "";
    if (role === "ADMIN" || role === "System Administrator") return "admin.html";
    if (role === "TEAM_LEADER" || /Team Leader/i.test(user?.role_label || role)) return "review.html";
    return "dashboard.html";
  };

  const fail = (message) => {
    error.textContent = message;
    error.classList.remove("hidden");
  };

  const storeLocalVerifier = async (db, serverUser, username, password) => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const salt64 = btoa(String.fromCharCode(...salt));
    const derived = await pbkdf2(password, salt, 210000);
    const localVerifier = `PBKDF2-SHA256$210000$${salt64}$${derived}`;
    let local = db.users.find((u) => String(u.username).toLowerCase() === username.toLowerCase());
    const mapped = {
      id: serverUser.id || serverUser.userId || `USR-${username}`,
      name: serverUser.full_name || serverUser.name || "",
      username: serverUser.username || username,
      staffId: serverUser.staff_id || "",
      email: serverUser.email || "",
      phone: serverUser.phone || "",
      role: serverUser.role_label || serverUser.role || "",
      region: serverUser.home_region_id || "All",
      schools: [],
      active: serverUser.active !== false,
      mustChangePassword: !!serverUser.must_change_password,
      passwordHash: localVerifier,
      lastLogin: P10354.now(),
    };
    if (!local) db.users.push(mapped);
    else Object.assign(local, mapped);
    P10354.save(db);
    return mapped;
  };

  (async () => {
    if (typeof AssessAPI !== "undefined" && AssessAPI.tokens.get()?.access) {
      try {
        const user = await AssessAPI.me();
        AssessAPI.rememberUser(user);
        if (user.must_change_password) {
          location.replace("change-password.html");
          return;
        }
        if (typeof P10354.hydrateFromServer === "function") await P10354.hydrateFromServer();
        const params = new URLSearchParams(location.search);
        location.replace(params.get("next") || landingFor(user));
      } catch {
        /* stay on login */
      }
    }
  })();

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.classList.add("hidden");
    const username = String(form.username.value || "").trim();
    const password = String(form.password.value || "");
    if (!username || !password) return fail("Enter your username and password.");
    const btn = form.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;

    try {
      // Prefer Django JWT API
      if (typeof AssessAPI !== "undefined") {
        try {
          const result = await AssessAPI.login(username, password);
          AssessAPI.tokens.set({ access: result.access, refresh: result.refresh });
          AssessAPI.rememberUser(result.user);
          const db = P10354.load();
          await storeLocalVerifier(db, result.user, username, password);
          if (result.user?.must_change_password) {
            location.href = "change-password.html";
            return;
          }
          if (typeof P10354.hydrateFromServer === "function") await P10354.hydrateFromServer();
          const params = new URLSearchParams(location.search);
          location.href = params.get("next") || landingFor(result.user);
          return;
        } catch (err) {
          if (navigator.onLine && err?.status && err.status !== 0) {
            return fail(AssessAPI.friendlyError(err, "Incorrect username or password."));
          }
          console.warn("API login unavailable; trying local account", err);
        }
      }

      // Offline / local fallback
      const db = P10354.load();
      const user = db.users.find((u) => u.active && String(u.username).trim().toLowerCase() === username.toLowerCase());
      if (!user) return fail("Username not found or account is inactive.");
      if (user.passwordHash === "INITIAL_BOOTSTRAP_REQUIRED") {
        return fail("This administrator account needs to be configured before it can be used.");
      }
      const valid = await verifyLocal(password, user.passwordHash);
      if (!valid) return fail("Incorrect username or password.");
      if (!String(user.passwordHash).startsWith("PBKDF2-SHA256$")) {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        const salt64 = btoa(String.fromCharCode(...salt));
        const derived = await pbkdf2(password, salt, 210000);
        user.passwordHash = `PBKDF2-SHA256$210000$${salt64}$${derived}`;
      }
      user.lastLogin = P10354.now();
      P10354.save(db);
      P10354.session.set({
        userId: user.id, role: user.role, name: user.name, username: user.username,
        at: P10354.now(), auth: "local",
      });
      location.href = user.mustChangePassword ? "change-password.html" : landingFor(user);
    } finally {
      if (btn) btn.disabled = false;
    }
  };
})();

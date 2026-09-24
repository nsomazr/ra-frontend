/* JWT sign-in against ra-backend, then hydrate local cache from SQLite sync. */
(() => {
  const form = document.querySelector("#login");
  const error = document.querySelector("#error");
  if (!form) return;

  const fail = (message) => {
    error.textContent = message;
    error.classList.remove("hidden");
  };

  const landingFor = (user) => {
    const role = user?.role || user?.roleCode || "";
    if (role === "ADMIN" || role === "System Administrator") return "admin.html";
    if (role === "TEAM_LEADER" || /Team Leader/i.test(user?.role_label || "")) return "review.html";
    return "dashboard.html";
  };

  // Already signed in → skip login
  (async () => {
    if (!AssessAPI.tokens.get()?.access) return;
    try {
      const user = await AssessAPI.me();
      AssessAPI.rememberUser(user);
      if (user.must_change_password) {
        location.replace("change-password.html");
        return;
      }
      await P10354.hydrateFromServer();
      const params = new URLSearchParams(location.search);
      location.replace(params.get("next") || landingFor(user));
    } catch {
      /* stay on login */
    }
  })();

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.classList.add("hidden");
    const username = form.username.value.trim();
    const password = form.password.value;
    const btn = form.querySelector("button[type=submit]");
    if (btn) btn.disabled = true;
    try {
      const result = await AssessAPI.login(username, password);
      AssessAPI.tokens.set({ access: result.access, refresh: result.refresh });
      AssessAPI.rememberUser(result.user);
      if (result.user?.must_change_password) {
        location.href = "change-password.html";
        return;
      }
      await P10354.hydrateFromServer();
      const params = new URLSearchParams(location.search);
      location.href = params.get("next") || landingFor(result.user);
    } catch (err) {
      fail(AssessAPI.friendlyError(err, "Sign-in failed. Check your details and try again."));
    } finally {
      if (btn) btn.disabled = false;
    }
  };
})();

/* ============================================================================
   Sign-in against the Django REST API (JWT).
   All assessment pages require this login.
============================================================================ */
(() => {
  const form = document.querySelector("#login");
  const error = document.querySelector("#error");
  const submit = form?.querySelector('button[type="submit"]');

  if (!form) return;

  // Already signed in → continue to next page or role home
  (async () => {
    if (!AssessAPI.tokens.get()?.access) return;
    try {
      const user = await AssessAPI.me();
      AssessAPI.rememberUser(user);
      const next = new URLSearchParams(location.search).get("next");
      if (user.must_change_password) location.replace("change-password.html");
      else if (next && /\.html/.test(next)) location.replace(next);
      else location.replace(landingFor(user.role));
    } catch {
      AssessAPI.logout(false);
    }
  })();

  const fail = (message) => {
    error.textContent = message;
    error.classList.remove("hidden");
  };

  const landingFor = (role) =>
    role === "ADMIN" ? "admin.html"
      : role === "TEAM_LEADER" ? "review.html"
        : "dashboard.html";

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.classList.add("hidden");
    if (submit) {
      submit.disabled = true;
      submit.textContent = "Signing in…";
    }
    try {
      const data = await AssessAPI.login(form.username.value.trim(), form.password.value);
      AssessAPI.tokens.set({ access: data.access, refresh: data.refresh });
      AssessAPI.rememberUser(data.user);
      const next = new URLSearchParams(location.search).get("next");
      location.href = data.user.must_change_password
        ? "change-password.html"
        : (next && /\.html/.test(next) ? next : landingFor(data.user.role));
    } catch (err) {
      let msg = err.data?.detail
        || (Array.isArray(err.data?.non_field_errors) && err.data.non_field_errors[0])
        || err.message
        || "Sign-in failed.";
      if (msg === "Failed to fetch" || err.name === "TypeError") {
        msg = "Cannot reach the API. The backend may be down (check pm2 / port 8087).";
      }
      fail(typeof msg === "string" ? msg : "Incorrect username or password.");
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Sign in";
      }
    }
  };
})();

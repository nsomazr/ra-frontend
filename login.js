/* ============================================================================
   Sign-in against the Django REST API (JWT).
============================================================================ */
(() => {
  const form = document.querySelector("#login");
  const error = document.querySelector("#error");
  const submit = form?.querySelector('button[type="submit"]');

  if (!form) return;

  // Already signed in → go to admin or dashboard
  const existing = AssessAPI.tokens.get();
  if (existing?.access) {
    const session = (() => {
      try { return JSON.parse(localStorage.getItem("p10354-session")); } catch { return null; }
    })();
    const role = session?.role || "";
    if (/admin/i.test(role) || role === "ADMIN") location.replace("admin.html");
  }

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
      const user = data.user;
      localStorage.setItem("p10354-session", JSON.stringify({
        userId: user.id,
        role: user.role_label || user.role,
        roleCode: user.role,
        username: user.username,
        at: new Date().toISOString(),
      }));
      const next = new URLSearchParams(location.search).get("next");
      location.href = user.must_change_password
        ? "change-password.html"
        : (next && next.endsWith(".html") ? next : landingFor(user.role));
    } catch (err) {
      const msg = err.data?.detail
        || (Array.isArray(err.data?.non_field_errors) && err.data.non_field_errors[0])
        || err.message
        || "Sign-in failed.";
      fail(typeof msg === "string" ? msg : "Incorrect username or password.");
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Sign in";
      }
    }
  };
})();

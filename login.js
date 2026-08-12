/* ============================================================================
   Sign-in against the Django REST API (JWT).
   All assessment pages require this login.
============================================================================ */
(() => {
  const form = document.querySelector("#login");
  const error = document.querySelector("#error");
  const submit = form?.querySelector('button[type="submit"]');

  if (!form) return;

  const landingFor = (role) =>
    role === "ADMIN" ? "admin.html"
      : role === "TEAM_LEADER" ? "review.html"
        : "dashboard.html";

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
      fail(AssessAPI.friendlyError(err, "Unable to sign in. Please try again."));
      if (submit) {
        submit.disabled = false;
        submit.textContent = "Sign in";
      }
    }
  };
})();

/* ============================================================================
   Sign-in against the Django REST API (JWT).
============================================================================ */
(() => {
  const form = document.querySelector("#login");
  const error = document.querySelector("#error");
  const apiHost = document.querySelector("#api-host");
  if (apiHost && window.ASSESS_CONFIG) apiHost.textContent = ASSESS_CONFIG.apiUrl;
  if (!form) return;

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
    try {
      const data = await AssessAPI.login(form.username.value.trim(), form.password.value);
      AssessAPI.tokens.set({ access: data.access, refresh: data.refresh });
      const user = data.user;
      if (typeof P10354 !== "undefined") {
        P10354.session.set({
          userId: user.id,
          role: user.role_label || user.role,
          at: new Date().toISOString(),
        });
      } else {
        localStorage.setItem("p10354-session", JSON.stringify({
          userId: user.id,
          role: user.role_label || user.role,
          at: new Date().toISOString(),
        }));
      }
      location.href = user.must_change_password ? "change-password.html" : landingFor(user.role);
    } catch (err) {
      fail(err.message || "Sign-in failed.");
    }
  };
})();

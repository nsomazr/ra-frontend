/* Password change against the Django REST API. Requires login. */
(() => {
  const form = document.querySelector("#change");
  const error = document.querySelector("#error");
  if (!form) return;

  (async () => {
    if (!(await AssessAPI.ensureAuth())) return;

    form.onsubmit = async (e) => {
      e.preventDefault();
      error.classList.add("hidden");
      if (form.password.value !== form.confirm.value) {
        error.textContent = "Passwords do not match.";
        error.classList.remove("hidden");
        return;
      }
      try {
        const data = await AssessAPI.changePassword({
          current_password: form.current?.value || "",
          new_password: form.password.value,
        });
        AssessAPI.tokens.set({ access: data.access, refresh: data.refresh });
        if (data.user) AssessAPI.rememberUser(data.user);
        const role = data.user?.role || AssessAPI.session.get()?.roleCode;
        location.href = role === "ADMIN" ? "admin.html" : "dashboard.html";
      } catch (err) {
        error.textContent = AssessAPI.friendlyError(err, "Could not update your password. Please try again.");
        error.classList.remove("hidden");
      }
    };
  })();
})();

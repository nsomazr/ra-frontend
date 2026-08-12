/* Password change against the Django REST API. */
(() => {
  const form = document.querySelector("#change");
  const error = document.querySelector("#error");
  if (!form) return;

  if (!AssessAPI.tokens.get()) {
    location.href = "login.html";
    return;
  }

  const fail = (message) => { error.textContent = message; error.classList.remove("hidden"); };

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.classList.add("hidden");
    if (form.password.value !== form.confirm.value) return fail("Passwords do not match.");
    try {
      const data = await AssessAPI.changePassword({
        current_password: form.current?.value || "",
        new_password: form.password.value,
      });
      AssessAPI.tokens.set({ access: data.access, refresh: data.refresh });
      location.href = "admin.html";
    } catch (err) {
      fail(err.message || "Could not update password.");
    }
  };
})();

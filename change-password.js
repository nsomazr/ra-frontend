/* Change password via Django JWT API. */
(() => {
  const form = document.querySelector("#change");
  const error = document.querySelector("#error");
  if (!form) return;

  const fail = (message) => {
    error.textContent = message;
    error.classList.remove("hidden");
  };

  (async () => {
    if (typeof AssessAPI === "undefined" || !AssessAPI.tokens.get()?.access) {
      location.replace("login.html");
      return;
    }
    try {
      await AssessAPI.me();
    } catch {
      AssessAPI.logout(true);
    }
  })();

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.classList.add("hidden");
    if (form.password.value !== form.confirm.value) return fail("Passwords do not match.");
    const btn = form.querySelector("button");
    if (btn) btn.disabled = true;
    try {
      const result = await AssessAPI.changePassword({
        new_password: form.password.value,
        current_password: "",
      });
      if (result.access) {
        AssessAPI.tokens.set({
          access: result.access,
          refresh: result.refresh || AssessAPI.tokens.get()?.refresh,
        });
      }
      if (result.user) AssessAPI.rememberUser(result.user);
      await P10354.hydrateFromServer();
      location.href = "dashboard.html";
    } catch (err) {
      fail(AssessAPI.friendlyError(err, "Could not update password. Please try again."));
    } finally {
      if (btn) btn.disabled = false;
    }
  };
})();

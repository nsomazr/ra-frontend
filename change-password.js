/* Change password via Django JWT when available; keep local verifier for offline. */
(() => {
  const form = document.querySelector("#change");
  const error = document.querySelector("#error");
  if (!form) return;

  const fail = (message) => {
    error.textContent = message;
    error.classList.remove("hidden");
  };

  async function passwordVerifier(value, iterations = 210000) {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(value), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
    return `PBKDF2-SHA256$${iterations}$${btoa(String.fromCharCode(...salt))}$${btoa(String.fromCharCode(...new Uint8Array(bits)))}`;
  }

  (async () => {
    const hasJwt = typeof AssessAPI !== "undefined" && AssessAPI.tokens.get()?.access;
    const session = P10354.session.get();
    if (!hasJwt && !session) {
      location.href = "login.html";
      return;
    }
    if (hasJwt) {
      try { await AssessAPI.me(); } catch { AssessAPI.logout(true); }
    }
  })();

  form.onsubmit = async (e) => {
    e.preventDefault();
    error.classList.add("hidden");
    if (form.password.value !== form.confirm.value) return fail("Passwords do not match.");
    if (String(form.password.value || "").length < 12) return fail("Use at least 12 characters for the new password.");
    const btn = form.querySelector("button");
    if (btn) btn.disabled = true;
    try {
      if (typeof AssessAPI !== "undefined" && AssessAPI.tokens.get()?.access) {
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
      }

      const session = P10354.session.get() || AssessAPI?.session?.get?.();
      const db = P10354.load();
      let user = session?.userId ? db.users.find((u) => u.id === session.userId) : null;
      if (!user && session?.username) {
        user = db.users.find((u) => String(u.username).toLowerCase() === String(session.username).toLowerCase());
      }
      if (user) {
        user.passwordHash = await passwordVerifier(form.password.value);
        user.mustChangePassword = false;
        user.lastLogin = P10354.now();
        P10354.save(db);
      }
      location.href = "dashboard.html";
    } catch (err) {
      fail((typeof AssessAPI !== "undefined" && AssessAPI.friendlyError)
        ? AssessAPI.friendlyError(err, "Could not update password.")
        : (err.message || "Could not update password."));
    } finally {
      if (btn) btn.disabled = false;
    }
  };
})();

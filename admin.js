/* ============================================================================
   Administration — users, school assignments, regions in scope, and the
   submission controls the Team Leader owns.

   Users are created and updated through the Django API (SQLite). A local
   mirror is kept so offline assignment views still work after hydrate.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, pill, notice, button, field, tabs } = UI;

  let tab = new URLSearchParams(location.search).get("tab") || "users";
  let remoteUsers = [];
  let usersStatus = "";
  let usersLoading = false;

  const ROLE_TO_CODE = {
    "Team Leader / Senior MEL Specialist": "TEAM_LEADER",
    "Inclusive Education Specialist": "AUDITOR",
    "Disability Inclusion Expert": "DISABILITY_INCLUSION",
    "Financial and Compliance Auditor": "FINANCE_COMPLIANCE",
    "Procurement and Asset Verification Specialist": "PROCUREMENT",
    "Research Associate": "RESEARCH_ASSOCIATE",
    "Data Analyst": "DATA_ANALYST",
    "Safeguarding Lead": "SAFEGUARDING_LEAD",
    "System Administrator": "ADMIN",
    "CBM Viewer": "CBM_VIEWER",
  };

  function regionIdFromLabel(label) {
    if (!label || label === "All") return "";
    const match = F.regions.find((r) => r.name === label || r.id === label);
    return match ? match.id : String(label).toUpperCase();
  }

  function regionLabelFromId(id) {
    if (!id) return "All";
    const match = F.regions.find((r) => r.id === id);
    return match ? match.name : id;
  }

  function mapApiUser(u) {
    return {
      id: u.id,
      name: u.full_name || "",
      username: u.username,
      staffId: u.staff_id || "",
      email: u.email || "",
      phone: u.phone || "",
      role: u.role_label || u.role || "",
      roleCode: u.role || "",
      region: regionLabelFromId(u.home_region_id),
      homeRegionId: u.home_region_id || "",
      schools: Array.isArray(u.assigned_school_ids) ? u.assigned_school_ids : [],
      active: u.active !== false,
      lastLogin: u.last_login_at || "",
      mustChangePassword: !!u.must_change_password,
    };
  }

  function mirrorUsersLocally(users) {
    const d = P10354.load();
    const byUsername = new Map(users.map((u) => [String(u.username).toLowerCase(), u]));
    // Keep local-only bootstrap entries that are not on the server yet
    const kept = (d.users || []).filter((u) => !byUsername.has(String(u.username).toLowerCase()) && u.passwordHash === "INITIAL_BOOTSTRAP_REQUIRED");
    d.users = [...users.map((u) => ({
      ...u,
      passwordHash: (d.users.find((x) => x.id === u.id || String(x.username).toLowerCase() === String(u.username).toLowerCase()) || {}).passwordHash || "",
    })), ...kept];
    P10354.save(d);
  }

  async function loadUsers() {
    usersLoading = true;
    usersStatus = "";
    render();
    try {
      if (typeof AssessAPI === "undefined") throw new Error("API client is not loaded.");
      const raw = await AssessAPI.users();
      const list = Array.isArray(raw) ? raw : (raw.results || []);
      remoteUsers = list.map(mapApiUser);
      mirrorUsersLocally(remoteUsers);
      usersStatus = "";
    } catch (err) {
      remoteUsers = (P10354.load().users || []).map((u) => ({
        ...u,
        roleCode: ROLE_TO_CODE[u.role] || u.role || "",
        schools: u.schools || [],
      }));
      usersStatus = AssessAPI?.friendlyError?.(err, err.message || "Could not load users from the server.")
        || err.message
        || "Could not load users from the server.";
    } finally {
      usersLoading = false;
      render();
    }
  }

  function apiHeaders(extra = {}) {
    const cfg = P10354.getSyncConfig();
    const headers = { ...extra };
    if (cfg.access) headers.Authorization = `Bearer ${cfg.access}`;
    else if (cfg.token) headers["X-P10354-API-Key"] = cfg.token;
    return { cfg, headers };
  }

  async function createServerBackup() {
    const { cfg, headers } = apiHeaders();
    if (!navigator.onLine || !cfg?.apiBase) { alert("The server is not available. Connect to the server first."); return; }
    try {
      const response = await fetch(`${cfg.apiBase}/admin/backup/`, { headers });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || !body?.backup) throw new Error(body?.error || body?.detail || `Backup failed (${response.status})`);
      const blob = new Blob([JSON.stringify(body.backup, null, 2)], { type: "application/json" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `P10354_server_backup_${new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-")}.json`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    } catch (error) { alert(`Backup failed: ${error.message}`); }
  }

  async function restoreServerBackup(file) {
    if (!file) return;
    const confirmed = confirm("Restore this server backup? The current server data will first be backed up automatically.");
    if (!confirmed) return;
    try {
      const backup = JSON.parse(await file.text());
      if (backup?.format !== "P10354-SERVER-BACKUP-1") throw new Error("This is not a valid P10354 server backup file.");
      const { cfg, headers } = apiHeaders({ "Content-Type": "application/json" });
      if (!cfg?.apiBase) throw new Error("Server configuration is not available.");
      const response = await fetch(`${cfg.apiBase}/admin/restore/`, { method: "POST", headers, body: JSON.stringify({ backup }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body?.error || body?.detail || `Restore failed (${response.status})`);
      alert(`Backup restored successfully. Server version: ${body.serverVersion}`);
      if (typeof P10354.pullFromServer === "function") await P10354.pullFromServer();
      render();
    } catch (error) { alert(`Restore failed: ${error.message}`); }
  }

  const db = () => P10354.load();

  function saveDb(mutate) {
    const d = db();
    mutate(d);
    P10354.save(d);
    if (typeof P10354.scheduleSync === "function") P10354.scheduleSync();
    render();
  }

  function usersList() {
    return remoteUsers.length ? remoteUsers : (db().users || []);
  }

  /* --- Tab: users ---------------------------------------------------------- */
  function usersTab() {
    const list = usersList();

    const table = `<section class="card">
      <div class="pad section-head">
        <div><h2>Users</h2><p class="help">Accounts are stored in the project database and can sign in online.</p></div>
        <div class="actions">
          ${button("Refresh", () => loadUsers(), "btn secondary")}
          ${button("Export user list (CSV)", () => {
            UI.saveCsv("P10354_Users", UI.toCsv(
              ["Username", "Name", "Role", "Region", "Assigned schools", "Active", "Last login"],
              list.map((u) => [u.username, u.name, u.role, u.region, (u.schools || []).length, u.active ? "Yes" : "No", u.lastLogin])));
          }, "btn secondary")}
        </div>
      </div>
      ${usersStatus ? notice(esc(usersStatus), "red") : ""}
      ${usersLoading ? notice("Loading users…") : ""}
      <div class="tablewrap"><table>
        <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Region</th><th>Schools</th><th>Last login</th><th>Status</th><th></th></tr></thead>
        <tbody>${list.length ? list.map((u) => `<tr>
          <td><b>${esc(u.username)}</b>${u.mustChangePassword ? `<br>${pill("Password change due", "alert")}` : ""}</td>
          <td>${esc(u.name) || "—"}</td><td>${esc(u.role)}</td><td>${esc(u.region)}</td>
          <td>${(u.schools || []).length}</td>
          <td><small>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}</small></td>
          <td>${pill(u.active ? "Active" : "Inactive")}</td>
          <td>${button(u.active ? "Deactivate" : "Reactivate", () => toggleActive(u), "btn secondary small")}</td>
        </tr>`).join("") : `<tr><td colspan="8" class="empty">No users loaded yet.</td></tr>`}</tbody>
      </table></div>
    </section>`;

    const form = `<section class="card pad">
      <h2>Add user</h2>
      <form id="userForm" autocomplete="off">
        <div class="fieldgrid">
          <label class="field"><span>Full name</span><input name="name" required></label>
          <label class="field"><span>Username</span><input name="username" required autocomplete="off"></label>
          <label class="field"><span>Temporary password</span><input name="password" type="password" minlength="12" required autocomplete="new-password">
            <small class="help">Stored securely on the server. The user must change it at first sign-in.</small></label>
          <label class="field"><span>Role</span><select name="role">${F.teamRoles.map((r) => `<option>${esc(r)}</option>`).join("")}</select></label>
          <label class="field"><span>Region</span><select name="region">${["All", ...F.regions.map((r) => r.name)].map((r) => `<option>${esc(r)}</option>`).join("")}</select></label>
          <label class="field"><span>Email</span><input name="email" type="email"></label>
          <label class="field"><span>Phone</span><input name="phone"></label>
          <label class="field"><span>Staff / consultant ID</span><input name="staffId"></label>
        </div>
        <label class="field wide"><span>Assigned schools</span>
          <select name="schools" multiple size="8">${P10354.schools.map((s) =>
            `<option value="${esc(s.id)}">${esc(s.region)} · ${esc(s.name)}</option>`).join("")}</select>
        </label>
        <p id="userError" class="notice red hidden"></p>
        <p id="userOk" class="notice hidden"></p>
        <button class="btn large" type="submit">Add user</button>
      </form>
    </section>`;

    return `<section class="two">${table}${form}</section>`;
  }

  async function toggleActive(user) {
    if (!user?.id || typeof AssessAPI === "undefined") {
      alert("Sign in as an administrator to change account status on the server.");
      return;
    }
    try {
      const updated = await AssessAPI.updateUser(user.id, { active: !user.active });
      const mapped = mapApiUser(updated);
      remoteUsers = remoteUsers.map((u) => (u.id === mapped.id ? mapped : u));
      mirrorUsersLocally(remoteUsers);
      render();
    } catch (err) {
      alert(AssessAPI.friendlyError(err, "Could not update that account."));
    }
  }

  function wireUserForm() {
    const form = UI.$("#userForm");
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const error = UI.$("#userError");
      const ok = UI.$("#userOk");
      error.classList.add("hidden");
      ok.classList.add("hidden");
      const data = new FormData(form);
      const username = String(data.get("username") || "").trim();
      const password = String(data.get("password") || "");
      const roleLabel = String(data.get("role") || "");
      const roleCode = ROLE_TO_CODE[roleLabel] || roleLabel;
      const regionLabel = String(data.get("region") || "All");
      const schools = data.getAll("schools").map(String);

      if (!username || !password) {
        error.textContent = "Username and temporary password are required.";
        error.classList.remove("hidden");
        return;
      }
      if (password.length < 12) {
        error.textContent = "Use at least 12 characters for the temporary password.";
        error.classList.remove("hidden");
        return;
      }
      if (usersList().some((u) => String(u.username).toLowerCase() === username.toLowerCase())) {
        error.textContent = "That username already exists.";
        error.classList.remove("hidden");
        return;
      }

      const btn = form.querySelector("button[type=submit]");
      if (btn) btn.disabled = true;
      try {
        if (typeof AssessAPI === "undefined" || !AssessAPI.tokens.get()?.access) {
          throw new Error("Sign in online as an administrator to create accounts.");
        }
        const created = await AssessAPI.createUser({
          username,
          password,
          full_name: String(data.get("name") || "").trim(),
          staff_id: String(data.get("staffId") || "").trim(),
          email: String(data.get("email") || "").trim(),
          phone: String(data.get("phone") || "").trim(),
          role: roleCode,
          home_region_id: regionIdFromLabel(regionLabel),
          must_change_password: true,
          active: true,
          assigned_school_ids: schools,
        });
        const mapped = mapApiUser(created);
        remoteUsers = [...remoteUsers.filter((u) => u.id !== mapped.id), mapped]
          .sort((a, b) => String(a.username).localeCompare(String(b.username)));
        mirrorUsersLocally(remoteUsers);
        form.reset();
        ok.textContent = `User “${mapped.username}” created. They can sign in with the temporary password.`;
        ok.classList.remove("hidden");
        render();
      } catch (err) {
        error.textContent = AssessAPI?.friendlyError?.(err, err.message || "Could not create user.")
          || err.message
          || "Could not create user.";
        error.classList.remove("hidden");
      } finally {
        if (btn) btn.disabled = false;
      }
    };
  }

  /* --- Tab: assignments ---------------------------------------------------- */
  function assignmentsTab() {
    const assignable = usersList().filter((u) => u.active);
    return `<section class="card">
      <div class="pad"><h2>School assignments</h2></div>
      <div class="tablewrap"><table>
        <thead><tr><th>School</th><th>Region</th><th>Roster</th><th>Assigned team members</th></tr></thead>
        <tbody>${P10354.schools.map((s) => {
          const assigned = assignable.filter((u) => (u.schools || []).includes(s.id) || u.region === "All" || u.region === s.region);
          return `<tr>
            <td><b>${esc(s.name)}</b><br><small>${esc(s.id)}</small></td>
            <td>${esc(s.region)}</td>
            <td>${s.rosterStatus === "CONFIRMED" ? pill("Confirmed") : pill("Unconfirmed", "alert")}</td>
            <td>${assigned.length
              ? assigned.map((u) => `<span class="pill">${esc(u.name || u.username)} · ${esc(u.role)}</span>`).join(" ")
              : `<small>No active user is assigned to this school.</small>`}</td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;
  }

  /* --- Tab: regions and roster --------------------------------------------- */
  function regionsTab() {
    const d = db();
    return `
      <section class="card">
        <div class="pad"><h2>Fieldwork regions</h2></div>
        <div class="tablewrap"><table>
          <thead><tr><th>Region</th><th>Schools</th><th>Roster</th><th>In scope</th><th>Councils</th><th></th></tr></thead>
          <tbody>${F.regions.map((region) => {
            const inScope = d.settings.activeRegions.includes(region.id);
            const count = P10354.schools.filter((s) => s.region.toUpperCase() === region.id).length;
            return `<tr>
              <td><b>${esc(region.name)}</b></td>
              <td>${count}</td>
              <td>${pill(region.rosterStatus)}</td>
              <td>${pill(inScope ? "In scope" : "Out of scope")}</td>
              <td><small>${esc(region.councils)}</small></td>
              <td>${button(inScope ? "Remove from scope" : "Add to scope", () => saveDb((x) => {
                const list = new Set(x.settings.activeRegions);
                inScope ? list.delete(region.id) : list.add(region.id);
                x.settings.activeRegions = [...list];
              }), "btn secondary small")}</td>
            </tr>`;
          }).join("")}</tbody>
        </table></div>
      </section>
      <section class="card">
        <div class="pad section-head">
          <div><h2>School roster</h2></div>
          <div class="actions">${button("Export roster (CSV)", () => {
            UI.saveCsv("P10354_SchoolRoster", UI.toCsv(
              ["School ID", "School", "Region", "Council", "Ward", "Roster status", "Students", "Students with disabilities",
                "Disability categories", "2025 audit headline", "Retest areas", "Priority", "Name variant"],
              P10354.schools.map((s) => [s.id, s.name, s.region, s.council, s.ward, s.rosterStatus, s.pupils ?? "",
                s.learnersWithDisabilities ?? "", s.disabilityCategories, s.auditHeadline,
                (s.retest || []).map((r) => r.area).join(" | "), s.priority, s.nameVariant || ""])));
          }, "btn secondary")}</div>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>School</th><th>Council / ward</th><th>Students</th><th>Students with disabilities</th><th>Categories</th><th>Retest areas</th><th>Priority</th></tr></thead>
          <tbody>${P10354.schools.map((s) => `<tr>
            <td><b>${esc(s.name)}</b><br><small>${esc(s.id)} · ${esc(s.region)}</small>
              ${s.nameVariant ? `<br><small class="warn">${esc(s.nameVariant)}</small>` : ""}</td>
            <td>${esc(s.council)}<br><small>${esc(s.ward)}</small></td>
            <td>${s.pupils ?? "—"}</td><td>${s.learnersWithDisabilities ?? "—"}</td>
            <td><small>${esc(s.disabilityCategories) || "—"}</small></td>
            <td>${(s.retest || []).length || "—"}</td>
            <td>${pill(s.priority)}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>`;
  }

  /* --- Tab: controls -------------------------------------------------------- */
  function controlsTab() {
    const d = db();
    const set = (key) => (value) => saveDb((x) => { x.settings[key] = value === "yes"; });

    return `
      <section class="card pad">
        <h2>Submission and approval controls</h2>
        <div class="fieldgrid">
          ${field({ label: "Unassessed questions", type: "select", value: d.settings.allowUnassessed ? "yes" : "no",
            options: [{ value: "yes", label: "Allow submission with unassessed questions" }, { value: "no", label: "Require all questions assessed" }],
            onChange: set("allowUnassessed") })}
          ${field({ label: "Triangulation rule", type: "select", value: d.settings.requireTriangulation ? "yes" : "no",
            options: [{ value: "yes", label: "Require two evidence streams per assessed question" }, { value: "no", label: "Warn only" }],
            onChange: set("requireTriangulation") })}
          ${field({ label: "Unconfirmed school rosters", type: "select", value: d.settings.blockUnconfirmedRoster ? "yes" : "no",
            options: [{ value: "yes", label: "Block submission for unconfirmed schools" }, { value: "no", label: "Warn only" }],
            onChange: set("blockUnconfirmedRoster") })}
        </div>
      </section>

      <section class="card pad">
        <h2>Assessment framework in use</h2>
        <div class="tablewrap"><table>
          <thead><tr><th>Component</th><th>Count</th><th>Source</th></tr></thead>
          <tbody>
            <tr><td>Result areas</td><td>${F.results.length}</td><td>Results matrix sheet</td></tr>
            <tr><td>Field verification questions</td><td>${F.fieldQuestions.length}</td><td>Field assessment sheet</td></tr>
            <tr><td>Beneficiary interview questions</td><td>${F.interviewQuestions.length}</td><td>Beneficiary interviews sheet</td></tr>
            <tr><td>Stakeholder groups</td><td>${F.stakeholders.length}</td><td>Stakeholder engagement sheet</td></tr>
            <tr><td>Activities to verify</td><td>${F.activities.length}</td><td>Activity verification sheet</td></tr>
            <tr><td>Baseline indicators</td><td>${F.baselineIndicators.length}</td><td>Baseline vs now sheet</td></tr>
            <tr><td>OECD-DAC criteria</td><td>${F.dacCriteria.length}</td><td>OECD-DAC review sheet</td></tr>
            <tr><td>Sustainability assets</td><td>${F.sustainabilityAssets.length}</td><td>Sustainability & exit sheet</td></tr>
            <tr><td>Learning areas</td><td>${F.learningAreas.length}</td><td>Learning & change sheet</td></tr>
            <tr><td>Verification layers</td><td>${F.architectureLayers.length}</td><td>Assessment architecture sheet</td></tr>
            <tr><td>Reconciliation items</td><td>${F.reconciliation.length}</td><td>Data reconciliation sheet + scope review</td></tr>
            <tr><td>Schools on roster</td><td>${P10354.schools.length}</td><td>Region checklists + 2025 accessibility audit</td></tr>
          </tbody>
        </table></div>
      </section>

      <section class="card pad">
        <h2>Server backup & restore</h2>
        <p class="help">Downloads and restores the Django assessment snapshot (reports, programmes, consents, conflicts). User accounts remain in the Django auth database.</p>
        <div class="actions">
          ${button("Create server backup", createServerBackup, "btn secondary")}
          <label class="btn secondary">Restore server backup<input id="serverRestoreFile" type="file" accept="application/json,.json" style="display:none"></label>
        </div>
      </section>

      <section class="card pad">
        <h2>Local data</h2>
        <div class="actions">
          ${button("Export full dataset (JSON)", () => {
            const blob = new Blob([JSON.stringify(db(), null, 2)], { type: "application/json" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `P10354_dataset_${new Date().toISOString().slice(0, 10)}.json`;
            a.click();
          }, "btn secondary")}
        </div>
        <p class="help">Schema version ${P10354.SCHEMA_VERSION}${db().legacy ? ` · ${Object.keys(db().legacy.reports || {}).length} legacy report(s) preserved from schema v${db().legacy.fromVersion}` : ""}</p>
      </section>`;
  }

  /* --- Render --------------------------------------------------------------- */
  const TABS = [
    { id: "users", label: "Users" },
    { id: "assignments", label: "School assignments" },
    { id: "regions", label: "Regions & roster" },
    { id: "controls", label: "Controls & framework" },
  ];

  function render() {
    const host = UI.$("#admin");
    const state = UI.snapshot(host);
    UI.reset();

    const body = { users: usersTab, assignments: assignmentsTab, regions: regionsTab, controls: controlsTab }[tab] || usersTab;

    host.innerHTML = [
      `<div class="heading"><div><h1>Administration</h1></div></div>`,
      tabs(TABS, tab, (id) => { tab = id; history.replaceState({}, "", `admin.html?tab=${id}`); render(); window.scrollTo(0, 0); }),
      `<div class="tabbody">${body()}</div>`,
    ].join("");

    UI.wire(host);
    wireUserForm();
    const restoreInput = UI.$("#serverRestoreFile", host);
    if (restoreInput) restoreInput.onchange = () => restoreServerBackup(restoreInput.files?.[0]);
    UI.restore(state, host);
  }

  (async () => {
    if (!(await UI.gateAuth())) return;
    UI.chrome();
    render();
    await loadUsers();
  })();
})();

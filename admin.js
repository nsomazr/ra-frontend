/* ============================================================================
   Administration — users, school assignments, regions, controls.
   Requires API sign-in. Responsive: tables on desktop, cards on mobile.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, pill, button, field, tabs } = UI;

  const ROLE_MAP = {
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

  let tab = new URLSearchParams(location.search).get("tab") || "users";
  let apiUsers = null;
  let busy = false;

  const session = () => {
    try { return JSON.parse(localStorage.getItem("p10354-session")); } catch { return null; }
  };

  const requireAuth = () => {
    if (!AssessAPI.tokens.get()?.access) {
      location.replace(`login.html?next=${encodeURIComponent("admin.html")}`);
      return false;
    }
    return true;
  };

  async function hash(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const db = () => P10354.load();

  function saveDb(mutate) {
    const d = db();
    mutate(d);
    P10354.save(d);
    render();
  }

  async function loadApiUsers() {
    try {
      const data = await AssessAPI.users();
      apiUsers = Array.isArray(data) ? data : (data.results || []);
    } catch {
      apiUsers = null;
    }
  }

  function localUsers() {
    return db().users || [];
  }

  function displayUsers() {
    if (apiUsers && apiUsers.length) {
      return apiUsers.map((u) => ({
        id: u.id,
        username: u.username,
        name: u.full_name || "",
        role: u.role_label || u.role,
        roleCode: u.role,
        region: u.home_region_id || "All",
        schools: [],
        active: u.active,
        lastLogin: u.last_login_at,
        mustChangePassword: u.must_change_password,
        source: "api",
      }));
    }
    return localUsers().map((u) => ({ ...u, source: "local" }));
  }

  /* --- Users tab ---------------------------------------------------------- */
  function userCard(u) {
    return `<article class="admin-user-card">
      <div class="admin-user-top">
        <div>
          <b>${esc(u.username)}</b>
          <small>${esc(u.name) || "No name set"}</small>
        </div>
        <div class="chips">${pill(u.active ? "Active" : "Inactive")}${u.mustChangePassword ? pill("Password due", "alert") : ""}</div>
      </div>
      <dl class="admin-meta">
        <div><dt>Role</dt><dd>${esc(u.role)}</dd></div>
        <div><dt>Region</dt><dd>${esc(u.region || "—")}</dd></div>
        <div><dt>Schools</dt><dd>${(u.schools || []).length}</dd></div>
        <div><dt>Last login</dt><dd>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}</dd></div>
      </dl>
      ${u.source === "local" ? `<div class="actions">${button(u.active ? "Deactivate" : "Reactivate", () => saveDb((x) => {
        const user = x.users.find((y) => y.id === u.id);
        if (user) user.active = !user.active;
      }), "btn secondary small")}</div>` : ""}
    </article>`;
  }

  function usersTab() {
    const users = displayUsers();

    const cards = `<div class="admin-user-cards">${users.map(userCard).join("") || `<p class="empty">No users yet.</p>`}</div>`;

    const table = `<div class="tablewrap admin-desktop-table"><table>
      <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Region</th><th>Schools</th><th>Last login</th><th>Status</th><th></th></tr></thead>
      <tbody>${users.map((u) => `<tr>
        <td><b>${esc(u.username)}</b>${u.mustChangePassword ? `<br>${pill("Password due", "alert")}` : ""}</td>
        <td>${esc(u.name) || "—"}</td>
        <td>${esc(u.role)}</td>
        <td>${esc(u.region || "—")}</td>
        <td>${(u.schools || []).length}</td>
        <td><small>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}</small></td>
        <td>${pill(u.active ? "Active" : "Inactive")}</td>
        <td>${u.source === "local" ? button(u.active ? "Deactivate" : "Reactivate", () => saveDb((x) => {
          const user = x.users.find((y) => y.id === u.id);
          if (user) user.active = !user.active;
        }), "btn secondary small") : "—"}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;

    const list = `<section class="card admin-panel">
      <div class="pad section-head">
        <div>
          <h2>Users</h2>
          <p class="help">${users.length} account${users.length === 1 ? "" : "s"}${apiUsers ? " · live from API" : " · local cache"}</p>
        </div>
        <div class="actions">${button("Export CSV", () => {
          UI.saveCsv("P10354_Users", UI.toCsv(
            ["Username", "Name", "Role", "Region", "Assigned schools", "Active", "Last login"],
            users.map((u) => [u.username, u.name, u.role, u.region, (u.schools || []).length, u.active ? "Yes" : "No", u.lastLogin || ""])));
        }, "btn secondary")}</div>
      </div>
      ${cards}
      ${table}
    </section>`;

    const form = `<section class="card pad admin-panel">
      <h2>Add user</h2>
      <p class="help">Creates an account${AssessAPI.tokens.get() ? " on the API" : " in the local prototype store"}.</p>
      <form id="userForm" autocomplete="off">
        <div class="fieldgrid">
          <label class="field"><span>Full name</span><input name="name" required></label>
          <label class="field"><span>Username</span><input name="username" required autocomplete="off"></label>
          <label class="field"><span>Temporary password</span>
            <input name="password" type="password" minlength="8" required autocomplete="new-password">
            <small class="help">User must change this on first sign-in.</small>
          </label>
          <label class="field"><span>Role</span>
            <select name="role">${F.teamRoles.map((r) => `<option value="${esc(r)}">${esc(r)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Region</span>
            <select name="region">${["All", ...F.regions.map((r) => r.name)].map((r) => `<option>${esc(r)}</option>`).join("")}</select>
          </label>
          <label class="field"><span>Email</span><input name="email" type="email" inputmode="email"></label>
          <label class="field"><span>Phone</span><input name="phone" inputmode="tel"></label>
          <label class="field"><span>Staff / consultant ID</span><input name="staffId"></label>
        </div>
        <label class="field wide"><span>Assigned schools</span>
          <select name="schools" multiple size="6" class="school-multi">${P10354.schools.map((s) =>
            `<option value="${esc(s.id)}">${esc(s.region)} · ${esc(s.name)}</option>`).join("")}</select>
        </label>
        <p id="userError" class="notice red hidden" role="alert"></p>
        <p id="userOk" class="notice green hidden" role="status"></p>
        <button class="btn large" type="submit">Add user</button>
      </form>
    </section>`;

    return `<section class="admin-two">${list}${form}</section>`;
  }

  function wireUserForm() {
    const form = UI.$("#userForm");
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      if (busy) return;
      const error = UI.$("#userError");
      const ok = UI.$("#userOk");
      error.classList.add("hidden");
      ok.classList.add("hidden");
      const data = new FormData(form);
      const username = String(data.get("username")).trim();
      const roleLabel = String(data.get("role"));
      const roleCode = ROLE_MAP[roleLabel] || "AUDITOR";
      const password = String(data.get("password"));

      busy = true;
      const btn = form.querySelector('button[type="submit"]');
      if (btn) { btn.disabled = true; btn.textContent = "Saving…"; }

      try {
        if (AssessAPI.tokens.get()?.access) {
          await AssessAPI.createUser({
            username,
            full_name: data.get("name"),
            password,
            role: roleCode,
            email: data.get("email") || "",
            phone: data.get("phone") || "",
            staff_id: data.get("staffId") || "",
            home_region_id: (() => {
              const region = String(data.get("region") || "");
              if (!region || region === "All") return "";
              const match = F.regions.find((r) => r.name === region || r.id === region.toUpperCase());
              return match ? match.id : region.toUpperCase();
            })(),
            must_change_password: true,
            active: true,
          });
          await loadApiUsers();
          ok.textContent = `User “${username}” created on the API.`;
          ok.classList.remove("hidden");
          form.reset();
          render();
        } else {
          const d = db();
          if (d.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
            throw new Error("That username already exists.");
          }
          d.users.push({
            id: P10354.uid("USR"),
            name: data.get("name"),
            username,
            passwordHash: await hash(password),
            staffId: data.get("staffId") || "",
            email: data.get("email") || "",
            phone: data.get("phone") || "",
            role: roleLabel,
            region: data.get("region"),
            schools: data.getAll("schools"),
            active: true,
            lastLogin: "",
            mustChangePassword: true,
          });
          P10354.save(d);
          render();
        }
      } catch (err) {
        const detail = err.data?.username?.[0] || err.data?.detail || err.message;
        error.textContent = typeof detail === "string" ? detail : "Could not add user.";
        error.classList.remove("hidden");
        if (btn) { btn.disabled = false; btn.textContent = "Add user"; }
      } finally {
        busy = false;
      }
    };
  }

  /* --- Assignments -------------------------------------------------------- */
  function assignmentsTab() {
    const d = db();
    const assignable = d.users.filter((u) => u.active);
    const rows = P10354.schools.map((s) => {
      const assigned = assignable.filter((u) => (u.schools || []).includes(s.id) || u.region === "All" || u.region === s.region);
      return { s, assigned };
    });

    return `<section class="card admin-panel">
      <div class="pad"><h2>School assignments</h2><p class="help">Who can work on each school report.</p></div>
      <div class="admin-assign-cards">${rows.map(({ s, assigned }) => `
        <article class="admin-assign-card">
          <div class="admin-user-top">
            <div><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(s.region)}</small></div>
            ${s.rosterStatus === "CONFIRMED" ? pill("Confirmed") : pill("Unconfirmed", "alert")}
          </div>
          <div class="chips">${assigned.length
            ? assigned.map((u) => `<span class="pill">${esc(u.name || u.username)}</span>`).join("")
            : `<small>No active user assigned</small>`}</div>
        </article>`).join("")}</div>
      <div class="tablewrap admin-desktop-table"><table>
        <thead><tr><th>School</th><th>Region</th><th>Roster</th><th>Assigned team</th></tr></thead>
        <tbody>${rows.map(({ s, assigned }) => `<tr>
          <td><b>${esc(s.name)}</b><br><small>${esc(s.id)}</small></td>
          <td>${esc(s.region)}</td>
          <td>${s.rosterStatus === "CONFIRMED" ? pill("Confirmed") : pill("Unconfirmed", "alert")}</td>
          <td>${assigned.length
            ? assigned.map((u) => `<span class="pill">${esc(u.name || u.username)} · ${esc(u.role)}</span>`).join(" ")
            : `<small>No active user assigned</small>`}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>`;
  }

  /* --- Regions ------------------------------------------------------------ */
  function regionsTab() {
    const d = db();
    return `
      <section class="card admin-panel">
        <div class="pad"><h2>Fieldwork regions</h2></div>
        <div class="admin-region-cards">${F.regions.map((region) => {
          const inScope = d.settings.activeRegions.includes(region.id);
          const count = P10354.schools.filter((s) => s.region.toUpperCase() === region.id).length;
          return `<article class="admin-assign-card">
            <div class="admin-user-top">
              <div><b>${esc(region.name)}</b><small>${count} schools · ${esc(region.councils || "—")}</small></div>
              <div class="chips">${pill(region.rosterStatus)}${pill(inScope ? "In scope" : "Out of scope")}</div>
            </div>
            <div class="actions">${button(inScope ? "Remove from scope" : "Add to scope", () => saveDb((x) => {
              const list = new Set(x.settings.activeRegions);
              inScope ? list.delete(region.id) : list.add(region.id);
              x.settings.activeRegions = [...list];
            }), "btn secondary small")}</div>
          </article>`;
        }).join("")}</div>
        <div class="tablewrap admin-desktop-table"><table>
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
      <section class="card admin-panel">
        <div class="pad section-head">
          <div><h2>School roster</h2></div>
          <div class="actions">${button("Export roster (CSV)", () => {
            UI.saveCsv("P10354_SchoolRoster", UI.toCsv(
              ["School ID", "School", "Region", "Council", "Ward", "Roster status", "Pupils", "Children with disabilities", "Priority"],
              P10354.schools.map((s) => [s.id, s.name, s.region, s.council, s.ward, s.rosterStatus, s.pupils ?? "",
                s.learnersWithDisabilities ?? "", s.priority])));
          }, "btn secondary")}</div>
        </div>
        <div class="admin-school-cards">${P10354.schools.map((s) => `
          <article class="admin-assign-card">
            <div class="admin-user-top">
              <div><b>${esc(s.name)}</b><small>${esc(s.id)} · ${esc(s.region)}</small></div>
              ${pill(s.priority || "—")}
            </div>
            <dl class="admin-meta">
              <div><dt>Council</dt><dd>${esc(s.council)}</dd></div>
              <div><dt>Ward</dt><dd>${esc(s.ward)}</dd></div>
              <div><dt>Pupils</dt><dd>${s.pupils ?? "—"}</dd></div>
              <div><dt>CWD</dt><dd>${s.learnersWithDisabilities ?? "—"}</dd></div>
            </dl>
          </article>`).join("")}</div>
        <div class="tablewrap admin-desktop-table"><table>
          <thead><tr><th>School</th><th>Council / ward</th><th>Pupils</th><th>CWD</th><th>Categories</th><th>Retest</th><th>Priority</th></tr></thead>
          <tbody>${P10354.schools.map((s) => `<tr>
            <td><b>${esc(s.name)}</b><br><small>${esc(s.id)} · ${esc(s.region)}</small></td>
            <td>${esc(s.council)}<br><small>${esc(s.ward)}</small></td>
            <td>${s.pupils ?? "—"}</td><td>${s.learnersWithDisabilities ?? "—"}</td>
            <td><small>${esc(s.disabilityCategories) || "—"}</small></td>
            <td>${(s.retest || []).length || "—"}</td>
            <td>${pill(s.priority)}</td>
          </tr>`).join("")}</tbody>
        </table></div>
      </section>`;
  }

  /* --- Controls ----------------------------------------------------------- */
  function controlsTab() {
    const d = db();
    const set = (key) => (value) => saveDb((x) => { x.settings[key] = value === "yes"; });
    const sess = session();

    return `
      <section class="card pad admin-panel">
        <h2>Signed-in session</h2>
        <dl class="admin-meta session-meta">
          <div><dt>User</dt><dd>${esc(sess?.username || sess?.userId || "—")}</dd></div>
          <div><dt>Role</dt><dd>${esc(sess?.role || "—")}</dd></div>
          <div><dt>Since</dt><dd>${sess?.at ? new Date(sess.at).toLocaleString() : "—"}</dd></div>
        </dl>
        <div class="actions" style="margin-top:12px">
          ${button("Sign out", () => {
            AssessAPI.tokens.clear();
            localStorage.removeItem("p10354-session");
            location.href = "login.html";
          }, "btn secondary")}
        </div>
      </section>

      <section class="card pad admin-panel">
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

      <section class="card pad admin-panel">
        <h2>Assessment framework</h2>
        <div class="admin-stat-grid">
          <div class="admin-stat"><b>${F.results.length}</b><span>Result areas</span></div>
          <div class="admin-stat"><b>${F.fieldQuestions.length}</b><span>Field questions</span></div>
          <div class="admin-stat"><b>${F.activities.length}</b><span>Activities</span></div>
          <div class="admin-stat"><b>${P10354.schools.length}</b><span>Schools</span></div>
          <div class="admin-stat"><b>${F.reconciliation.length}</b><span>Reconciliation</span></div>
          <div class="admin-stat"><b>${F.dacCriteria.length}</b><span>DAC criteria</span></div>
        </div>
      </section>

      <section class="card pad admin-panel">
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
        <p class="help">Schema version ${P10354.SCHEMA_VERSION}</p>
      </section>`;
  }

  const TABS = [
    { id: "users", label: "Users" },
    { id: "assignments", label: "Assignments" },
    { id: "regions", label: "Regions" },
    { id: "controls", label: "Controls" },
  ];

  function render() {
    const host = UI.$("#admin");
    const state = UI.snapshot(host);
    UI.reset();
    const body = { users: usersTab, assignments: assignmentsTab, regions: regionsTab, controls: controlsTab }[tab] || usersTab;
    const sess = session();

    host.innerHTML = [
      `<div class="heading">
        <div>
          <h1>Administration</h1>
          <p>Manage accounts, school coverage and submission rules${sess?.username ? ` · signed in as <b>${esc(sess.username)}</b>` : ""}</p>
        </div>
        <div class="actions">
          <a class="btn secondary" href="dashboard.html">Dashboard</a>
          <button type="button" class="btn secondary" id="adminSignOut">Sign out</button>
        </div>
      </div>`,
      tabs(TABS, tab, (id) => { tab = id; history.replaceState({}, "", `admin.html?tab=${id}`); render(); window.scrollTo(0, 0); }),
      `<div class="tabbody">${body()}</div>`,
    ].join("");

    UI.wire(host);
    wireUserForm();
    const out = UI.$("#adminSignOut");
    if (out) out.onclick = () => {
      AssessAPI.tokens.clear();
      localStorage.removeItem("p10354-session");
      location.href = "login.html";
    };
    UI.restore(state, host);
  }

  async function boot() {
    if (!requireAuth()) return;
    UI.chrome();
    await loadApiUsers();
    render();
  }

  boot();
})();

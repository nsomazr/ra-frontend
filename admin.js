/* ============================================================================
   Administration — users, school assignments, regions in scope, and the
   submission controls the Team Leader owns.

   Note on passwords: hashing here is SHA-256 in the browser, which is a
   placeholder for the prototype only. Production must use server-side
   Argon2id or bcrypt — see architecture.md. The UI says so plainly rather
   than implying this is a secure store.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, pill, notice, button, field, tabs } = UI;

  let tab = new URLSearchParams(location.search).get("tab") || "users";

  async function hash(value) {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
  }

  const db = () => P10354.load();

  function saveDb(mutate, event) {
    const d = db();
    mutate(d);
    P10354.save(d);
    render();
  }

  /* --- Tab: users ---------------------------------------------------------- */
  function usersTab() {
    const d = db();

    const table = `<section class="card">
      <div class="pad section-head">
        <div><h2>Users</h2></div>
        <div class="actions">${button("Export user list (CSV)", () => {
          UI.saveCsv("P10354_Users", UI.toCsv(
            ["Username", "Name", "Role", "Region", "Assigned schools", "Active", "Last login"],
            d.users.map((u) => [u.username, u.name, u.role, u.region, (u.schools || []).length, u.active ? "Yes" : "No", u.lastLogin])));
        }, "btn secondary")}</div>
      </div>
      <div class="tablewrap"><table>
        <thead><tr><th>Username</th><th>Name</th><th>Role</th><th>Region</th><th>Schools</th><th>Last login</th><th>Status</th><th></th></tr></thead>
        <tbody>${d.users.map((u) => `<tr>
          <td><b>${esc(u.username)}</b>${u.mustChangePassword ? `<br>${pill("Password change due", "alert")}` : ""}</td>
          <td>${esc(u.name) || "—"}</td><td>${esc(u.role)}</td><td>${esc(u.region)}</td>
          <td>${(u.schools || []).length}</td>
          <td><small>${u.lastLogin ? new Date(u.lastLogin).toLocaleString() : "Never"}</small></td>
          <td>${pill(u.active ? "Active" : "Inactive")}</td>
          <td>${button(u.active ? "Deactivate" : "Reactivate", () => saveDb((x) => {
            const user = x.users.find((y) => y.id === u.id);
            user.active = !user.active;
          }), "btn secondary small")}</td>
        </tr>`).join("")}</tbody>
      </table></div>
    </section>`;

    const form = `<section class="card pad">
      <h2>Add user</h2>
      <form id="userForm" autocomplete="off">
        <div class="fieldgrid">
          <label class="field"><span>Full name</span><input name="name" required></label>
          <label class="field"><span>Username</span><input name="username" required autocomplete="off"></label>
          <label class="field"><span>Temporary password</span><input name="password" type="password" minlength="12" required autocomplete="new-password">
            <small class="help">Prototype hashing only — not production credential storage.</small></label>
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
        <button class="btn large">Add user</button>
      </form>
    </section>`;

    return `<section class="two">${table}${form}</section>`;
  }

  function wireUserForm() {
    const form = UI.$("#userForm");
    if (!form) return;
    form.onsubmit = async (e) => {
      e.preventDefault();
      const error = UI.$("#userError");
      const data = new FormData(form);
      const d = db();
      if (d.users.some((u) => u.username.toLowerCase() === String(data.get("username")).toLowerCase())) {
        error.textContent = "That username already exists.";
        error.classList.remove("hidden");
        return;
      }
      d.users.push({
        id: P10354.uid("USR"),
        name: data.get("name"), username: data.get("username"),
        passwordHash: await hash(data.get("password")),
        staffId: data.get("staffId") || "", email: data.get("email") || "", phone: data.get("phone") || "",
        role: data.get("role"), region: data.get("region"),
        schools: data.getAll("schools"),
        active: true, lastLogin: "", mustChangePassword: true,
      });
      P10354.save(d);
      render();
    };
  }

  /* --- Tab: assignments ---------------------------------------------------- */
  function assignmentsTab() {
    const d = db();
    const assignable = d.users.filter((u) => u.active);
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
              ["School ID", "School", "Region", "Council", "Ward", "Roster status", "Pupils", "Children with disabilities",
                "Disability categories", "2025 audit headline", "Retest areas", "Priority", "Name variant"],
              P10354.schools.map((s) => [s.id, s.name, s.region, s.council, s.ward, s.rosterStatus, s.pupils ?? "",
                s.learnersWithDisabilities ?? "", s.disabilityCategories, s.auditHeadline,
                (s.retest || []).map((r) => r.area).join(" | "), s.priority, s.nameVariant || ""])));
          }, "btn secondary")}</div>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>School</th><th>Council / ward</th><th>Pupils</th><th>CWD</th><th>Categories</th><th>Retest areas</th><th>Priority</th></tr></thead>
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
    UI.restore(state, host);
  }

  UI.chrome();
  render();
})();

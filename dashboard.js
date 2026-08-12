/* ============================================================================
   Field dashboard — what the team should do next, and what is blocking them.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, pill, field } = UI;

  let regionFilter = new URLSearchParams(location.search).get("region") || "ALL";

  const openReconciliation = () => Scoring.projectStats();

  function regionCards() {
    return `<section class="grid">${F.regions.map((region) => {
      const roll = Scoring.regionRollup(region.id);
      if (!region.active) return "";
      return `<article class="card metric green">
        <small>${esc(region.name)}</small>
        <b>${roll.started}/${roll.schools}</b>
        <p class="help">${roll.submitted} submitted · ${roll.assessed}/${roll.questions} assessed</p>
      </article>`;
    }).join("")}</section>`;
  }

  function metrics(reports) {
    const stats = reports.map(Scoring.reportStats);
    const sum = (key) => stats.reduce((n, s) => n + s[key], 0);
    return `<section class="grid">
      <article class="card metric"><small>Schools in scope</small><b>${P10354.schoolsInScope().length}</b><p class="help">of ${P10354.schools.length} on the roster</p></article>
      <article class="card metric amber"><small>Reports in progress</small><b>${reports.filter((r) => ["DRAFT", "IN PROGRESS", "REQUIRES CLARIFICATION"].includes(r.status)).length}</b></article>
      <article class="card metric green"><small>Submitted / approved</small><b>${reports.filter((r) => ["SUBMITTED", "UNDER REVIEW", "QA APPROVED", "FINALIZED"].includes(r.status)).length}</b></article>
      <article class="card metric blue"><small>Evidence items</small><b>${sum("evidenceCount")}</b></article>
      <article class="card metric ${sum("underTriangulated") ? "red" : ""}"><small>Single-source findings</small><b>${sum("underTriangulated")}</b></article>
      <article class="card metric ${sum("safetyRisks") ? "red" : ""}"><small>Accessibility safety risks</small><b>${sum("safetyRisks")}</b></article>
      <article class="card metric ${sum("disputes") ? "amber" : ""}"><small>Auditor discrepancies</small><b>${sum("disputes")}</b></article>
      <article class="card metric"><small>Child cases traced</small><b>${sum("cases")}</b></article>
    </section>`;
  }

  function schoolTable(db) {
    const schools = P10354.schools.filter((s) => regionFilter === "ALL" || s.region.toUpperCase() === regionFilter);
    return `<section class="card">
      <div class="pad section-head">
        <div><h2>My schools</h2></div>
        <div class="actions" style="min-width:220px">
          ${field({ label: "Region", type: "select", value: regionFilter,
            options: [{ value: "ALL", label: "All regions" }, ...F.regions.map((r) => ({ value: r.id, label: r.name }))],
            onChange: (v) => { regionFilter = v; history.replaceState({}, "", `dashboard.html?region=${v}`); render(); } })}
        </div>
      </div>
      <div class="tablewrap"><table>
        <thead><tr><th>School</th><th>Council / ward</th><th>Roster</th><th>Status</th><th>Verification progress</th><th>Accessibility</th><th>Flags</th><th></th></tr></thead>
        <tbody>${schools.map((s) => {
          const r = db.reports[s.id];
          const st = r ? Scoring.reportStats(r) : null;
          const flags = [];
          if (st && st.underTriangulated) flags.push(pill(`${st.underTriangulated} single-source`, "alert"));
          if (st && st.disputes) flags.push(pill(`${st.disputes} disputed`, "alert"));
          if (st && st.safetyRisks) flags.push(pill(`${st.safetyRisks} safety`, "alert"));
          return `<tr>
            <td><b>${esc(s.name)}</b><br><small>${esc(s.id)} · ${esc(s.region)}</small></td>
            <td>${esc(s.council)}<br><small>${esc(s.ward)}</small></td>
            <td>${s.rosterStatus === "CONFIRMED" ? pill("Confirmed") : pill("Unconfirmed", "alert")}</td>
            <td>${pill(r ? r.status : "Not started")}</td>
            <td>${st ? `<div class="progress small"><i style="width:${st.percent}%"></i></div>
                   <small>${st.assessed}/${st.questions - st.na} · ${st.evidenceCount} evidence</small>` : "<small>Not started</small>"}</td>
            <td>${(s.retest || []).length ? (st ? `${st.accessTested}/${st.accessAreas} re-tested` : `${s.retest.length} areas`) : "<small>No baseline supplied</small>"}</td>
            <td>${flags.join(" ") || "—"}</td>
            <td><a class="btn secondary" href="school-assessment.html?school=${esc(s.id)}">${r ? "Open report" : "Create report"}</a></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;
  }

  function render() {
    const host = UI.$("#dashboard");
    const state = UI.snapshot(host);
    UI.reset();

    const db = P10354.load();
    const reports = Object.values(db.reports);
    const open = openReconciliation();

    host.innerHTML = [
      `<div class="heading">
        <div><h1>Field dashboard</h1>
          <p>${esc(F.meta.assessor)} · ${esc(F.meta.client)} · Project ${esc(F.meta.project)}</p></div>
        <div class="actions">
          <a class="btn secondary" href="programme.html?tab=reconciliation">Reconciliation ${open.reconciliationOpen}/${open.reconciliationTotal}</a>
          <a class="btn large" href="school-assessment.html">Start a school assessment</a>
        </div>
      </div>`,
      metrics(reports),
      regionCards(),
      schoolTable(db),
    ].join("");

    UI.wire(host);
    UI.restore(state, host);
  }

  UI.chrome();
  render();
})();

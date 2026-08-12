/* ============================================================================
   Team Leader review — the master collective sheet.
   One row per school × verification question, with the discrepancies preserved
   rather than smoothed over, plus exports shaped like the checklist sheets.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, pill, button, field, tabs, ratingPill } = UI;

  let tab = new URLSearchParams(location.search).get("tab") || "reports";
  let filter = { region: "ALL", status: "ALL", flag: "ALL" };

  const reportsWithSchools = () => {
    const db = P10354.load();
    return P10354.schools
      .map((s) => ({ school: s, report: db.reports[s.id] }))
      .filter((x) => x.report)
      .filter((x) => filter.region === "ALL" || x.school.region.toUpperCase() === filter.region)
      .filter((x) => filter.status === "ALL" || x.report.status === filter.status);
  };

  function filters(extra = []) {
    return `<section class="card pad"><div class="fieldgrid">
      ${field({ label: "Region", type: "select", value: filter.region,
        options: [{ value: "ALL", label: "All regions" }, ...F.regions.map((r) => ({ value: r.id, label: r.name }))],
        onChange: (v) => { filter.region = v; render(); } })}
      ${field({ label: "Report status", type: "select", value: filter.status,
        options: [{ value: "ALL", label: "All statuses" }, ...F.scales.reportStatus.map((s) => ({ value: s, label: s }))],
        onChange: (v) => { filter.status = v; render(); } })}
      ${extra.join("")}
    </div></section>`;
  }

  /* --- Tab: submitted reports ---------------------------------------------- */
  function reportsTab() {
    const rows = reportsWithSchools();
    return `${filters()}
      <section class="card">
        <div class="pad section-head">
          <div><h2>School reports</h2><p class="help">${rows.length} report(s) in view.</p></div>
          <div class="actions">${button("Export report register (CSV)", exportRegister, "btn secondary")}</div>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>School</th><th>Report ID</th><th>Status</th><th>Version</th><th>Progress</th><th>Flags</th><th>Updated</th><th></th></tr></thead>
          <tbody>${rows.length ? rows.map(({ school, report }) => {
            const st = Scoring.reportStats(report);
            const checks = Scoring.submissionChecks(report, school, P10354.load().settings);
            const flags = [
              st.disputes ? pill(`${st.disputes} disputed`, "alert") : "",
              st.underTriangulated ? pill(`${st.underTriangulated} single-source`, "alert") : "",
              st.safetyRisks ? pill(`${st.safetyRisks} safety`, "alert") : "",
              checks.blocked ? pill("Blocked", "alert") : "",
            ].filter(Boolean).join(" ");
            return `<tr>
              <td><b>${esc(school.name)}</b><br><small>${esc(school.region)}</small></td>
              <td><small>${esc(report.id)}</small></td>
              <td>${pill(report.status)}</td><td>v${report.version}</td>
              <td><div class="progress small"><i style="width:${st.percent}%"></i></div><small>${st.assessed}/${st.questions - st.na}</small></td>
              <td>${flags || "—"}</td>
              <td><small>${new Date(report.updatedAt).toLocaleString()}</small></td>
              <td><a class="btn secondary" href="school-assessment.html?school=${esc(school.id)}&role=leader">Review</a></td>
            </tr>`;
          }).join("") : `<tr><td colspan="8" class="empty">No school reports match this filter.</td></tr>`}</tbody>
        </table></div>
      </section>`;
  }

  /* --- Tab: master collective sheet ---------------------------------------- */
  function masterTab() {
    const flagFilter = field({ label: "Show", type: "select", value: filter.flag,
      options: [
        { value: "ALL", label: "All questions" },
        { value: "DISPUTED", label: "Auditor discrepancies only" },
        { value: "SINGLE", label: "Single-source findings only" },
        { value: "OPEN", label: "Not assessed / follow-up only" },
      ],
      onChange: (v) => { filter.flag = v; render(); } });

    const rows = [];
    reportsWithSchools().forEach(({ school, report }) => {
      F.fieldQuestions.forEach((q) => {
        const x = report.fieldQuestions[q.id];
        const disputed = x.a1.grade && x.a2.grade && x.a1.grade !== x.a2.grade;
        const single = x.status === "ASSESSED" && (x.streams || []).length < 2;
        const open = x.status === "NOT ASSESSED" || x.status === "REQUIRES FOLLOW-UP";
        if (filter.flag === "DISPUTED" && !disputed) return;
        if (filter.flag === "SINGLE" && !single) return;
        if (filter.flag === "OPEN" && !open) return;
        rows.push({ school, report, q, x, disputed, single });
      });
    });

    return `${filters([flagFilter])}
      <section class="card">
        <div class="pad section-head">
          <div><h2>Master collective sheet</h2><p class="help">${rows.length} row(s): one per school × verification question.</p></div>
          <div class="actions">${button("Export master sheet (CSV)", exportMaster, "btn secondary")}</div>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>School</th><th>ID</th><th>Question</th><th>Status</th><th>Ach.</th><th>Qual.</th><th>Streams</th><th>Auditor 1</th><th>Auditor 2</th><th>Final grade</th><th>Evidence</th></tr></thead>
          <tbody>${rows.length ? rows.map(({ school, q, x, disputed, single }) => `<tr class="${disputed ? "rowalert" : ""}">
            <td><small>${esc(school.name)}</small></td>
            <td><small>${esc(q.id)}</small></td>
            <td>${esc(q.area)}<br><small>${esc(q.question)}</small></td>
            <td>${pill(x.status)}</td>
            <td>${ratingPill(x.achievement)}</td>
            <td>${ratingPill(x.quality)}</td>
            <td>${single ? pill(`${(x.streams || []).length}`, "alert") : `<small>${(x.streams || []).join(" + ") || "—"}</small>`}</td>
            <td><small>${esc(x.a1.grade) || "—"}</small></td>
            <td><small>${esc(x.a2.grade) || "—"}</small></td>
            <td>${x.final.grade ? pill(x.final.grade) : (disputed ? pill("DISPUTED", "alert") : "<small>Pending</small>")}</td>
            <td>${(x.evidence || []).length}</td>
          </tr>`).join("") : `<tr><td colspan="11" class="empty">No rows match this filter.</td></tr>`}</tbody>
        </table></div>
      </section>`;
  }

  /* --- Tab: findings ------------------------------------------------------- */
  function findingsTab() {
    const all = [];
    reportsWithSchools().forEach(({ school, report }) =>
      report.findings.forEach((f) => all.push({ school, report, f })));
    const order = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    all.sort((a, b) => (order[a.f.severity] ?? 4) - (order[b.f.severity] ?? 4));

    return `${filters()}
      <section class="card">
        <div class="pad section-head">
          <div><h2>Consolidated findings and recommendations</h2><p class="help">${all.length} finding(s), most severe first.</p></div>
          <div class="actions">${button("Export findings (CSV)", () => {
            const headers = ["Finding ID", "School", "Region", "Result", "Finding", "Evidence", "Root cause", "Effect",
              "Severity", "Recommendation", "Responsible party", "Timeframe", "Priority", "Status"];
            const rows = all.map(({ school, f }, i) => [`F-${String(i + 1).padStart(3, "0")}`, school.name, school.region,
              f.result, f.finding, f.evidence, f.rootCause, f.effect, f.severity, f.recommendation, f.owner, f.timeframe, f.priority, f.status]);
            UI.saveCsv("P10354_Findings", UI.toCsv(headers, rows));
          }, "btn secondary")}</div>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>Severity</th><th>School</th><th>Result</th><th>Finding</th><th>Root cause</th><th>Recommendation</th><th>Owner</th><th>Priority</th><th>Status</th></tr></thead>
          <tbody>${all.length ? all.map(({ school, f }) => `<tr>
            <td>${f.severity ? pill(f.severity, f.severity === "CRITICAL" || f.severity === "HIGH" ? "alert" : "") : "—"}</td>
            <td><small>${esc(school.name)}</small></td><td><small>${esc(f.result)}</small></td>
            <td>${esc(f.finding)}</td><td><small>${esc(f.rootCause)}</small></td>
            <td>${esc(f.recommendation)}</td><td><small>${esc(f.owner)}</small></td>
            <td>${f.priority ? pill(f.priority) : "—"}</td><td>${pill(f.status || "OPEN")}</td>
          </tr>`).join("") : `<tr><td colspan="9" class="empty">No findings recorded yet.</td></tr>`}</tbody>
        </table></div>
      </section>`;
  }

  /* --- Tab: accessibility rollup ------------------------------------------- */
  function accessibilityTab() {
    const rows = [];
    reportsWithSchools().forEach(({ school, report }) =>
      (school.retest || []).forEach((area) => {
        const x = report.accessibility[area.area] || {};
        rows.push({ school, area, x });
      }));

    return `${filters()}
      <section class="card">
        <div class="pad section-head">
          <div><h2>Accessibility retest rollup</h2><p class="help">2025 audit recommendations against what the team physically re-tested.</p></div>
          <div class="actions">${button("Export retest (CSV)", () => {
            const headers = ["School", "Region", "Area", "2025 audit recommendation", "Current condition", "Standard / usability check",
              "Accessible in practice?", "Tested by", "Achievement", "Quality", "Safety risk", "Action required"];
            UI.saveCsv("P10354_AccessibilityRetest", UI.toCsv(headers, rows.map(({ school, area, x }) =>
              [school.name, school.region, area.area, area.recommendation, x.currentCondition, x.standardCheck,
                x.accessibleInPractice, x.testedBy, x.achievement, x.quality, x.safetyRisk, x.action])));
          }, "btn secondary")}</div>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>School</th><th>Area</th><th>2025 audit recommendation</th><th>Accessible in practice?</th><th>Ach.</th><th>Safety risk</th><th>Action required</th></tr></thead>
          <tbody>${rows.length ? rows.map(({ school, area, x }) => `<tr class="${x.safetyRisk && x.safetyRisk !== "NO" ? "rowalert" : ""}">
            <td><small>${esc(school.name)}</small></td><td>${esc(area.area)}</td>
            <td><small>${esc(area.recommendation)}</small></td>
            <td>${x.accessibleInPractice ? pill(x.accessibleInPractice) : "<small>Not tested</small>"}</td>
            <td>${ratingPill(x.achievement)}</td>
            <td>${x.safetyRisk ? pill(x.safetyRisk, x.safetyRisk === "NO" ? "" : "alert") : "—"}</td>
            <td><small>${esc(x.action)}</small></td>
          </tr>`).join("") : `<tr><td colspan="7" class="empty">No accessibility baseline in this selection.</td></tr>`}</tbody>
        </table></div>
      </section>`;
  }

  /* --- Tab: regional rollup ------------------------------------------------ */
  function rollupTab() {
    const proj = Scoring.projectStats();
    const reconciliation = `<section class="card">
      <div class="pad"><h2>Project data reconciliation</h2></div>
      <div class="tablewrap"><table>
        <thead><tr><th>ID</th><th>Issue</th><th>Source A</th><th>Source B</th><th>Status</th><th>Final agreed figure / wording</th></tr></thead>
        <tbody>${F.reconciliation.map((item) => {
          const x = P10354.getProject().reconciliation[item.id];
          return `<tr class="${x.status === "RESOLVED" ? "" : "rowalert"}">
            <td><small>${esc(item.id)}</small></td>
            <td><b>${esc(item.issue)}</b><br><small>${esc(item.why)}</small></td>
            <td><small>${esc(item.sourceA)}</small></td>
            <td><small>${esc(item.sourceB)}</small></td>
            <td>${pill(x.status, x.status === "RESOLVED" ? "" : "alert")}</td>
            <td><small>${esc(x.agreed) || "—"}</small></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;

    const regions = `<section class="card">
      <div class="pad"><h2>Regional rollup</h2></div>
      <div class="tablewrap"><table>
        <thead><tr><th>Region</th><th>Roster</th><th>Reports</th><th>Submitted</th><th>Questions assessed</th><th>DAC rated</th><th>Gates cleared</th><th></th></tr></thead>
        <tbody>${F.regions.map((region) => {
          const roll = Scoring.regionRollup(region.id);
          const p = P10354.load().programmes[region.id];
          const stats = p ? Scoring.programmeStats(p)
            : { dacRated: 0, dacTotal: F.dacCriteria.length, gatesCleared: 0, gatesTotal: F.gates.length };
          return `<tr>
            <td><b>${esc(region.name)}</b><br><small>${region.active ? "Active" : "Inactive"}</small></td>
            <td>${region.rosterStatus === "CONFIRMED" ? pill("Confirmed") : pill("Unconfirmed", "alert")}</td>
            <td>${roll.started}/${roll.schools}</td><td>${roll.submitted}</td>
            <td>${roll.assessed}/${roll.questions}</td>
            <td>${stats.dacRated}/${stats.dacTotal}</td>
            <td>${stats.gatesCleared}/${stats.gatesTotal}</td>
            <td><a class="btn secondary" href="programme.html?region=${region.id}">Open workbook</a></td>
          </tr>`;
        }).join("")}</tbody>
      </table></div>
    </section>`;

    return `${reconciliation}${regions}`;
  }

  /* --- Exports ------------------------------------------------------------- */
  function exportRegister() {
    const headers = ["Report ID", "School", "Region", "Council", "Ward", "Roster status", "Status", "Version",
      "Visit date", "Assessed", "Not assessed", "Evidence", "Disputes", "Single-source", "Safety risks", "Findings", "Submitted at"];
    const rows = reportsWithSchools().map(({ school, report }) => {
      const st = Scoring.reportStats(report);
      return [report.id, school.name, school.region, school.council, school.ward, school.rosterStatus, report.status,
        report.version, report.profile.visitDate, st.assessed, st.notAssessed, st.evidenceCount, st.disputes,
        st.underTriangulated, st.safetyRisks, st.findings, report.submittedAt];
    });
    UI.saveCsv("P10354_ReportRegister", UI.toCsv(headers, rows));
  }

  function exportMaster() {
    const headers = ["School", "Region", "Assessment ID", "Result", "Area", "Assessment question", "Planned target / standard",
      "Reported achievement", "Actual finding", "Evidence checked", "Source / respondent", "Achievement", "Quality",
      "Status", "Evidence streams", "Auditor 1 grade", "Auditor 2 grade", "Discrepancy", "Final grade", "Reviewer rationale",
      "Issue / cause", "Effect", "Recommendation", "Evidence count"];
    const rows = [];
    reportsWithSchools().forEach(({ school, report }) => {
      F.fieldQuestions.forEach((q) => {
        const x = report.fieldQuestions[q.id];
        const disputed = x.a1.grade && x.a2.grade && x.a1.grade !== x.a2.grade;
        rows.push([school.name, school.region, q.id, q.result, q.area, q.question, q.standard, x.reported, x.actual,
          x.evidenceChecked, x.source, x.achievement, x.quality, x.status, (x.streams || []).join(" + "),
          x.a1.grade, x.a2.grade, disputed ? "DISPUTED" : "", x.final.grade, x.final.rationale,
          x.issue, x.effect, x.recommendation, (x.evidence || []).length]);
      });
    });
    UI.saveCsv("P10354_MasterCollectiveSheet", UI.toCsv(headers, rows));
  }

  /* --- Render --------------------------------------------------------------- */
  const TABS = [
    { id: "reports", label: "School reports" },
    { id: "master", label: "Master collective sheet" },
    { id: "findings", label: "Findings" },
    { id: "accessibility", label: "Accessibility rollup" },
    { id: "rollup", label: "Regional rollup" },
  ];

  function render() {
    const host = UI.$("#review");
    const state = UI.snapshot(host);
    UI.reset();

    const body = { reports: reportsTab, master: masterTab, findings: findingsTab, accessibility: accessibilityTab, rollup: rollupTab }[tab] || reportsTab;

    host.innerHTML = [
      `<div class="heading"><div><h1>Team Leader review</h1></div></div>`,
      tabs(TABS, tab, (id) => { tab = id; history.replaceState({}, "", `review.html?tab=${id}`); render(); window.scrollTo(0, 0); }),
      `<div class="tabbody">${body()}</div>`,
    ].join("");

    UI.wire(host);
    UI.restore(state, host);
  }

  UI.chrome();
  render();
})();

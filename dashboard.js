/* P10354 Project Command Centre + management dashboard. */
(() => {
  const F = FRAMEWORK;
  const { esc, pill, field, button } = UI;
  let regionFilter = new URLSearchParams(location.search).get("region") || "ALL";

  function allReports() { return Object.values(P10354.load().reports); }
  function aggregateActions() {
    const out = [];
    for (const r of allReports()) {
      const s = P10354.school(r.schoolId);
      (r.findings || []).forEach((f, i) => {
        out.push({ report: r, school: s, finding: f, index: i });
      });
    }
    return out;
  }
  function overallStats(reports) {
    const stats = reports.map(Scoring.reportStats);
    const sum = (k) => stats.reduce((n, x) => n + (x[k] || 0), 0);
    const schools = P10354.schoolsInScope().length;
    const started = reports.length;
    const submitted = reports.filter(r => ["SUBMITTED","UNDER REVIEW","QA APPROVED","FINALIZED"].includes(r.status)).length;
    const pct = schools ? Math.round((submitted / schools) * 100) : 0;
    const findings = aggregateActions();
    const high = findings.filter(x => ["HIGH","CRITICAL"].includes(x.finding.severity)).length;
    const open = findings.filter(x => x.finding.status !== "CLOSED").length;
    return { schools, started, submitted, pct, evidence: sum("evidenceCount"), assessed: sum("assessed"), questions: sum("questions"), high, open, findings: findings.length };
  }
  function commandCentre(stats) {
    return `<section class="card pad command">
      <div class="section-head"><div><h2>Project Command Centre</h2><p class="help">One view of fieldwork progress, findings and actions.</p></div><div class="actions">
        <a class="btn" href="executive-report.html">Executive Report</a>
        <a class="btn secondary" href="actions.html">Action Tracker</a>
      </div></div>
      <div class="progress large"><i style="width:${stats.pct}%"></i></div>
      <div class="summary">
        <span><b>${stats.pct}%</b> project completion</span><span><b>${stats.submitted}/${stats.schools}</b> schools submitted</span>
        <span><b>${stats.open}</b> open actions</span><span><b>${stats.high}</b> high / critical findings</span>
      </div>
    </section>`;
  }
  function metrics(stats) {
    return `<section class="grid">
      <article class="card metric green"><small>Schools completed</small><b>${stats.submitted}</b><p class="help">of ${stats.schools} in scope</p></article>
      <article class="card metric amber"><small>Schools in progress</small><b>${Math.max(0, stats.started - stats.submitted)}</b></article>
      <article class="card metric blue"><small>Evidence items</small><b>${stats.evidence}</b></article>
      <article class="card metric ${stats.open ? "amber" : "green"}"><small>Open actions</small><b>${stats.open}</b></article>
      <article class="card metric ${stats.high ? "red" : "green"}"><small>High / critical findings</small><b>${stats.high}</b></article>
      <article class="card metric"><small>Questions assessed</small><b>${stats.assessed}/${stats.questions}</b></article>
    </section>`;
  }
  function regionTable() {
    return `<section class="card"><div class="pad section-head"><div><h2>Regional progress</h2></div><div class="actions" style="min-width:220px">${field({ label: "Region", type: "select", value: regionFilter, options: [{value:"ALL",label:"All regions"}, ...F.regions.map(r=>({value:r.id,label:r.name}))], onChange:(v)=>{regionFilter=v; history.replaceState({},"",`dashboard.html?region=${v}`); render();} })}</div></div>
    <div class="tablewrap"><table><thead><tr><th>Region</th><th>Schools</th><th>Submitted</th><th>Completion</th><th>Findings</th><th>Open actions</th></tr></thead><tbody>
    ${F.regions.filter(r=>r.active && (regionFilter==="ALL"||r.id===regionFilter)).map(r=>{
      const schools=P10354.schools.filter(s=>s.region.toUpperCase()===r.id); const db=P10354.load(); const reps=schools.map(s=>db.reports[s.id]).filter(Boolean);
      const submitted=reps.filter(x=>["SUBMITTED","UNDER REVIEW","QA APPROVED","FINALIZED"].includes(x.status)).length;
      const actions=reps.flatMap(x=>x.findings||[]); const open=actions.filter(x=>x.status!=="CLOSED").length;
      const pct=schools.length?Math.round((submitted/schools.length)*100):0;
      return `<tr><td><b>${esc(r.name)}</b></td><td>${schools.length}</td><td>${submitted}</td><td><div class="progress small"><i style="width:${pct}%"></i></div><small>${pct}%</small></td><td>${actions.length}</td><td>${open?pill(open+" open","alert"):pill("All closed")}</td></tr>`;
    }).join("")}</tbody></table></div></section>`;
  }
  function actionSummary() {
    const actions=aggregateActions(); const counts={OPEN:0,"IN DISCUSSION":0,AGREED:0,CLOSED:0}; actions.forEach(x=>counts[x.finding.status||"OPEN"]=(counts[x.finding.status||"OPEN"]||0)+1);
    return `<section class="card pad"><div class="section-head"><div><h2>Recommendations / Action Tracker</h2><p class="help">Current status of actions raised during school assessments.</p></div><a class="btn secondary" href="actions.html">Open tracker</a></div><div class="grid compact">
      ${Object.entries(counts).map(([k,v])=>`<article class="card metric"><small>${esc(k.replaceAll("_"," "))}</small><b>${v}</b></article>`).join("")}
    </div></section>`;
  }
  function recentActions() {
    const actions=aggregateActions().filter(x=>x.finding.status!=="CLOSED").slice(0,6);
    return `<section class="card"><div class="pad"><h2>Priority actions</h2></div><div class="tablewrap"><table><thead><tr><th>School</th><th>Finding</th><th>Priority</th><th>Owner</th><th>Status</th></tr></thead><tbody>${actions.length?actions.map(x=>`<tr><td>${esc(x.school?.name||x.report.schoolId)}</td><td>${esc(x.finding.finding||x.finding.recommendation||"Action needed")}</td><td>${pill(x.finding.priority||x.finding.severity||"—", ["HIGH","CRITICAL"].includes(x.finding.priority||x.finding.severity)?"alert":"")}</td><td>${esc(x.finding.owner||"—")}</td><td>${pill(x.finding.status||"OPEN")}</td></tr>`).join(""):`<tr><td colspan="5" class="empty">No open actions.</td></tr>`}</tbody></table></div></section>`;
  }
  function render() {
    const host=UI.$("#dashboard"); const state=UI.snapshot(host); UI.reset();
    const db=P10354.load(); const reports=Object.values(db.reports); const stats=overallStats(reports);
    host.innerHTML=[`<div class="heading"><div><h1>Project Command Centre</h1><p>${esc(F.meta.assessor)} · ${esc(F.meta.client)} · Project ${esc(F.meta.project)}</p></div><div class="actions"><a class="btn secondary" href="programme.html?tab=reconciliation">Reconciliation</a><a class="btn large" href="school-assessment.html">Start school assessment</a></div></div>`,commandCentre(stats),metrics(stats),regionTable(),actionSummary(),recentActions()].join("");
    UI.wire(host); UI.restore(state,host);
  }
  (async () => { if (!(await UI.gateAuth())) return; UI.chrome(); render(); })();
})();

/* ============================================================================
   Programme workbook — the region-level sheets of the assessment checklist
   that sit above any single school: reconciliation, baseline-to-now, activity
   verification, OECD-DAC, stakeholders, data quality, VFM, sustainability,
   learning, the report evidence map and the Team Leader end-of-field summary.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, field, button, recordCard, register, tabs, notice, pill, ratingPill } = UI;

  const params = new URLSearchParams(location.search);
  const REGION_SESSION_KEY = "p10354-programme-region";

  function canonicalRegionId(value) {
    const raw = String(value || "").trim().toUpperCase();
    if (!raw) return F.regions.find((r) => r.active)?.id || F.regions[0].id;
    const byId = F.regions.find((r) => r.id === raw);
    if (byId) return byId.id;
    const byName = F.regions.find((r) => r.name.toUpperCase() === raw);
    return byName ? byName.id : (F.regions.find((r) => r.active)?.id || F.regions[0].id);
  }

  function readStoredRegion() {
    try { return sessionStorage.getItem(REGION_SESSION_KEY); } catch { return null; }
  }

  function persistRegion(value) {
    try { sessionStorage.setItem(REGION_SESSION_KEY, value); } catch {}
  }

  const initialRegion = canonicalRegionId(params.get("region") || readStoredRegion());
  let regionId = initialRegion;
  persistRegion(regionId);
  let tab = params.get("tab") || "reconciliation";

  const region = () => F.regions.find((r) => r.id === regionId) || F.regions.find((r) => r.active) || F.regions[0];

  /* Live instances, for the same reason as the school report: the form mutates
     an object and then commits it, so it must be the object storage holds. */
  let currentProgramme = null;
  let currentProject = null;

  function record() {
    if (!currentProgramme || currentProgramme.regionId !== regionId) currentProgramme = P10354.getProgramme(regionId);
    return currentProgramme;
  }

  function project() {
    if (!currentProject) currentProject = P10354.getProject();
    return currentProject;
  }

  function commit(event) {
    P10354.putProgramme(record(), event, "Team Leader");
    render();
  }

  function commitProject(event) {
    P10354.putProject(project(), event, "Team Leader");
    render();
  }

  function syncUrl() {
    persistRegion(regionId);
    history.replaceState({}, "", `programme.html?region=${encodeURIComponent(regionId)}&tab=${encodeURIComponent(tab)}`);
  }

  /* --- Header ------------------------------------------------------------- */
  function header(p, stats) {
    const rollup = Scoring.regionRollup(regionId);
    const r = region();
    return `
      <div class="heading">
        <div><h1>Programme workbook — ${esc(r.name)}</h1>
          <p>Region-level verification, reconciliation and reporting. Last saved ${new Date(p.updatedAt).toLocaleString()}.</p></div>
        <div class="actions">${r.active ? pill("Active region") : pill("Inactive region", "alert")}
          ${r.rosterStatus === "UNCONFIRMED" ? pill("Roster unconfirmed", "alert") : pill("Roster confirmed")}</div>
      </div>
      <section class="card pad">
        <div class="fieldgrid">
          ${field({ label: "Region", type: "select", value: regionId,
            options: F.regions.map((x) => ({ value: x.id, label: `${x.name}${x.active ? "" : " (inactive)"}` })),
            onChange: (v) => {
              const nextRegion = canonicalRegionId(v);
              if (nextRegion === regionId) return;
              regionId = nextRegion;
              currentProgramme = null;
              persistRegion(regionId);
              syncUrl();
              render();
              window.scrollTo(0, 0);
            } })}
        </div>
        <div class="summary">
          <span><b>Selected region:</b> ${esc(r.name)}</span>
          <span><b>${rollup.started}/${rollup.schools}</b> school reports started</span>
          <span><b>${rollup.submitted}</b> submitted</span>
          <span><b>${rollup.assessed}/${rollup.questions}</b> questions assessed</span>
          <span><b>${rollup.evidence}</b> evidence</span>
          <span class="${stats.reconciliationOpen ? "warn" : ""}"><b>${stats.reconciliationOpen}/${stats.reconciliationTotal}</b> project reconciliation items open</span>
          <span><b>${stats.gatesCleared}/${stats.gatesTotal}</b> gates cleared</span>
          <span class="${rollup.safetyRisks ? "warn" : ""}"><b>${rollup.safetyRisks}</b> accessibility safety risks</span>
        </div>
      </section>`;
  }

  /* --- Tab: data reconciliation -------------------------------------------
     Project-level, not regional: these are contradictions between the PPA,
     the kick-off materials and the proposal. Resolve once; every region
     reads the same agreed figure. ----------------------------------------- */
  function reconciliationTab() {
    const proj = project();
    const cards = F.reconciliation.map((item) => {
      const x = proj.reconciliation[item.id];
      const set = (key) => (value) => {
        x[key] = value;
        if (key === "status" && value === "RESOLVED") x.resolvedAt = P10354.now();
        commitProject(`Reconciliation ${item.id} updated`);
      };
      return recordCard({
        key: item.id,
        title: item.issue,
        subtitle: `${item.id} · ${x.status}`,
        chips: [pill(x.status === "RESOLVED" ? "Resolved" : "Open", x.status === "RESOLVED" ? "" : "alert")],
        context: [
          { label: "Source A", text: item.sourceA },
          { label: "Source B", text: item.sourceB },
          { label: "Why it matters", text: item.why },
          { label: "Required action before final conclusion", text: item.action },
        ],
        fields: [
          field({ label: "Status", type: "select", options: ["OPEN", "IN PROGRESS", "RESOLVED"], value: x.status, onChange: set("status") }),
          field({ label: "Resolved by (who confirmed)", value: x.resolvedBy, onChange: set("resolvedBy") }),
          field({ label: "Final agreed figure / wording", type: "textarea", value: x.agreed, wide: true, onChange: set("agreed") }),
        ],
      });
    }).join("");

    return cards;
  }

  /* --- Tab: baseline vs now ------------------------------------------------ */
  function baselineTab(p) {
    const cards = F.baselineIndicators.map((b) => {
      const x = p.baseline[b.id];
      const set = (key) => (value) => { x[key] = value; commit(`Baseline ${b.id} updated`); };
      return recordCard({
        key: b.id,
        title: b.name,
        subtitle: `${b.id} · ${x.judgement || "no judgement recorded"}`,
        chips: [x.judgement ? pill(x.judgement) : pill("Pending")],
        context: [
          { label: "Feasibility baseline / starting point", text: b.baseline },
          { label: "Approved target", text: b.target },
        ],
        fields: [
          field({ label: "Current value / status", value: x.current, onChange: set("current") }),
          field({ label: "Change since baseline", value: x.change, onChange: set("change") }),
          field({ label: "Source of current data", value: x.sourceCurrent, onChange: set("sourceCurrent") }),
          field({ label: "Triangulated?", type: "select", options: F.scales.yesNo, value: x.triangulated, onChange: set("triangulated") }),
          field({ label: "Achievement judgement", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.judgement, onChange: set("judgement") }),
          field({ label: "What explains the change?", type: "textarea", value: x.explains, onChange: set("explains") }),
          field({ label: "Evidence limitation", type: "textarea", value: x.limitation, onChange: set("limitation") }),
        ],
      });
    }).join("");

    return cards;
  }

  /* --- Tab: activity verification ------------------------------------------ */
  function activitiesTab(p) {
    const cards = F.activities.map((a) => {
      const x = p.activities[a.id];
      const set = (key) => (value) => { x[key] = value; commit(`Activity ${a.id} verification updated`); };
      return recordCard({
        key: a.id,
        title: a.name,
        subtitle: `${a.id} · ${a.timing}`,
        chips: [x.grade ? pill(x.grade) : pill("Not graded"), ratingPill(x.achievement)],
        context: [
          { label: "Planned timing", text: a.timing },
          { label: "What should exist by now", text: a.expected },
          { label: "CST reported", text: a.reported },
          { label: "How to test the claim", text: a.verify },
        ],
        fields: [
          field({ label: "What did the team report?", type: "textarea", value: x.reported, onChange: set("reported") }),
          field({ label: "What did we verify?", type: "textarea", value: x.verified, onChange: set("verified") }),
          field({ label: "Quality / fidelity", type: "textarea", value: x.fidelity, onChange: set("fidelity") }),
          field({ label: "Immediate change", type: "textarea", value: x.immediateChange, onChange: set("immediateChange") }),
          field({ label: "Contribution to result", type: "textarea", value: x.contribution, onChange: set("contribution") }),
          field({ label: "Delayed / missed? Why?", type: "textarea", value: x.delay, onChange: set("delay") }),
          field({ label: "Evidence", type: "textarea", value: x.evidence, onChange: set("evidence") }),
          field({ label: "Achievement (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.achievement, onChange: set("achievement") }),
          field({ label: "Grade", type: "select", options: [{ value: "", label: "—" }, ...F.scales.grade], value: x.grade, onChange: set("grade") }),
          field({ label: "Follow-up", type: "textarea", value: x.followUp, onChange: set("followUp") }),
        ],
      });
    }).join("");

    const exportRow = button("Export reconstruction matrix (CSV)", () => {
      const headers = ["Activity ID", "Activity", "Planned timing", "What should exist by now", "CST reported claim",
        "Team's reported figure", "What we verified", "Quality / fidelity", "Immediate change", "Contribution",
        "Delayed / missed", "Evidence", "Achievement", "Grade", "Follow-up"];
      const rows = F.activities.map((a) => {
        const x = p.activities[a.id];
        return [a.id, a.name, a.timing, a.expected, a.reported, x.reported, x.verified, x.fidelity, x.immediateChange,
          x.contribution, x.delay, x.evidence, x.achievement, x.grade, x.followUp];
      });
      UI.saveCsv(`P10354_ActivityReconstruction_${regionId}`, UI.toCsv(headers, rows));
    }, "btn secondary");

    return `<section class="card pad"><div class="section-head">
        <div><h2>Activity verification</h2></div>
        <div class="actions">${exportRow}</div></div></section>${cards}`;
  }

  /* --- Tab: OECD-DAC ------------------------------------------------------- */
  function dacTab(p) {
    return F.dacCriteria.map((c) => {
      const x = p.dac[c.id];
      const set = (key) => (value) => { x[key] = value; commit(`${c.name} review updated`); };
      return recordCard({
        key: c.id,
        title: c.name,
        subtitle: `${c.id}${x.rating ? ` · rating ${x.rating}/5` : ""}`,
        chips: [x.rating ? pill(`Rating ${x.rating}`) : pill("Not rated"), x.strength ? pill(x.strength) : ""],
        context: [
          { label: "Assessment question", text: c.question },
          { label: "Evidence to seek", text: c.evidence },
          { label: "Stakeholders / records", text: c.sources },
        ],
        fields: [
          field({ label: "Rating (1-5)", type: "select", options: ["", "1", "2", "3", "4", "5"], value: x.rating, onChange: set("rating") }),
          field({ label: "Evidence strength", type: "select", options: F.scales.evidenceStrength, value: x.strength, onChange: set("strength") }),
          field({ label: "Finding", type: "textarea", value: x.finding, onChange: set("finding") }),
          field({ label: "Recommendation", type: "textarea", value: x.recommendation, onChange: set("recommendation") }),
          field({ label: "Report-ready conclusion", type: "textarea", value: x.conclusion, onChange: set("conclusion") }),
        ],
      });
    }).join("");
  }

  /* --- Tab: stakeholders --------------------------------------------------- */
  function stakeholdersTab(p) {
    return F.stakeholders.map((s) => {
      const x = p.stakeholders[s.id];
      const set = (key) => (value) => { x[key] = value; commit(`${s.name} engagement updated`); };
      return recordCard({
        key: s.id,
        title: s.name,
        subtitle: `${s.id} · ${s.role}`,
        chips: [ratingPill(x.rating)],
        context: [{ label: "Expected role / engagement", text: s.role }],
        fields: [
          field({ label: "Evidence of engagement", type: "textarea", value: x.evidence, onChange: set("evidence") }),
          field({ label: "What changed because of engagement?", type: "textarea", value: x.changed, onChange: set("changed") }),
          field({ label: "Commitment / decision obtained", type: "textarea", value: x.commitment, onChange: set("commitment") }),
          field({ label: "Budget / resource commitment", value: x.budget, onChange: set("budget") }),
          field({ label: "Follow-up required", type: "textarea", value: x.followUp, onChange: set("followUp") }),
          field({ label: "Rating (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.rating, onChange: set("rating") }),
          field({ label: "Key message for report", type: "textarea", value: x.message, onChange: set("message") }),
        ],
      });
    }).join("");
  }

  /* --- Tab: sustainability -------------------------------------------------- */
  function sustainabilityTab(p) {
    return `${F.sustainabilityAssets.map((a) => {
        const x = p.sustainability[a.id];
        const set = (key) => (value) => { x[key] = value; commit(`${a.name} sustainability updated`); };
        return recordCard({
          key: a.id,
          title: a.name,
          subtitle: `${a.id}${x.rating ? ` · sustainability ${x.rating}/5` : ""}`,
          chips: [x.rating ? pill(`Rating ${x.rating}`) : pill("Not rated"), x.dependent === "YES" ? pill("CST/CBM dependent", "alert") : ""],
          fields: [
            field({ label: "Current owner", value: x.owner, onChange: set("owner") }),
            field({ label: "Who pays after project?", value: x.payer, onChange: set("payer") }),
            field({ label: "Who maintains it?", value: x.maintainer, onChange: set("maintainer") }),
            field({ label: "Skills remain locally?", type: "select", options: F.scales.yesNo, value: x.skillsLocal, onChange: set("skillsLocal") }),
            field({ label: "In government plan/budget?", type: "select", options: F.scales.yesNo, value: x.inGovtPlan, onChange: set("inGovtPlan") }),
            field({ label: "Dependent on CST/CBM?", type: "select", options: F.scales.yesNo, value: x.dependent, onChange: set("dependent") }),
            field({ label: "Exit action already started?", type: "select", options: F.scales.yesNo, value: x.exitStarted, onChange: set("exitStarted") }),
            field({ label: "Sustainability rating (1-5)", type: "select", options: ["", "1", "2", "3", "4", "5"], value: x.rating, onChange: set("rating") }),
            field({ label: "Evidence / concern", type: "textarea", value: x.evidence, onChange: set("evidence") }),
          ],
        });
      }).join("")}`;
  }

  /* --- Tab: learning -------------------------------------------------------- */
  function learningTab(p) {
    return F.learningAreas.map((l) => {
      const x = p.learning[l.id];
      const set = (key) => (value) => { x[key] = value; commit(`${l.name} learning updated`); };
      return recordCard({
        key: l.id,
        title: l.name,
        subtitle: `${l.id}${x.adapt === "YES" ? " · adaptation recommended before 2027" : ""}`,
        chips: [x.priority ? pill(x.priority) : "", x.negative ? pill("Risk noted", "alert") : ""],
        fields: [
          field({ label: "What did the project learn?", type: "textarea", value: x.learned, onChange: set("learned") }),
          field({ label: "What changed in implementation because of learning?", type: "textarea", value: x.changed, onChange: set("changed") }),
          field({ label: "Unexpected positive change", type: "textarea", value: x.positive, onChange: set("positive") }),
          field({ label: "Unexpected negative change / risk", type: "textarea", value: x.negative, onChange: set("negative") }),
          field({ label: "Evidence", type: "textarea", value: x.evidence, onChange: set("evidence") }),
          field({ label: "Who identified it?", value: x.identifiedBy, onChange: set("identifiedBy") }),
          field({ label: "Should the project adapt before 2027?", type: "select", options: F.scales.yesNo, value: x.adapt, onChange: set("adapt") }),
          field({ label: "Priority", type: "select", options: ["", ...F.scales.priority], value: x.priority, onChange: set("priority") }),
          field({ label: "Recommendation", type: "textarea", value: x.recommendation, onChange: set("recommendation") }),
        ],
      });
    }).join("");
  }

  /* --- Tab: budget & VFM ---------------------------------------------------- */
  function vfmTab(p) {
    const frame = `<section class="card">
      <div class="pad"><h2>Documented financial frame</h2></div>
      <div class="tablewrap"><table><thead><tr><th>Item</th><th>Value</th><th>Source</th></tr></thead>
        <tbody>${F.vfm.frame.map((f) => `<tr><td>${esc(f.item)}</td><td><b>${esc(f.value)}</b></td><td>${esc(f.source)}</td></tr>`).join("")}</tbody>
      </table></div></section>`;

    const questions = F.vfm.questions.map((q) => {
      const x = p.vfm[q.id];
      const set = (key) => (value) => { x[key] = value; commit(`${q.id} VFM finding updated`); };
      return recordCard({
        key: q.id,
        title: q.question,
        subtitle: q.id,
        chips: [x.finding ? pill("Answered") : pill("Open")],
        context: [{ label: "Evidence to seek", text: q.evidence }],
        fields: [
          field({ label: "Finding", type: "textarea", value: x.finding, onChange: set("finding") }),
          field({ label: "VFM implication", type: "textarea", value: x.implication, onChange: set("implication") }),
          field({ label: "Recommendation", type: "textarea", value: x.recommendation, onChange: set("recommendation") }),
        ],
      });
    }).join("");

    return `${frame}${questions}`;
  }

  /* --- Tab: data quality & evidence map ------------------------------------ */
  function dataQualityTab(p) {
    return `
      ${register({
        title: "MEL data quality",
        addLabel: "Add claim",
        columns: F.registers.dataQuality,
        rows: p.dataQuality,
        rowLabel: (row, i) => row.claim ? row.claim.slice(0, 60) : `Claim ${i + 1}`,
        onAdd: () => { p.dataQuality.push({}); commit("Data quality claim added"); },
        onChange: (i, key, value) => { p.dataQuality[i][key] = value; commit("Data quality claim updated"); },
        onRemove: (i) => { p.dataQuality.splice(i, 1); commit("Data quality claim removed"); },
      })}
      ${register({
        title: "Report evidence map",
        addLabel: "Add conclusion",
        columns: F.registers.evidenceMap,
        rows: p.evidenceMap,
        rowLabel: (row, i) => row.conclusion ? row.conclusion.slice(0, 60) : `Conclusion ${i + 1}`,
        onAdd: () => { p.evidenceMap.push({ confidence: "" }); commit("Evidence map entry added"); },
        onChange: (i, key, value) => { p.evidenceMap[i][key] = value; commit("Evidence map entry updated"); },
        onRemove: (i) => { p.evidenceMap.splice(i, 1); commit("Evidence map entry removed"); },
      })}`;
  }

  /* --- Tab: delivery (deliverables & gates) -------------------------------- */
  function deliveryTab(p) {
    const setD = (id, key) => (value) => { p.deliverables[id][key] = value; commit(`Deliverable ${id} updated`); };
    const setG = (id, key) => (value) => { p.gates[id][key] = value; commit(`Gate ${id} updated`); };

    return `
      <section class="card pad">
        <h2>Readiness gates</h2>
        ${F.gates.map((g) => {
          const x = p.gates[g.id];
          return `<div class="register-row">
            <div class="register-head"><b>${esc(g.name)}</b>${pill(x.status, x.status === "CLEARED" ? "" : "alert")}</div>
            <div class="fieldgrid">
              ${field({ label: "Planned", value: g.when, locked: true })}
              ${field({ label: "Status", type: "select", options: ["NOT CLEARED", "IN PROGRESS", "CLEARED"], value: x.status, onChange: setG(g.id, "status") })}
              ${field({ label: "Date cleared", type: "date", value: x.date, onChange: setG(g.id, "date") })}
              ${field({ label: "Note", value: x.note, onChange: setG(g.id, "note") })}
            </div></div>`;
        }).join("")}
      </section>
      <section class="card pad">
        <h2>Deliverables</h2>
        ${F.deliverables.map((d) => {
          const x = p.deliverables[d.id];
          return `<div class="register-row">
            <div class="register-head"><b>${esc(d.id)} · ${esc(d.name)}</b>${pill(x.status)}</div>
            <div class="fieldgrid">
              ${field({ label: "Due", value: d.due, locked: true })}
              ${field({ label: "Status", type: "select", options: ["NOT STARTED", "IN PROGRESS", "SUBMITTED", "ACCEPTED"], value: x.status, onChange: setD(d.id, "status") })}
              ${field({ label: "Date", type: "date", value: x.date, onChange: setD(d.id, "date") })}
              ${field({ label: "Note", value: x.note, onChange: setD(d.id, "note") })}
            </div></div>`;
        }).join("")}
      </section>`;
  }

  /* --- Tab: Team Leader summary -------------------------------------------- */
  function summaryTab(p, stats) {
    const set = (id) => (value) => { p.teamLeaderSummary[id] = value; commit("Team Leader summary updated"); };
    const blocked = stats.reconciliationOpen > 0;

    return `
      ${blocked ? notice(`${stats.reconciliationOpen} reconciliation item(s) still open.`, "red") : ""}
      <section class="card pad">
        <div class="section-head">
          <div><h2>End-of-field summary — ${esc(region().name)}</h2></div>
          <div class="actions">${button("Export summary (CSV)", () => {
            UI.saveCsv(`P10354_TeamLeaderSummary_${regionId}`,
              UI.toCsv(["Field", "Content"], F.teamLeaderSummary.map((f) => [f.label, p.teamLeaderSummary[f.id] || ""])));
          }, "btn secondary")}</div>
        </div>
        ${F.teamLeaderSummary.map((f) => field({
          label: f.label, type: f.long ? "textarea" : "text", wide: f.long,
          value: p.teamLeaderSummary[f.id] || "", onChange: set(f.id),
        })).join("")}
      </section>
      <details class="record" data-key="__method">
        <summary><div><h3>Verification layers</h3></div><div class="chips">${pill(`${F.architectureLayers.length} layers`)}</div></summary>
        <div class="record-body"><div class="tablewrap"><table>
          <thead><tr><th>Layer</th><th>Question</th><th>What counts as evidence</th><th>Not sufficient on its own</th></tr></thead>
          <tbody>${F.architectureLayers.map((l) => `<tr>
            <td><b>${esc(l.name)}</b></td><td>${esc(l.question)}</td><td>${esc(l.evidence)}</td><td>${esc(l.insufficient)}</td></tr>`).join("")}</tbody>
        </table></div></div>
      </details>
      <details class="record" data-key="__sources">
        <summary><div><h3>Source documents</h3></div><div class="chips">${pill(`${F.sourceNotes.length} sources`)}</div></summary>
        <div class="record-body">${F.sourceNotes.map((s) => `<p><b>${esc(s.source)}:</b> ${esc(s.note)}</p>`).join("")}</div>
      </details>`;
  }

  /* --- Render --------------------------------------------------------------- */
  const TABS = [
    { id: "reconciliation", label: "Data reconciliation" },
    { id: "baseline", label: "Baseline vs now" },
    { id: "activities", label: "Activity verification" },
    { id: "dac", label: "OECD-DAC review" },
    { id: "stakeholders", label: "Stakeholder engagement" },
    { id: "sustainability", label: "Sustainability & exit" },
    { id: "learning", label: "Learning & change" },
    { id: "vfm", label: "Budget & VFM" },
    { id: "quality", label: "Data quality & evidence map" },
    { id: "delivery", label: "Deliverables & gates" },
    { id: "summary", label: "Team Leader summary" },
  ];

  function render() {
    const host = UI.$("#programme");
    const state = UI.snapshot(host);
    UI.reset();
    const p = record();
    const stats = Scoring.programmeStats(p);

    const body = {
      reconciliation: () => reconciliationTab(),
      baseline: () => baselineTab(p),
      activities: () => activitiesTab(p),
      dac: () => dacTab(p),
      stakeholders: () => stakeholdersTab(p),
      sustainability: () => sustainabilityTab(p),
      learning: () => learningTab(p),
      vfm: () => vfmTab(p),
      quality: () => dataQualityTab(p),
      delivery: () => deliveryTab(p),
      summary: () => summaryTab(p, stats),
    }[tab] || (() => reconciliationTab());

    host.innerHTML = [
      header(p, stats),
      tabs(TABS.map((t) => ({ ...t, badge: t.id === "reconciliation" ? (stats.reconciliationOpen || null) : null })),
        tab, (id) => { tab = id; syncUrl(); render(); window.scrollTo(0, 0); }),
      `<div class="tabbody">${body()}</div>`,
    ].join("");

    UI.wire(host);
    UI.restore(state, host);
  }

    (async () => {
    if (!(await UI.gateAuth())) return;
    UI.chrome();
  render();
  })();
})();

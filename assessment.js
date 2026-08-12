/* ============================================================================
   School assessment — one school, one consolidated report.
   Tabs follow the assessment checklist workbook so a field team moving between
   the spreadsheet and this system finds the same structure in the same order.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, field, button, recordCard, register, tabs, notice, pill, ratingPill } = UI;

  const params = new URLSearchParams(location.search);
  let schoolId = params.get("school") || P10354.schoolsInScope()[0]?.id || P10354.schools[0].id;
  let role = params.get("role") === "leader" ? "TEAM_LEADER"
    : params.get("role") === "a2" ? "AUDITOR_2" : "AUDITOR_1";
  let tab = params.get("tab") || "profile";

  const LOCKED_STATUSES = ["SUBMITTED", "UNDER REVIEW", "QA APPROVED", "FINALIZED"];

  const school = () => P10354.school(schoolId);
  const settings = () => P10354.load().settings;

  /* One live report instance per school. Every P10354.getReport() call parses
     a fresh object out of localStorage, so the form must mutate and commit the
     same instance — otherwise an edit is written to a copy and thrown away. */
  let current = null;
  function report() {
    if (!current || current.schoolId !== schoolId) current = P10354.getReport(schoolId);
    return current;
  }
  const isLeader = () => role === "TEAM_LEADER";
  const actor = () => (isLeader() ? "Team Leader" : role === "AUDITOR_2" ? "Field Auditor 2" : "Field Auditor 1");

  function userOptions(current, roleFilter) {
    const list = P10354.users().filter((u) => u.active && (!roleFilter || u.role === roleFilter));
    return [{ value: "", label: "Select team member" },
      ...list.map((u) => ({ value: u.id, label: `${u.name || u.username} · ${u.role}` }))];
  }

  function commit(event) {
    P10354.putReport(report(), event, actor());
    render();
  }

  function setStatusFromEdit(r) {
    if (r.status === "DRAFT") r.status = "IN PROGRESS";
  }

  /* --- Header ------------------------------------------------------------- */
  function header(r, s, stats, locked) {
    const schoolChoices = P10354.schools.map((x) => ({
      value: x.id, label: `${x.region} · ${x.name}${x.rosterStatus === "UNCONFIRMED" ? " (unconfirmed)" : ""}`,
    }));
    return `
      <div class="heading">
        <div>
          <h1>${esc(s.name)}</h1>
          <p>${esc(s.region)} · ${esc(s.council)} · ${esc(s.ward)}<br>
             Report <b>${esc(r.id)}</b> · version ${r.version} · last saved ${new Date(r.updatedAt).toLocaleString()}</p>
        </div>
        <div class="actions">${pill(r.status)}${locked ? pill("Locked", "alert") : ""}</div>
      </div>
      <section class="card pad">
        <div class="fieldgrid">
          ${field({ label: "School", type: "select", options: schoolChoices, value: schoolId,
            onChange: (v) => { schoolId = v; syncUrl(); render(); } })}
          ${field({ label: "Working as", type: "select", value: role,
            options: [{ value: "AUDITOR_1", label: "Field Auditor 1" }, { value: "AUDITOR_2", label: "Field Auditor 2" }, { value: "TEAM_LEADER", label: "Team Leader / Reviewer" }],
            onChange: (v) => { role = v; syncUrl(); render(); } })}
          <div class="field">
            <span>Verification progress</span>
            <div class="progress"><i style="width:${stats.percent}%"></i></div>
            <small class="help">${stats.assessed}/${stats.questions - stats.na} assessed · ${stats.evidenceCount} evidence</small>
          </div>
        </div>
        <div class="summary">
          <span><b>${stats.assessed}</b> assessed</span>
          <span><b>${stats.notAssessed}</b> not assessed</span>
          <span><b>${stats.followUp}</b> follow-up</span>
          <span><b>${stats.accessTested}/${stats.accessAreas}</b> accessibility areas re-tested</span>
          <span><b>${stats.cases}</b> child cases</span>
          <span><b>${stats.interviews}</b> interviews</span>
          <span class="${stats.disputes ? "warn" : ""}"><b>${stats.disputes}</b> auditor discrepancies</span>
          <span class="${stats.underTriangulated ? "warn" : ""}"><b>${stats.underTriangulated}</b> under-triangulated</span>
        </div>
      </section>`;
  }

  function syncUrl() {
    const roleParam = role === "TEAM_LEADER" ? "leader" : role === "AUDITOR_2" ? "a2" : "a1";
    history.replaceState({}, "", `school-assessment.html?school=${schoolId}&role=${roleParam}&tab=${tab}`);
  }

  /* --- Tab: profile ------------------------------------------------------- */
  function profileTab(r, s, locked) {
    const set = (key) => (value) => { r.profile[key] = value; setStatusFromEdit(r); commit("School profile updated"); };
    const setTeam = (key) => (value) => { r.team[key] = value; commit("Assessment team updated"); };

    return `
      <section class="card pad">
        <h2>Assessment team</h2>
        <div class="fieldgrid">
          ${field({ label: "Field Agent completing the report", type: "select", options: userOptions(r.team.fieldAgent), value: r.team.fieldAgent, locked, onChange: setTeam("fieldAgent") })}
          ${field({ label: "Auditor 1", type: "select", options: userOptions(r.team.auditor1), value: r.team.auditor1, locked, onChange: setTeam("auditor1") })}
          ${field({ label: "Auditor 2", type: "select", options: userOptions(r.team.auditor2), value: r.team.auditor2, locked, onChange: setTeam("auditor2") })}
          ${field({ label: "Team Leader / Reviewer", type: "select", options: userOptions(r.team.teamLeader), value: r.team.teamLeader, locked, onChange: setTeam("teamLeader") })}
          ${field({ label: "Safeguarding lead on this visit", type: "select", options: userOptions(r.team.safeguardingLead), value: r.team.safeguardingLead, locked, onChange: setTeam("safeguardingLead") })}
        </div>
      </section>

      <section class="card pad">
        <h2>School profile</h2>
        <div class="fieldgrid">
          ${field({ label: "Head teacher", value: r.profile.headTeacher, locked, onChange: set("headTeacher") })}
          ${field({ label: "Project focal person", value: r.profile.focalPerson, locked, onChange: set("focalPerson") })}
          ${field({ label: "School committee (chair / contact)", value: r.profile.schoolCommittee, locked, onChange: set("schoolCommittee") })}
          ${field({ label: "Teachers (total)", type: "number", value: r.profile.teachersTotal, locked, onChange: set("teachersTotal") })}
          ${field({ label: "Teachers trained in inclusive education", type: "number", value: r.profile.teachersTrainedIE, locked, onChange: set("teachersTrainedIE") })}
          ${field({ label: "Learners (total)", type: "number", value: r.profile.learners, locked, onChange: set("learners") })}
          ${field({ label: "Learners with disabilities", type: "number", value: r.profile.learnersWithDisabilities, locked, onChange: set("learnersWithDisabilities") })}
          ${field({ label: "Of which girls", type: "number", value: r.profile.girlsWithDisabilities, locked, onChange: set("girlsWithDisabilities") })}
          ${field({ label: "GPS coordinates", value: r.profile.gps, placeholder: "-6.8235, 39.2695", locked, onChange: set("gps") })}
          ${field({ label: "Visit start date", type: "date", value: r.profile.visitDate, locked, onChange: set("visitDate") })}
          ${field({ label: "Visit end date", type: "date", value: r.profile.visitEndDate, locked, onChange: set("visitEndDate") })}
          ${field({ label: "School roster confirmed with district?", type: "select", options: F.scales.yesNo, value: r.profile.rosterConfirmed, locked, onChange: set("rosterConfirmed") })}
        </div>
        ${field({ label: "Roster / naming note", type: "textarea", value: r.profile.rosterNote, wide: true, locked, onChange: set("rosterNote") })}
      </section>

      <section class="card pad">
        <h2>2025 accessibility audit baseline</h2>
        ${UI.reference([
          { label: "Enrolment", text: s.pupils ? `${s.pupils} pupils (${s.pupilsMale} male, ${s.pupilsFemale} female)` : "" },
          { label: "Children with disabilities", text: s.learnersWithDisabilities ? `${s.learnersWithDisabilities} (${s.cwdMale} male, ${s.cwdFemale} female) · ${s.disabilityCategories}` : "" },
          { label: "Data note", text: s.dataNote },
          { label: "Name variant", text: s.nameVariant },
          { label: "ESRAC", text: s.esrac },
          { label: "Audit headline", text: s.auditHeadline },
          { label: "2025 baseline", text: s.baseline },
          { label: "Planned modification", text: s.plannedModification },
          { label: "Assessment focus", text: s.assessmentFocus },
        ])}
      </section>`;
  }

  /* --- Tab: results matrix ------------------------------------------------ */
  function resultsTab(r, locked) {
    const cards = F.results.map((res) => {
      const x = r.results[res.id];
      const set = (key) => (value) => { x[key] = value; x.updatedAt = P10354.now(); setStatusFromEdit(r); commit(`${res.id} results matrix updated`); };
      return recordCard({
        title: res.name,
        subtitle: `${res.id} · achievement ${x.achievement || "—"} · quality ${x.quality || "—"}`,
        chips: [ratingPill(x.achievement), ratingPill(x.quality)],
        locked,
        context: [
          { label: "What was intended", text: res.intent },
          { label: "Key indicators to verify", text: res.indicators },
          { label: "Project-level target", text: res.target },
          { label: "What to check in field", text: res.checkInField },
          { label: "Evidence to request", text: res.evidence },
        ],
        fields: [
          field({ label: "Regional target (confirm)", value: x.regionalTarget, locked, onChange: set("regionalTarget") }),
          field({ label: "Achievement (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.achievement, locked, onChange: set("achievement") }),
          field({ label: "Quality (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.quality, locked, onChange: set("quality") }),
          field({ label: "Evidence strength", type: "select", options: F.scales.evidenceStrength, value: x.evidenceStrength, locked, onChange: set("evidenceStrength") }),
          field({ label: "Key finding / gap", type: "textarea", value: x.finding, locked, onChange: set("finding") }),
          field({ label: "Recommendation", type: "textarea", value: x.recommendation, locked, onChange: set("recommendation") }),
          field({ label: "Contribution / attribution judgement", type: "textarea", value: x.contribution, locked, onChange: set("contribution") }),
          field({ label: "Sustainability / institutionalisation", type: "textarea", value: x.sustainability, locked, onChange: set("sustainability") }),
        ],
      });
    }).join("");

    return cards;
  }

  /* --- Tab: field verification -------------------------------------------- */
  function verificationTab(r, locked) {
    const grouped = F.results.map((res) => {
      const questions = F.fieldQuestions.filter((q) => q.result === res.id);
      if (!questions.length) return "";
      return `<section class="card pad group-head"><h2>${esc(res.name)}</h2></section>
        ${questions.map((q) => questionCard(r, q, locked)).join("")}`;
    }).join("");

    return grouped;
  }

  function questionCard(r, q, locked) {
    const x = r.fieldQuestions[q.id];
    const showA1 = role === "AUDITOR_1" || isLeader();
    const showA2 = role === "AUDITOR_2" || isLeader();
    const dispute = x.a1.grade && x.a2.grade && x.a1.grade !== x.a2.grade;

    const set = (key) => (value) => { x[key] = value; x.updatedAt = P10354.now(); setStatusFromEdit(r); commit(`${q.id} ${q.area} updated`); };
    const setPath = (branch, key) => (value) => { x[branch][key] = value; x.updatedAt = P10354.now(); setStatusFromEdit(r); commit(`${q.id} ${branch.toUpperCase()} assessment updated`); };
    const toggleStream = (streamId, on) => {
      const list = new Set(x.streams || []);
      on ? list.add(streamId) : list.delete(streamId);
      x.streams = [...list];
      setStatusFromEdit(r);
      commit(`${q.id} evidence streams updated`);
    };

    const auditorBlock = (branch, label) => `
      <section class="subcard">
        <h4>${label}</h4>
        <div class="fieldgrid">
          ${field({ label: "Auditor", type: "select", options: userOptions(x[branch].auditor), value: x[branch].auditor, locked, onChange: setPath(branch, "auditor") })}
          ${field({ label: "Verified achievement", value: x[branch].verified, locked, onChange: setPath(branch, "verified") })}
          ${field({ label: "Suggested grade", type: "select", options: [{ value: "", label: "—" }, ...F.scales.grade], value: x[branch].grade, locked, onChange: setPath(branch, "grade") })}
        </div>
        ${field({ label: "Observations", type: "textarea", value: x[branch].observations, wide: true, locked, onChange: setPath(branch, "observations") })}
      </section>`;

    const leaderBlock = `
      <section class="subcard leader">
        <h4>Team Leader final decision</h4>
        ${dispute ? notice(`Auditor 1 graded <b>${esc(x.a1.grade)}</b>; Auditor 2 graded <b>${esc(x.a2.grade)}</b>.`, "red") : ""}
        <div class="fieldgrid">
          ${field({ label: "Final verified achievement", value: x.final.verified, onChange: setPath("final", "verified") })}
          ${field({ label: "Final grade", type: "select", options: [{ value: "", label: "—" }, ...F.scales.grade], value: x.final.grade, onChange: setPath("final", "grade") })}
          ${field({ label: "Reviewer", type: "select", options: userOptions(x.final.reviewer), value: x.final.reviewer, onChange: setPath("final", "reviewer") })}
        </div>
        ${field({ label: "Reviewer rationale", type: "textarea", value: x.final.rationale, wide: true, onChange: setPath("final", "rationale") })}
      </section>`;

    return recordCard({
      title: q.question,
      subtitle: `${q.id} · ${q.area} · ${(x.evidence || []).length} evidence item(s) · ${(x.streams || []).length} stream(s)`,
      chips: [pill(x.status), x.final.grade ? pill(x.final.grade) : "", dispute ? pill("DISPUTED", "alert") : ""],
      locked,
      context: [{ label: "Planned target / standard", text: q.standard }],
      fields: [
        field({ label: "Assessment status", type: "select", options: F.scales.itemStatus, value: x.status, locked, onChange: set("status") }),
        field({ label: "Reported achievement (what the project claims)", value: x.reported, placeholder: "Keep reported separate from verified", locked, onChange: set("reported") }),
        field({ label: "Actual finding (what we verified)", value: x.actual, locked, onChange: set("actual") }),
        field({ label: "Evidence checked", value: x.evidenceChecked, locked, onChange: set("evidenceChecked") }),
        field({ label: "Source / respondent", value: x.source, locked, onChange: set("source") }),
        field({ label: "Achievement (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.achievement, locked, onChange: set("achievement") }),
        field({ label: "Quality (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.quality, locked, onChange: set("quality") }),
        field({ label: "Evidence streams used", type: "checks", options: F.evidenceStreams.map((s) => ({ value: s.id, label: s.name })), value: x.streams, locked, onChange: toggleStream }),
        field({ label: "Issue / cause", type: "textarea", value: x.issue, locked, onChange: set("issue") }),
        field({ label: "Effect on result", type: "textarea", value: x.effect, locked, onChange: set("effect") }),
        field({ label: "Recommendation", type: "textarea", value: x.recommendation, locked, onChange: set("recommendation") }),
        field({ label: "Photo / document reference", value: x.ref, locked, onChange: set("ref") }),
      ],
      extra: [
        evidenceBlock(r, x, `fieldQuestions.${q.id}`, locked),
        showA1 ? auditorBlock("a1", "Auditor 1 independent assessment") : "",
        showA2 ? auditorBlock("a2", "Auditor 2 independent assessment") : "",
        isLeader() ? leaderBlock : "",
      ].join(""),
    });
  }

  /* --- Evidence attachment block (shared by questions and accessibility) --- */
  function evidenceBlock(r, holder, pathLabel, locked) {
    if (locked) {
      return `<div class="evidence"><b>Evidence attached: ${holder.evidence.length}</b>
        ${holder.evidence.map((e) => `<div class="evidence-item"><span><b>${esc(e.name)}</b><small>${esc(e.description) || "No description"} · ${esc(e.status)}</small></span></div>`).join("")}</div>`;
    }
    const descId = UI.bind(() => {});
    const attach = (files, el) => {
      const description = el.closest(".evidence").querySelector("[data-desc]").value;
      (async () => {
        for (const file of files) {
          const entry = await P10354.putFile(file, { schoolId: r.schoolId, reportId: r.id, path: pathLabel, gps: r.profile.gps });
          entry.description = description;
          holder.evidence.push(entry);
        }
        setStatusFromEdit(r);
        commit(`Evidence attached to ${pathLabel}`);
      })();
    };
    return `
      <div class="evidence">
        <b>Evidence attached: ${holder.evidence.length}</b>
        <div class="fieldgrid">
          ${field({ label: "Take photo (geo-tagged by GPS on profile)", type: "file", onChange: attach })}
          ${field({ label: "Upload photo / document", type: "file", onChange: attach })}
          <label class="field"><span>Description for the next upload</span><input data-desc data-bind="${descId}" placeholder="Optional description"></label>
        </div>
        ${holder.evidence.map((e) => `
          <div class="evidence-item">
            <span><b>${esc(e.name)}</b><small>${esc(e.description) || "No description"} · ${esc(e.stream)} · ${esc(e.status)}</small></span>
            ${button("Detach", () => { holder.evidence = P10354.detachEvidence(holder.evidence, e.id); commit("Evidence reference detached"); }, "btn secondary small")}
          </div>`).join("")}
      </div>`;
  }

  /* Attach the camera capture attribute after render — the file control is
     built generically, and `capture` cannot be expressed through it. */
  function markCameraInputs(root) {
    UI.$$(".evidence .field", root).forEach((label) => {
      const input = label.querySelector('input[type="file"]');
      if (!input) return;
      if (label.textContent.includes("Take photo")) { input.accept = "image/*"; input.setAttribute("capture", "environment"); }
      else { input.multiple = true; input.accept = "image/*,.pdf,.doc,.docx,.xls,.xlsx,video/*,audio/*"; }
    });
  }

  /* --- Tab: accessibility retest ------------------------------------------ */
  function accessibilityTab(r, s, locked) {
    if (!(s.retest || []).length) {
      return `<section class="card"><p class="empty">No 2025 accessibility baseline on file for ${esc(s.name)}.</p></section>`;
    }
    const cards = s.retest.map((row) => {
      const x = r.accessibility[row.area];
      const set = (key) => (value) => { x[key] = value; x.updatedAt = P10354.now(); setStatusFromEdit(r); commit(`Accessibility retest updated: ${row.area}`); };
      return recordCard({
        title: row.area,
        subtitle: `${esc(s.name)} · ${x.accessibleInPractice || "not yet tested"}`,
        chips: [x.accessibleInPractice ? pill(x.accessibleInPractice) : pill("Not tested"),
          x.safetyRisk && x.safetyRisk !== "NO" ? pill("Safety risk", "alert") : ""],
        locked,
        context: [{ label: "2025 audit issue / recommendation", text: row.recommendation }],
        fields: [
          field({ label: "Current condition", type: "textarea", value: x.currentCondition, locked, onChange: set("currentCondition") }),
          field({ label: "Technical standard / usability check", type: "textarea", value: x.standardCheck, placeholder: "Measured gradient, widths, grab bars, signage…", locked, onChange: set("standardCheck") }),
          field({ label: "Accessible in practice?", type: "select", options: F.scales.yesNo, value: x.accessibleInPractice, locked, onChange: set("accessibleInPractice") }),
          field({ label: "Who tested / observed?", value: x.testedBy, placeholder: "Name the person who physically tested the route", locked, onChange: set("testedBy") }),
          field({ label: "Evidence now", value: x.evidenceNow, locked, onChange: set("evidenceNow") }),
          field({ label: "Achievement (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.achievement, locked, onChange: set("achievement") }),
          field({ label: "Quality (0-4/NV)", type: "select", options: [{ value: "", label: "—" }, ...F.scales.rating], value: x.quality, locked, onChange: set("quality") }),
          field({ label: "Safety risk", type: "select", options: ["", "NO", "LOW", "MEDIUM", "HIGH — immediate action"], value: x.safetyRisk, locked, onChange: set("safetyRisk") }),
          field({ label: "Action required", type: "textarea", value: x.action, locked, onChange: set("action") }),
        ],
        extra: evidenceBlock(r, x, `accessibility.${row.area}`, locked),
      });
    }).join("");

    /* Measurable thresholds from the 2025 audit, collapsed by default so the
       numbers are one tap away without sitting on top of the form. */
    const standards = `<details class="record" data-key="__standards">
        <summary><div><h3>Technical accessibility standards</h3></div>
          <div class="chips">${pill(`${F.accessibilityStandards.length} measures`)}</div></summary>
        <div class="record-body"><div class="tablewrap"><table>
          <thead><tr><th>Element</th><th>Required standard</th></tr></thead>
          <tbody>${F.accessibilityStandards.map((x) =>
            `<tr><td><b>${esc(x.area)}</b></td><td>${esc(x.standard)}</td></tr>`).join("")}</tbody>
        </table></div></div>
      </details>`;

    return `
      <section class="card pad">
        <div class="section-head">
          <div><h2>Accessibility retest</h2></div>
          <div class="actions">${button("Export CSV", () => exportAccessibility(r, s), "btn secondary")}</div>
        </div>
      </section>
      ${standards}
      ${cards}`;
  }

  function exportAccessibility(r, s) {
    const headers = ["School", "Area", "2025 audit issue / recommendation", "Current condition", "Technical standard / usability check",
      "Accessible in practice?", "Who tested / observed?", "Evidence now", "Achievement", "Quality", "Safety risk", "Action required"];
    const rows = s.retest.map((row) => {
      const x = r.accessibility[row.area];
      return [s.name, row.area, row.recommendation, x.currentCondition, x.standardCheck, x.accessibleInPractice,
        x.testedBy, x.evidenceNow, x.achievement, x.quality, x.safetyRisk, x.action];
    });
    UI.saveCsv(`P10354_AccessibilityRetest_${s.name}`, UI.toCsv(headers, rows));
  }

  /* --- Tab: child journey -------------------------------------------------- */
  function childJourneyTab(r, locked) {
    return `${register({
        title: "Child journey",
        addLabel: "Add case",
        columns: F.registers.childJourney,
        rows: r.childJourney,
        locked,
        rowLabel: (row, i) => row.caseId || `Case ${i + 1}`,
        onAdd: () => { r.childJourney.push({ caseId: `CASE-${String(r.childJourney.length + 1).padStart(3, "0")}` }); commit("Child journey case added"); },
        onChange: (i, key, value) => { r.childJourney[i][key] = value; setStatusFromEdit(r); commit("Child journey case updated"); },
        onRemove: (i) => { r.childJourney.splice(i, 1); commit("Child journey case removed"); },
      })}`;
  }

  /* --- Tab: interviews ----------------------------------------------------- */
  function interviewsTab(r, locked) {
    const consents = Object.values(P10354.load().consents).filter((c) => c.schoolId === r.schoolId);
    const cleared = consents.filter((c) => c.allowed && !c.withdrawn);

    const cards = r.interviews.map((iv, index) => {
      const set = (key) => (value) => { iv[key] = value; setStatusFromEdit(r); commit("Interview record updated"); };
      const setAnswer = (qid) => (value) => { iv.answers[qid] = value; setStatusFromEdit(r); commit("Interview response recorded"); };
      const consentOk = cleared.some((c) => c.id === iv.consentRef);
      return recordCard({
        title: `${iv.respondentType || "Respondent"} — ${iv.id}`,
        subtitle: `${iv.roleNote || "No role note"} · ${consentOk ? "consent verified" : "consent not linked"}`,
        chips: [consentOk ? pill("Consent OK") : pill("Consent missing", "alert"),
          iv.safeguardingConcern === "YES" ? pill("Safeguarding", "alert") : ""],
        locked,
        fields: [
          field({ label: "Respondent type", type: "select", options: ["", ...F.respondentTypes], value: iv.respondentType, locked, onChange: set("respondentType") }),
          field({ label: "Disability / role (optional, no names)", value: iv.roleNote, locked, onChange: set("roleNote") }),
          field({ label: "Linked consent record", type: "select", locked, value: iv.consentRef,
            options: [{ value: "", label: "Select a cleared consent record" }, ...cleared.map((c) => ({ value: c.id, label: `${c.id} · ${c.code} · ${c.type}` }))],
            onChange: set("consentRef") }),
          field({ label: "Safeguarding concern raised?", type: "select", options: ["", "NO", "YES"], value: iv.safeguardingConcern, locked, onChange: set("safeguardingConcern") }),
        ],
        extra: [
          consentOk ? "" : notice("No cleared consent is linked to this interview.", "red"),
          `<div class="fieldgrid">${F.interviewQuestions.map((q) => field({
            label: q.text, type: "textarea", value: iv.answers[q.id] || "", locked, wide: true, onChange: setAnswer(q.id),
          })).join("")}</div>`,
          field({ label: "Key change reported", type: "textarea", value: iv.keyChange || "", locked, wide: true, onChange: set("keyChange") }),
          field({ label: "Barrier still experienced", type: "textarea", value: iv.barrier || "", locked, wide: true, onChange: set("barrier") }),
          field({ label: "Observed / verified independently?", type: "select", options: F.scales.yesNo, value: iv.verified || "", locked, onChange: set("verified") }),
          locked ? "" : button("Remove interview", () => { r.interviews.splice(index, 1); commit("Interview removed"); }, "btn secondary small"),
        ].join(""),
      });
    }).join("");

    const addInterview = () => {
      r.interviews.push({
        id: `INT-${String(r.interviews.length + 1).padStart(3, "0")}`,
        respondentType: "", roleNote: "", consentRef: "", safeguardingConcern: "NO", answers: {},
      });
      commit("Interview record added");
    };

    return `
      <section class="card pad">
        <div class="section-head">
          <div><h2>Interviews and FGDs</h2><p class="help">${cleared.length} cleared consent record(s) for this school</p></div>
          <div class="actions">${locked ? "" : button("Add interview", addInterview, "btn secondary")}
            <a class="btn secondary" href="consent.html?school=${esc(r.schoolId)}">Record consent</a></div>
        </div>
      </section>
      ${r.interviews.length ? cards : `<section class="card"><p class="empty">No interviews recorded yet.</p></section>`}`;
  }

  /* --- Tab: evidence register --------------------------------------------- */
  function evidenceTab(r, locked) {
    const attached = [];
    Object.entries(r.fieldQuestions).forEach(([qid, x]) =>
      (x.evidence || []).forEach((e) => attached.push({ ...e, source: `${qid} verification` })));
    Object.entries(r.accessibility).forEach(([area, x]) =>
      (x.evidence || []).forEach((e) => attached.push({ ...e, source: `Accessibility · ${area}` })));

    const attachedTable = `<section class="card">
      <div class="pad"><h2>Files attached in this report</h2></div>
      <div class="tablewrap"><table><thead><tr><th>File</th><th>Attached to</th><th>Description</th><th>Stream</th><th>Sync</th><th>Captured</th></tr></thead>
      <tbody>${attached.length ? attached.map((e) => `<tr>
          <td><b>${esc(e.name)}</b><br><small>${Math.round((e.size || 0) / 1024)} KB</small></td>
          <td>${esc(e.source)}</td><td>${esc(e.description) || "—"}</td><td>${esc(e.stream)}</td>
          <td>${pill(e.status)}</td><td>${new Date(e.at).toLocaleString()}</td></tr>`).join("")
        : `<tr><td colspan="6" class="empty">No files attached yet.</td></tr>`}</tbody></table></div></section>`;

    return `${attachedTable}
      ${register({
        title: "Evidence register",
        addLabel: "Add evidence record",
        columns: F.registers.evidence,
        rows: r.evidenceRegister,
        locked,
        rowLabel: (row, i) => row.name || `Evidence ${i + 1}`,
        onAdd: () => { r.evidenceRegister.push({ consistency: "NOT CHECKED" }); commit("Evidence register entry added"); },
        onChange: (i, key, value) => { r.evidenceRegister[i][key] = value; setStatusFromEdit(r); commit("Evidence register updated"); },
        onRemove: (i) => { r.evidenceRegister.splice(i, 1); commit("Evidence register entry removed"); },
      })}`;
  }

  /* --- Tab: findings ------------------------------------------------------- */
  function findingsTab(r, locked) {
    const set = (key) => (value) => { r.narrative[key] = value; setStatusFromEdit(r); commit("Report narrative updated"); };
    return `
      ${register({
        title: "Findings and recommendations",
        addLabel: "Add finding",
        columns: F.registers.findings,
        rows: r.findings,
        locked,
        rowLabel: (row, i) => `${row.severity || "Finding"} ${i + 1}${row.result ? ` · ${row.result}` : ""}`,
        onAdd: () => { r.findings.push({ level: P10354.school(r.schoolId).name, status: "OPEN" }); commit("Finding added"); },
        onChange: (i, key, value) => { r.findings[i][key] = value; setStatusFromEdit(r); commit("Finding updated"); },
        onRemove: (i) => { r.findings.splice(i, 1); commit("Finding removed"); },
      })}
      <section class="card pad">
        <h2>Overall school conclusion</h2>
        ${field({ label: "Overall findings", type: "textarea", value: r.narrative.overall, wide: true, locked, onChange: set("overall") })}
        ${field({ label: "Recommendations / follow-up", type: "textarea", value: r.narrative.recommendations, wide: true, locked, onChange: set("recommendations") })}
        ${field({ label: "Evidence limitations", type: "textarea", value: r.narrative.limitations, wide: true, locked, onChange: set("limitations") })}
      </section>`;
  }

  /* --- Tab: debrief -------------------------------------------------------- */
  function debriefTab(r, locked) {
    return register({
      title: "Daily debrief",
      addLabel: "Add debrief",
      columns: F.registers.debrief,
      rows: r.debriefs,
      locked,
      rowLabel: (row, i) => row.date || `Debrief ${i + 1}`,
      onAdd: () => { r.debriefs.push({ date: new Date().toISOString().slice(0, 10), location: P10354.school(r.schoolId).name }); commit("Daily debrief added"); },
      onChange: (i, key, value) => { r.debriefs[i][key] = value; commit("Daily debrief updated"); },
      onRemove: (i) => { r.debriefs.splice(i, 1); commit("Daily debrief removed"); },
    });
  }

  /* --- Tab: submit / history ---------------------------------------------- */
  function submitTab(r, s) {
    const { stats, checks, blocked } = Scoring.submissionChecks(r, s, settings());
    const locked = LOCKED_STATUSES.includes(r.status);

    const actions = [];
    if (!locked) actions.push(button("Save draft", () => { if (r.status !== "SUBMITTED") r.status = "DRAFT"; commit("Draft saved locally"); }, "btn secondary"));
    if (!locked) actions.push(button("Submit school report", () => {
      if (blocked) return;
      r.status = "SUBMITTED"; r.submittedAt = P10354.now(); r.version += 1;
      commit("School report submitted");
    }, `btn large ${blocked ? "disabled" : ""}`));
    if (isLeader()) {
      actions.push(button("Return for clarification", () => {
        r.status = "REQUIRES CLARIFICATION"; r.version += 1; commit("Returned for clarification");
      }, "btn secondary"));
      actions.push(button("QA approve", () => {
        if (blocked) return;
        r.status = "QA APPROVED"; commit("QA approved");
      }, `btn ${blocked ? "disabled" : ""}`));
    }

    return `
      <section class="card pad">
        <div class="section-head">
          <div><h2>Submission review</h2></div>
          <div class="actions">${actions.join("")}${button("Export school report (CSV)", () => exportReport(r, s), "btn secondary")}</div>
        </div>
        <div class="summary">
          <span><b>${stats.assessed}/${stats.questions - stats.na}</b> assessed</span>
          <span><b>${stats.resultsScored}/${stats.results}</b> results scored</span>
          <span><b>${stats.accessTested}/${stats.accessAreas}</b> accessibility re-tested</span>
          <span><b>${stats.evidenceCount}</b> evidence</span>
          <span><b>${stats.findings}</b> findings (${stats.criticalFindings} high/critical)</span>
        </div>
        ${checks.length
          ? `<div class="notice ${blocked ? "red" : ""}"><ul>${checks.map((c) =>
              `<li>${c.blocking ? "<b>[Blocking]</b> " : ""}${esc(c.text)}</li>`).join("")}</ul></div>`
          : notice("All checks passed.", "green")}
      </section>
      <section class="card pad">
        <h2>Version history</h2>
        <div class="history">${r.history.slice(0, 25).map((h) =>
          `<p><b>${new Date(h.at).toLocaleString()}</b> · ${esc(h.event)} <span class="help">by ${esc(h.actor)}</span></p>`).join("")}</div>
      </section>`;
  }

  function exportReport(r, s) {
    const headers = ["Assessment ID", "School", "Region", "Result", "Area", "Assessment question", "Planned target / standard",
      "Reported achievement", "Actual finding", "Evidence checked", "Source / respondent", "Achievement", "Quality",
      "Status", "Evidence streams", "Auditor 1 grade", "Auditor 2 grade", "Final grade", "Reviewer rationale",
      "Issue / cause", "Effect on result", "Recommendation", "Photo / document reference"];
    const rows = F.fieldQuestions.map((q) => {
      const x = r.fieldQuestions[q.id];
      return [q.id, s.name, s.region, q.result, q.area, q.question, q.standard, x.reported, x.actual, x.evidenceChecked,
        x.source, x.achievement, x.quality, x.status, (x.streams || []).join(" + "), x.a1.grade, x.a2.grade,
        x.final.grade, x.final.rationale, x.issue, x.effect, x.recommendation, x.ref];
    });
    UI.saveCsv(`P10354_FieldAssessment_${s.name}`, UI.toCsv(headers, rows));
  }

  /* --- Render ------------------------------------------------------------- */
  const TABS = [
    { id: "profile", label: "Profile & team" },
    { id: "results", label: "Results matrix" },
    { id: "verification", label: "Field verification" },
    { id: "accessibility", label: "Accessibility retest" },
    { id: "journey", label: "Child journey" },
    { id: "interviews", label: "Interviews" },
    { id: "evidence", label: "Evidence" },
    { id: "findings", label: "Findings" },
    { id: "debrief", label: "Daily debrief" },
    { id: "submit", label: "Submit & history" },
  ];

  function render() {
    const host = UI.$("#assessment");
    const state = UI.snapshot(host);
    UI.reset();
    const s = school();
    const r = report();
    const stats = Scoring.reportStats(r);
    const locked = LOCKED_STATUSES.includes(r.status) && !isLeader();

    const badges = {
      verification: stats.notAssessed || null,
      accessibility: stats.accessAreas - stats.accessTested || null,
      findings: stats.findings || null,
    };

    const body = {
      profile: () => profileTab(r, s, locked),
      results: () => resultsTab(r, locked),
      verification: () => verificationTab(r, locked),
      accessibility: () => accessibilityTab(r, s, locked),
      journey: () => childJourneyTab(r, locked),
      interviews: () => interviewsTab(r, locked),
      evidence: () => evidenceTab(r, locked),
      findings: () => findingsTab(r, locked),
      debrief: () => debriefTab(r, locked),
      submit: () => submitTab(r, s),
    }[tab] || (() => profileTab(r, s, locked));

    host.innerHTML = [
      header(r, s, stats, locked),
      locked ? notice("<b>Report locked.</b> Submitted reports can be edited only after a Team Leader returns them for clarification.", "red") : "",
      tabs(TABS.map((t) => ({ ...t, badge: badges[t.id] })), tab, (id) => { tab = id; syncUrl(); render(); window.scrollTo(0, 0); }),
      `<div class="tabbody">${body()}</div>`,
    ].join("");

    UI.wire(host);
    markCameraInputs(host);
    UI.restore(state, host);
  }

  UI.chrome();
  render();
})();

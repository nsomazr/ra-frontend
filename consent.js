/* ============================================================================
   Consent and assent.
   Fieldwork with children is gated on this record: an interview cannot be
   reported unless a cleared consent (and, for a child, assent) exists and has
   not been withdrawn. Never record a child's name — codes only.
============================================================================ */

(() => {
  const F = FRAMEWORK;
  const { esc, pill, notice, button, field, tabs } = UI;

  const params = new URLSearchParams(location.search);
  let form = {
    schoolId: params.get("school") || P10354.schoolsInScope()[0]?.id || P10354.schools[0].id,
    type: "ADULT",
    code: "",
    language: "Kiswahili",
    adultStatus: "CONSENTED",
    caregiverCode: "",
    caregiverStatus: "CONSENT GIVEN",
    assent: "ASSENT GIVEN",
    photo: "NO",
    audio: "NO",
    recordedBy: "",
  };
  let tab = "record";

  const set = (key) => (value) => { form[key] = value; render(); };

  function isCleared(f) {
    return f.type === "CHILD"
      ? f.caregiverStatus === "CONSENT GIVEN" && f.assent === "ASSENT GIVEN"
      : f.adultStatus === "CONSENTED";
  }

  function save() {
    if (!form.code.trim()) return;
    const d = P10354.load();
    const record = {
      id: P10354.uid("CON"),
      schoolId: form.schoolId,
      type: form.type,
      code: form.code.trim(),
      language: form.language,
      status: form.type === "CHILD" ? `${form.caregiverStatus} / ${form.assent}` : form.adultStatus,
      caregiverCode: form.type === "CHILD" ? form.caregiverCode : "",
      photo: form.photo,
      audio: form.audio,
      recordedBy: form.recordedBy,
      allowed: isCleared(form),
      withdrawn: false,
      withdrawnAt: "",
      at: P10354.now(),
    };
    d.consents[record.id] = record;
    P10354.save(d);
    if (typeof P10354.scheduleSync === "function") P10354.scheduleSync();
    form.code = "";
    form.caregiverCode = "";
    tab = "records";
    render();
  }

  function withdraw(id) {
    const d = P10354.load();
    const record = d.consents[id];
    record.withdrawn = true;
    record.withdrawnAt = P10354.now();
    record.allowed = false;
    P10354.save(d);
    if (typeof P10354.scheduleSync === "function") P10354.scheduleSync();
    render();
  }

  /* --- Tab: record consent -------------------------------------------------- */
  function recordTab() {
    const isChild = form.type === "CHILD";
    const cleared = isCleared(form);

    const childBlock = `
      <section class="subcard">
        <h4>Parent or caregiver consent</h4>
        <div class="fieldgrid">
          ${field({ label: "Parent/caregiver respondent code", value: form.caregiverCode, placeholder: "Code, not a name", onChange: set("caregiverCode") })}
          ${field({ label: "Parent/caregiver consent", type: "select", value: form.caregiverStatus,
            options: ["CONSENT GIVEN", "CONSENT DECLINED", "CONSENT WITHDRAWN"], onChange: set("caregiverStatus") })}
        </div>
        <h4>Child assent</h4>
        ${field({ label: "Child assent", type: "select", value: form.assent,
          options: ["ASSENT GIVEN", "ASSENT DECLINED", "ASSENT WITHDRAWN", "UNABLE TO PROVIDE ASSENT — REFER"], onChange: set("assent") })}
      </section>`;

    const adultBlock = `
      <section class="subcard">
        <h4>Adult consent</h4>
        ${field({ label: "Adult consent status", type: "select", value: form.adultStatus,
          options: ["CONSENTED", "DECLINED", "WITHDRAWN", "NOT REQUIRED"], onChange: set("adultStatus") })}
      </section>`;

    return `
      <section class="two">
        <section class="card pad">
          <h2>New consent record</h2>
          <div class="fieldgrid">
            ${field({ label: "School", type: "select", value: form.schoolId,
              options: P10354.schools.map((s) => ({ value: s.id, label: `${s.region} · ${s.name}` })), onChange: set("schoolId") })}
            ${field({ label: "Participation type", type: "select", value: form.type,
              options: [{ value: "ADULT", label: "Adult interview / FGD" }, { value: "CHILD", label: "Child interview / FGD" }], onChange: set("type") })}
            ${field({ label: "Respondent code", value: form.code, placeholder: "e.g. KAT01-P07 — code, not a name", onChange: set("code") })}
            ${field({ label: "Language used", type: "select", value: form.language, options: ["Kiswahili", "English", "Both"], onChange: set("language") })}
            ${field({ label: "Recorded by", type: "select", value: form.recordedBy,
              options: [{ value: "", label: "Select team member" },
                ...P10354.users().filter((u) => u.active).map((u) => ({ value: u.id, label: `${u.name || u.username} · ${u.role}` }))],
              onChange: set("recordedBy") })}
            ${field({ label: "Photography consent", type: "select", value: form.photo, options: ["NO", "YES"], onChange: set("photo") })}
            ${field({ label: "Audio recording consent", type: "select", value: form.audio, options: ["NO", "YES"], onChange: set("audio") })}
          </div>
          ${isChild ? childBlock : adultBlock}
          <div class="actions">
            ${button("Record consent", save, `btn large ${form.code.trim() ? "" : "disabled"}`)}
          </div>
        </section>

        <section class="card pad">
          <h2>Consent check</h2>
          ${cleared
            ? notice("Cleared — an interview may proceed.", "green")
            : notice(isChild
                ? "Not cleared. A child interview needs both caregiver consent and the child's assent."
                : "Not cleared. An adult interview needs a recorded consent.", "red")}
        </section>
      </section>`;
  }

  /* --- Tab: records --------------------------------------------------------- */
  function recordsTab() {
    const all = Object.values(P10354.load().consents).sort((a, b) => (a.at < b.at ? 1 : -1));
    const bySchool = {};
    all.forEach((c) => { (bySchool[c.schoolId] = bySchool[c.schoolId] || []).push(c); });

    return `
      <section class="card">
        <div class="pad section-head">
          <div><h2>Consent register</h2></div>
          <div class="actions">${button("Export register (CSV)", () => {
            UI.saveCsv("P10354_ConsentRegister", UI.toCsv(
              ["Consent ID", "School", "Type", "Respondent code", "Caregiver code", "Language", "Status",
                "Photography", "Audio", "Cleared", "Withdrawn", "Recorded at"],
              all.map((c) => {
                const s = P10354.school(c.schoolId);
                return [c.id, s ? s.name : c.schoolId, c.type, c.code, c.caregiverCode, c.language, c.status,
                  c.photo, c.audio, c.allowed ? "Yes" : "No", c.withdrawn ? "Yes" : "No", c.at];
              })));
          }, "btn secondary")}</div>
        </div>
        <div class="tablewrap"><table>
          <thead><tr><th>Consent ID</th><th>School</th><th>Type</th><th>Code</th><th>Status</th><th>Media</th><th>Cleared</th><th>Recorded</th><th></th></tr></thead>
          <tbody>${all.length ? all.map((c) => {
            const s = P10354.school(c.schoolId);
            return `<tr class="${c.withdrawn ? "rowalert" : ""}">
              <td><small>${esc(c.id)}</small></td>
              <td><small>${esc(s ? s.name : c.schoolId)}</small></td>
              <td>${pill(c.type)}</td>
              <td>${esc(c.code)}${c.caregiverCode ? `<br><small>caregiver ${esc(c.caregiverCode)}</small>` : ""}</td>
              <td><small>${esc(c.status)}</small></td>
              <td><small>${c.photo === "YES" ? "Photo" : ""}${c.audio === "YES" ? " Audio" : ""}${c.photo !== "YES" && c.audio !== "YES" ? "None" : ""}</small></td>
              <td>${c.withdrawn ? pill("Withdrawn", "alert") : c.allowed ? pill("Cleared") : pill("Not cleared", "alert")}</td>
              <td><small>${new Date(c.at).toLocaleString()}</small></td>
              <td>${c.withdrawn ? "" : button("Withdraw", () => withdraw(c.id), "btn secondary small")}</td>
            </tr>`;
          }).join("") : `<tr><td colspan="9" class="empty">No consent records yet.</td></tr>`}</tbody>
        </table></div>
      </section>

      <section class="card pad">
        <h2>Coverage by school</h2>
        <div class="tablewrap"><table>
          <thead><tr><th>School</th><th>Adult</th><th>Child</th><th>Cleared</th><th>Withdrawn</th><th></th></tr></thead>
          <tbody>${P10354.schools.map((s) => {
            const list = bySchool[s.id] || [];
            if (!list.length) return "";
            return `<tr>
              <td>${esc(s.name)}<br><small>${esc(s.region)}</small></td>
              <td>${list.filter((c) => c.type === "ADULT").length}</td>
              <td>${list.filter((c) => c.type === "CHILD").length}</td>
              <td>${list.filter((c) => c.allowed).length}</td>
              <td>${list.filter((c) => c.withdrawn).length}</td>
              <td><a class="btn secondary" href="school-assessment.html?school=${esc(s.id)}&tab=interviews">Open interviews</a></td>
            </tr>`;
          }).join("") || `<tr><td colspan="6" class="empty">No consent recorded for any school yet.</td></tr>`}</tbody>
        </table></div>
      </section>`;
  }

  /* --- Render --------------------------------------------------------------- */
  function render() {
    const host = UI.$("#consent");
    const state = UI.snapshot(host);
    UI.reset();

    host.innerHTML = [
      `<div class="heading"><div><h1>Consent and assent</h1></div></div>`,
      tabs([{ id: "record", label: "Record consent" }, { id: "records", label: "Consent register" }],
        tab, (id) => { tab = id; render(); window.scrollTo(0, 0); }),
      `<div class="tabbody">${tab === "records" ? recordsTab() : recordTab()}</div>`,
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

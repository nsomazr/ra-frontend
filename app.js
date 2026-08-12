/* ============================================================================
   P10354 — shared UI library.
   Page chrome, form controls, the record-card and register renderers every
   page is built from, progress/triangulation scoring, and CSV export.

   Binding model: controls register a callback and render `data-bind="bN"`.
   After a page writes its HTML, it calls UI.wire(root) once and every control
   is connected. Bindings are cleared at the start of each render so repeated
   renders cannot leak handlers.
============================================================================ */

const UI = (() => {
  const F = FRAMEWORK;
  let bindings = new Map();
  let seq = 0;

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const esc = (value) => String(value ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const reset = () => { bindings = new Map(); seq = 0; };

  function bind(handler) {
    const id = `b${++seq}`;
    bindings.set(id, handler);
    return id;
  }

  function wire(root = document) {
    $$("[data-bind]", root).forEach((el) => {
      const handler = bindings.get(el.dataset.bind);
      if (!handler) return;
      if (el.type === "file") el.onchange = () => handler(el.files, el);
      else if (el.type === "checkbox") el.onchange = () => handler(el.checked, el);
      else if (el.tagName === "BUTTON" || el.tagName === "A") el.onclick = (e) => { e.preventDefault(); handler(el.value, el); };
      else el.onchange = () => handler(el.value, el);
    });
  }

  /* --- Page chrome -------------------------------------------------------- */
  const NAV = [
    { id: "dashboard", href: "dashboard.html", label: "Field Dashboard" },
    { id: "assessment", href: "school-assessment.html", label: "School Assessment" },
    { id: "programme", href: "programme.html", label: "Programme Workbook" },
    { id: "consent", href: "consent.html", label: "Consent & Assent" },
    { id: "review", href: "review.html", label: "Team Leader Review" },
    { id: "admin", href: "admin.html", label: "Administration" },
  ];

  function chrome() {
    const host = $("#chrome");
    if (!host) return;
    if (!AssessAPI.requireAuth()) return;

    const page = host.dataset.page;
    const subtitle = host.dataset.subtitle || "External Programmatic Assessment field system";
    const session = AssessAPI.session.get();
    const label = session?.username || (session?.role || "Account").split("/")[0].trim();
    const isAdmin = session?.roleCode === "ADMIN" || /administrator/i.test(session?.role || "");

    const nav = NAV.filter((n) => n.id !== "admin" || isAdmin);

    host.innerHTML = `
      <div class="top">
        <div class="topin">
          <div class="brand">
            <b>REET · CBM ${esc(F.meta.project)}</b>
            <small>${esc(subtitle)}</small>
          </div>
          <div class="top-actions">
            <span id="sync" class="online">Checking sync…</span>
            <span class="pill account-pill" title="Signed in">${esc(label)}</span>
            <button type="button" class="btn small secondary" id="signOutBtn">Sign out</button>
          </div>
        </div>
        <nav class="nav" aria-label="Primary">${nav.map((n) =>
          `<a class="${n.id === page ? "active" : ""}" href="${n.href}">${esc(n.label)}</a>`).join("")}</nav>
      </div>`;
    syncBadge();
    const out = $("#signOutBtn");
    if (out) out.onclick = () => AssessAPI.logout(true);
  }

  /** Gate the page: require login, paint chrome, then run the page callback. */
  async function boot(start) {
    const ok = await AssessAPI.ensureAuth();
    if (!ok) return;
    chrome();
    if (typeof start === "function") await start();
  }

  function syncBadge() {
    const el = $("#sync");
    if (!el) return;
    const paint = () => {
      const online = navigator.onLine;
      el.textContent = online ? "Online · sync ready" : "Offline · held locally";
      el.className = online ? "online" : "online offline";
    };
    addEventListener("online", paint);
    addEventListener("offline", paint);
    paint();
  }

  /* --- Small pieces ------------------------------------------------------- */
  const slug = (value) => String(value).toLowerCase().replace(/[^a-z]/g, "");

  const pill = (text, extraClass = "") =>
    `<span class="pill ${slug(text)} ${extraClass}">${esc(text)}</span>`;

  function ratingPill(value) {
    if (!value) return `<span class="pill">—</span>`;
    if (value === "NV") return `<span class="pill nv">NV</span>`;
    return `<span class="pill r${value}">${esc(value)}</span>`;
  }

  function options(list, current) {
    return list.map((item) => {
      const value = typeof item === "object" ? item.value : item;
      const label = typeof item === "object" ? item.label : (item || "—");
      return `<option value="${esc(value)}" ${String(current) === String(value) ? "selected" : ""}>${esc(label)}</option>`;
    }).join("");
  }

  /* field({label, type, value, options, help, onChange}) -------------------- */
  function field(spec) {
    const id = bind(spec.onChange || (() => {}));
    const disabled = spec.locked ? "disabled" : "";
    const help = spec.help ? `<small class="help">${esc(spec.help)}</small>` : "";
    let control;
    if (spec.type === "select") {
      control = `<select data-bind="${id}" ${disabled}>${options(spec.options || [], spec.value)}</select>`;
    } else if (spec.type === "textarea") {
      control = `<textarea data-bind="${id}" ${disabled} placeholder="${esc(spec.placeholder || "")}">${esc(spec.value)}</textarea>`;
    } else if (spec.type === "checks") {
      control = `<div class="checks">${(spec.options || []).map((opt) => {
        const cid = bind((checked) => spec.onChange(opt.value ?? opt, checked));
        const value = opt.value ?? opt;
        const checked = (spec.value || []).includes(value) ? "checked" : "";
        return `<label class="check"><input type="checkbox" data-bind="${cid}" ${checked} ${disabled}><span>${esc(opt.label ?? opt)}</span></label>`;
      }).join("")}</div>`;
    } else {
      control = `<input type="${spec.type || "text"}" data-bind="${id}" value="${esc(spec.value)}" placeholder="${esc(spec.placeholder || "")}" ${disabled}>`;
    }
    return `<label class="field ${spec.wide ? "wide" : ""}"><span>${esc(spec.label)}</span>${control}${help}</label>`;
  }

  function button(label, onClick, className = "btn") {
    return `<button class="${className}" data-bind="${bind(onClick)}">${esc(label)}</button>`;
  }

  /* --- Reference block: read-only framework context ----------------------- */
  function reference(items) {
    const rows = items.filter((i) => i && i.text);
    if (!rows.length) return "";
    return `<div class="reference">${rows.map((i) =>
      `<p><b>${esc(i.label)}:</b> ${esc(i.text)}</p>`).join("")}</div>`;
  }

  /* --- Record card: one framework item with its editable fields ------------
     Used for results, verification questions, accessibility areas, activities,
     DAC criteria, stakeholders, sustainability assets, learning areas … ----- */
  function recordCard(spec) {
    const chips = (spec.chips || []).filter(Boolean).join(" ");
    const body = [
      reference(spec.context || []),
      spec.fields && spec.fields.length ? `<div class="fieldgrid">${spec.fields.join("")}</div>` : "",
      spec.extra || "",
    ].join("");
    return `
      <details class="record ${spec.locked ? "locked" : ""}" data-key="${esc(spec.key || spec.title)}" ${spec.open ? "open" : ""}>
        <summary>
          <div><h3>${esc(spec.title)}</h3><small>${esc(spec.subtitle || "")}</small></div>
          <div class="chips">${chips}</div>
        </summary>
        <div class="record-body">${body}</div>
      </details>`;
  }

  /* --- Register: an add-as-you-go list (evidence, findings, cases …) ------- */
  function register(spec) {
    const rows = spec.rows || [];
    const cards = rows.map((row, index) => {
      const fields = spec.columns.map((col) => field({
        label: col.label, type: col.type, options: col.options,
        value: row[col.key] ?? "", locked: spec.locked,
        onChange: (value) => spec.onChange(index, col.key, value),
      }));
      const remove = spec.locked ? "" : button("Remove entry", () => spec.onRemove(index), "btn secondary small");
      return `<div class="register-row">
          <div class="register-head"><b>${esc(spec.rowLabel ? spec.rowLabel(row, index) : `Entry ${index + 1}`)}</b>${remove}</div>
          <div class="fieldgrid">${fields.join("")}</div>
        </div>`;
    }).join("");
    return `
      <section class="card pad">
        <div class="section-head">
          <div><h2>${esc(spec.title)}</h2>${spec.help ? `<p class="help">${esc(spec.help)}</p>` : ""}</div>
          <div class="actions">
            ${spec.locked ? "" : button(spec.addLabel || "Add entry", spec.onAdd, "btn secondary")}
            ${rows.length ? button("Export CSV", () => downloadCsv(spec.title, spec.columns, rows), "btn secondary") : ""}
          </div>
        </div>
        ${rows.length ? cards : `<p class="empty">No entries recorded yet.</p>`}
      </section>`;
  }

  /* --- Tabs --------------------------------------------------------------- */
  function tabs(items, current, onSelect) {
    return `<div class="tabs">${items.map((t) => {
      const id = bind(() => onSelect(t.id));
      return `<button class="tab ${t.id === current ? "active" : ""}" data-bind="${id}">
          ${esc(t.label)}${t.badge ? `<span class="tabbadge">${esc(t.badge)}</span>` : ""}
        </button>`;
    }).join("")}</div>`;
  }

  function notice(html, tone = "") {
    return `<div class="notice ${tone}">${html}</div>`;
  }

  /* --- CSV export ---------------------------------------------------------
     Columns mirror the workbook sheets so an export drops straight into the
     Excel checklist a reviewer already knows. -------------------------------*/
  function csvCell(value) {
    const text = String(value ?? "").replace(/"/g, '""');
    return /[",\n]/.test(text) ? `"${text}"` : text;
  }

  function toCsv(headers, rows) {
    return [headers.map(csvCell).join(","), ...rows.map((r) => r.map(csvCell).join(","))].join("\r\n");
  }

  function saveCsv(filename, csv) {
    // BOM keeps Excel from mangling Kiswahili diacritics and en-dashes.
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename.replace(/[^\w.-]+/g, "_") + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function downloadCsv(title, columns, rows) {
    saveCsv(`P10354_${title}`, toCsv(
      columns.map((c) => c.label),
      rows.map((r) => columns.map((c) => r[c.key] ?? "")),
    ));
  }

  /* --- Render state preservation ------------------------------------------
     Every edit re-renders the page, which would otherwise collapse open
     sections and throw the field team back to the top of a long form.
     Capture what was open and where we were, then put it back. ------------- */
  function snapshot(root = document) {
    return {
      open: $$("details[data-key]", root).filter((d) => d.open).map((d) => d.dataset.key),
      scroll: window.scrollY,
    };
  }

  function restore(state, root = document) {
    if (!state) return;
    const wanted = new Set(state.open);
    $$("details[data-key]", root).forEach((d) => { if (wanted.has(d.dataset.key)) d.open = true; });
    window.scrollTo(0, state.scroll);
  }

  return {
    $, $$, esc, reset, bind, wire, chrome, boot, syncBadge, pill, ratingPill, options,
    field, button, reference, recordCard, register, tabs, notice,
    toCsv, saveCsv, downloadCsv, slug, snapshot, restore,
  };
})();

/* ============================================================================
   Scoring — progress, triangulation and submission readiness.
   Kept in one place so the dashboard, the assessment page and the Team Leader
   review can never disagree about whether a report is complete.
============================================================================ */

const Scoring = (() => {
  const F = FRAMEWORK;

  const isScored = (v) => v !== "" && v !== undefined && v !== null;

  function reportStats(report) {
    const questions = Object.values(report.fieldQuestions);
    const access = Object.values(report.accessibility);
    const results = Object.values(report.results);

    const assessed = questions.filter((q) => q.status === "ASSESSED").length;
    const notAssessed = questions.filter((q) => q.status === "NOT ASSESSED").length;
    const na = questions.filter((q) => q.status === "NOT APPLICABLE").length;
    const followUp = questions.filter((q) => q.status === "REQUIRES FOLLOW-UP").length;

    const disputes = questions.filter((q) =>
      q.a1.grade && q.a2.grade && q.a1.grade !== q.a2.grade).length;

    const underTriangulated = questions.filter((q) =>
      q.status === "ASSESSED" && (q.streams || []).length < 2).length;

    const evidenceCount =
      questions.reduce((n, q) => n + (q.evidence || []).length, 0) +
      access.reduce((n, a) => n + (a.evidence || []).length, 0) +
      report.evidenceRegister.length;

    const accessTested = access.filter((a) => isScored(a.accessibleInPractice)).length;
    const safetyRisks = access.filter((a) => a.safetyRisk && a.safetyRisk !== "NO").length;
    const resultsScored = results.filter((r) => isScored(r.achievement)).length;

    const denominator = questions.length - na;
    const percent = denominator > 0 ? Math.round((assessed / denominator) * 100) : 0;

    return {
      questions: questions.length, assessed, notAssessed, na, followUp, percent,
      disputes, underTriangulated, evidenceCount,
      accessAreas: access.length, accessTested, safetyRisks,
      results: results.length, resultsScored,
      interviews: report.interviews.length,
      cases: report.childJourney.length,
      findings: report.findings.length,
      criticalFindings: report.findings.filter((f) => f.severity === "CRITICAL" || f.severity === "HIGH").length,
    };
  }

  /* Warnings shown at submission and again at QA approval. `blocking` items
     stop the action unless the Team Leader has relaxed the setting. */
  function submissionChecks(report, school, settings) {
    const stats = reportStats(report);
    const checks = [];

    if (school.rosterStatus === "UNCONFIRMED") {
      checks.push({
        blocking: settings.blockUnconfirmedRoster,
        text: `${school.name} is on an UNCONFIRMED roster. Its region has no supplied accessibility baseline, so a defensible achievement score cannot be produced until CBM confirms the school list (see reconciliation item RC-08).`,
      });
    }
    if (stats.notAssessed) {
      checks.push({ blocking: !settings.allowUnassessed, text: `${stats.notAssessed} verification question(s) remain NOT ASSESSED.` });
    }
    if (!report.profile.visitDate) {
      checks.push({ blocking: false, text: "No visit date recorded on the school profile." });
    }
    if (!report.team.auditor1 || !report.team.auditor2) {
      checks.push({ blocking: false, text: "Two independent auditors have not both been assigned to this report." });
    }
    if (!stats.evidenceCount) {
      checks.push({ blocking: false, text: "No evidence items have been attached or registered." });
    }
    if (stats.underTriangulated) {
      checks.push({
        blocking: settings.requireTriangulation,
        text: `${stats.underTriangulated} assessed question(s) cite fewer than two evidence streams. The triangulation rule requires at least two of the four streams.`,
      });
    }
    if (stats.disputes) {
      checks.push({ blocking: false, text: `${stats.disputes} auditor grade discrepancy/discrepancies require a Team Leader decision.` });
    }
    if (stats.accessAreas && stats.accessTested < stats.accessAreas) {
      checks.push({ blocking: false, text: `${stats.accessAreas - stats.accessTested} of ${stats.accessAreas} accessibility retest area(s) have not been tested in practice.` });
    }
    if (stats.safetyRisks) {
      checks.push({ blocking: false, text: `${stats.safetyRisks} accessibility area(s) are flagged as a safety risk and need a recorded action.` });
    }
    if (!report.narrative.overall) {
      checks.push({ blocking: false, text: "Overall school findings have not been written." });
    }
    return { stats, checks, blocked: checks.some((c) => c.blocking) };
  }

  /* Project-level readiness. Unresolved contradictions hold back the final
     conclusion, because an achievement percentage calculated against a
     disputed denominator is not defensible [CL 10]. Resolved once, not
     once per region. */
  function projectStats() {
    const rec = Object.values(P10354.getProject().reconciliation);
    return {
      reconciliationOpen: rec.filter((r) => r.status !== "RESOLVED").length,
      reconciliationTotal: rec.length,
    };
  }

  function programmeStats(programme) {
    return {
      ...projectStats(),
      dacRated: Object.values(programme.dac).filter((d) => d.rating).length,
      dacTotal: Object.keys(programme.dac).length,
      activitiesVerified: Object.values(programme.activities).filter((a) => a.grade).length,
      activitiesTotal: Object.keys(programme.activities).length,
      baselineFilled: Object.values(programme.baseline).filter((b) => b.current).length,
      baselineTotal: Object.keys(programme.baseline).length,
      gatesCleared: Object.values(programme.gates).filter((g) => g.status === "CLEARED").length,
      gatesTotal: Object.keys(programme.gates).length,
    };
  }

  function regionRollup(regionId) {
    const schools = P10354.schools.filter((s) => s.region.toUpperCase() === regionId);
    const db = P10354.load();
    const reports = schools.map((s) => db.reports[s.id]).filter(Boolean);
    const stats = reports.map(reportStats);
    const sum = (key) => stats.reduce((n, s) => n + s[key], 0);
    return {
      regionId, schools: schools.length, started: reports.length,
      submitted: reports.filter((r) => ["SUBMITTED", "UNDER REVIEW", "QA APPROVED", "FINALIZED"].includes(r.status)).length,
      assessed: sum("assessed"), questions: sum("questions"),
      evidence: sum("evidenceCount"), disputes: sum("disputes"),
      underTriangulated: sum("underTriangulated"), safetyRisks: sum("safetyRisks"),
      criticalFindings: sum("criticalFindings"),
    };
  }

  return { reportStats, submissionChecks, projectStats, programmeStats, regionRollup };
})();

/* ============================================================================
   P10354 — data layer.
   localStorage holds the structured record; IndexedDB holds evidence blobs so
   fieldwork survives being offline. Production must move both behind the
   authenticated API described in architecture.md — see the notes there.
============================================================================ */

const P10354 = (() => {
  const KEY = "p10354-school-report-system-v1";
  const SESSION_KEY = "p10354-session";
  const SCHEMA_VERSION = 4;
  const F = FRAMEWORK;

  const now = () => new Date().toISOString();
  const year = () => new Date().getFullYear();
  const uid = (prefix) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  /* --- Defaults ---------------------------------------------------------- */
  const defaultUsers = [
    {
      id: "ADM-001", name: "", username: "Angel", staffId: "", email: "", phone: "",
      role: "System Administrator", region: "All", schools: [], active: true,
      lastLogin: "", mustChangePassword: true, passwordHash: "INITIAL_BOOTSTRAP_REQUIRED",
    },
  ];

  const defaultSettings = {
    allowUnassessed: true,          // Team Leader may permit submission with gaps
    requireTriangulation: true,     // block QA approval below 2 evidence streams
    blockUnconfirmedRoster: true,   // block grading of UNCONFIRMED schools
    activeRegions: F.regions.filter((r) => r.active).map((r) => r.id),
  };

  /* --- Record factories -------------------------------------------------- */
  function blankRating() {
    return { achievement: "", quality: "", finding: "", recommendation: "", evidenceStrength: "" };
  }

  function makeReport(school) {
    const initials = school.name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return {
      id: `CBM-P10354-${school.id.slice(0, 3)}-${initials}-${year()}-001`,
      schoolId: school.id,
      region: school.region,
      status: "DRAFT",
      version: 1,
      createdAt: now(), updatedAt: now(), submittedAt: "",
      team: { fieldAgent: "", auditor1: "", auditor2: "", teamLeader: "", safeguardingLead: "" },

      profile: {
        headTeacher: "", focalPerson: "", schoolCommittee: "",
        teachersTotal: "", teachersTrainedIE: "",
        learners: "", learnersWithDisabilities: "", girlsWithDisabilities: "",
        gps: "", visitDate: "", visitEndDate: "",
        rosterConfirmed: "", rosterNote: "",
      },

      /* Results matrix [CL 02] — one record per result area */
      results: Object.fromEntries(F.results.map((r) => [r.id, {
        ...blankRating(),
        regionalTarget: "", contribution: "", sustainability: "", updatedAt: "",
      }])),

      /* Field assessment [CL 04] — one record per verification question */
      fieldQuestions: Object.fromEntries(F.fieldQuestions.map((q) => [q.id, {
        status: "NOT ASSESSED",
        reported: "", actual: "", evidenceChecked: "", source: "",
        achievement: "", quality: "", grade: "",
        a1: { auditor: "", verified: "", grade: "", observations: "" },
        a2: { auditor: "", verified: "", grade: "", observations: "" },
        final: { verified: "", grade: "", reviewer: "", rationale: "" },
        streams: [], issue: "", effect: "", recommendation: "", ref: "",
        evidence: [], updatedAt: "",
      }])),

      /* Accessibility retest [CL 17] — one record per school × audit area */
      accessibility: Object.fromEntries((school.retest || []).map((row) => [row.area, {
        currentCondition: "", standardCheck: "", accessibleInPractice: "",
        testedBy: "", evidenceNow: "", achievement: "", quality: "",
        safetyRisk: "", action: "", evidence: [], updatedAt: "",
      }])),

      /* Open registers */
      childJourney: [],
      interviews: [],
      evidenceRegister: [],
      findings: [],
      debriefs: [],

      narrative: { overall: "", recommendations: "", limitations: "" },
      history: [{ at: now(), event: "Report created", actor: "System" }],
    };
  }

  /* Project-level record. The reconciliation items are contradictions between
     the PPA, the kick-off materials and the proposal — they are facts about
     the project, not about a region, so they are resolved once and every
     region sees the same answer. */
  function makeProject() {
    return {
      updatedAt: now(),
      reconciliation: Object.fromEntries(F.reconciliation.map((r) => [r.id, { agreed: "", resolvedBy: "", resolvedAt: "", status: "OPEN" }])),
      history: [{ at: now(), event: "Project record created", actor: "System" }],
    };
  }

  /* Programme-level workbook, one per region [CL 09, 13-15, 18-21, 23] */
  function makeProgramme(regionId) {
    return {
      regionId,
      updatedAt: now(),
      baseline: Object.fromEntries(F.baselineIndicators.map((b) => [b.id, { current: "", change: "", sourceCurrent: "", triangulated: "", judgement: "", explains: "", limitation: "" }])),
      activities: Object.fromEntries(F.activities.map((a) => [a.id, { reported: "", verified: "", fidelity: "", immediateChange: "", contribution: "", delay: "", evidence: "", followUp: "", achievement: "", grade: "" }])),
      dac: Object.fromEntries(F.dacCriteria.map((c) => [c.id, { rating: "", strength: "", finding: "", recommendation: "", conclusion: "" }])),
      stakeholders: Object.fromEntries(F.stakeholders.map((s) => [s.id, { evidence: "", changed: "", commitment: "", budget: "", followUp: "", rating: "", message: "" }])),
      sustainability: Object.fromEntries(F.sustainabilityAssets.map((s) => [s.id, { owner: "", payer: "", maintainer: "", skillsLocal: "", inGovtPlan: "", dependent: "", exitStarted: "", rating: "", evidence: "" }])),
      learning: Object.fromEntries(F.learningAreas.map((l) => [l.id, { learned: "", changed: "", positive: "", negative: "", evidence: "", identifiedBy: "", adapt: "", priority: "", recommendation: "" }])),
      vfm: Object.fromEntries(F.vfm.questions.map((q) => [q.id, { finding: "", implication: "", recommendation: "" }])),
      dataQuality: [],
      evidenceMap: [],
      teamLeaderSummary: Object.fromEntries(F.teamLeaderSummary.map((f) => [f.id, ""])),
      deliverables: Object.fromEntries(F.deliverables.map((d) => [d.id, { status: "NOT STARTED", date: "", note: "" }])),
      gates: Object.fromEntries(F.gates.map((g) => [g.id, { status: "NOT CLEARED", date: "", note: "" }])),
      history: [{ at: now(), event: "Programme workbook created", actor: "System" }],
    };
  }

  function emptyDb() {
    return {
      schemaVersion: SCHEMA_VERSION,
      project: makeProject(),
      reports: {},
      programmes: {},
      consents: {},
      users: defaultUsers.map((u) => ({ ...u })),
      settings: { ...defaultSettings },
      legacy: null,
    };
  }

  /* --- Load / save with migration ---------------------------------------- */
  function load() {
    let raw;
    try { raw = JSON.parse(localStorage.getItem(KEY)); } catch { raw = null; }
    if (!raw) return emptyDb();

    const base = emptyDb();
    if ((raw.schemaVersion || raw.systemVersion || 0) < SCHEMA_VERSION) return migrate(raw, base);

    return {
      ...base, ...raw,
      settings: { ...base.settings, ...(raw.settings || {}) },
      users: raw.users && raw.users.length ? raw.users : base.users,
      project: raw.project || base.project,
      reports: raw.reports || {},
      programmes: raw.programmes || {},
      consents: raw.consents || {},
    };
  }

  /* v1-v3 stored a flat `commitments` map per report keyed by an ad-hoc
     commitment list that the approved checklists supersede. Rather than
     discard field data we park the old reports under `legacy` so the Team
     Leader can still read them, and start clean records on the new model. */
  function migrate(raw, base) {
    const migrated = {
      ...base,
      consents: raw.consents || {},
      users: (raw.users || raw.agents || []).length ? (raw.users || raw.agents) : base.users,
      settings: { ...base.settings, ...(raw.settings || {}) },
      legacy: raw.reports && Object.keys(raw.reports).length
        ? { migratedAt: now(), fromVersion: raw.schemaVersion || raw.systemVersion || 1, reports: raw.reports }
        : null,
    };
    save(migrated);
    return migrated;
  }

  function save(db) {
    db.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(KEY, JSON.stringify(db));
    return db;
  }

  /* --- Schools / lookups -------------------------------------------------- */
  const schools = F.schools;
  const school = (id) => schools.find((s) => s.id === id);
  const activeRegionIds = () => load().settings.activeRegions;
  const schoolsInScope = () => {
    const active = activeRegionIds();
    return schools.filter((s) => active.includes(s.region.toUpperCase()));
  };

  /* --- Reports ------------------------------------------------------------ */
  function getReport(schoolId) {
    const db = load();
    if (!db.reports[schoolId]) {
      const s = school(schoolId);
      if (!s) return null;
      db.reports[schoolId] = makeReport(s);
      save(db);
    }
    return backfillReport(db.reports[schoolId], school(schoolId));
  }

  /* Framework content can grow (new question, new audit area). Backfill keeps
     existing reports valid without wiping anything the team already entered. */
  function backfillReport(report, s) {
    let changed = false;
    const blank = makeReport(s);
    for (const key of ["results", "fieldQuestions", "accessibility"]) {
      for (const [id, template] of Object.entries(blank[key])) {
        if (!report[key][id]) { report[key][id] = template; changed = true; }
      }
    }
    for (const key of ["childJourney", "interviews", "evidenceRegister", "findings", "debriefs"]) {
      if (!Array.isArray(report[key])) { report[key] = []; changed = true; }
    }
    if (!report.narrative) { report.narrative = blank.narrative; changed = true; }
    if (!report.team) { report.team = blank.team; changed = true; }
    if (changed) {
      const db = load();
      db.reports[report.schoolId] = report;
      save(db);
    }
    return report;
  }

  function putReport(report, event, actor) {
    const db = load();
    report.updatedAt = now();
    if (event) report.history.unshift({ at: now(), event, actor: actor || "Field Auditor" });
    if (report.history.length > 400) report.history.length = 400;
    db.reports[report.schoolId] = report;
    save(db);
    return report;
  }

  function allReports() { return Object.values(load().reports); }

  /* --- Project record ------------------------------------------------------ */
  function getProject() {
    const db = load();
    if (!db.project) { db.project = makeProject(); save(db); }
    const blank = makeProject();
    let changed = false;
    for (const [id, template] of Object.entries(blank.reconciliation)) {
      if (!db.project.reconciliation[id]) { db.project.reconciliation[id] = template; changed = true; }
    }
    if (changed) save(db);
    return db.project;
  }

  function putProject(record, event, actor) {
    const db = load();
    record.updatedAt = now();
    if (event) record.history.unshift({ at: now(), event, actor: actor || "Team Leader" });
    db.project = record;
    save(db);
    return record;
  }

  /* --- Programme workbooks ------------------------------------------------ */
  function getProgramme(regionId) {
    const db = load();
    if (!db.programmes[regionId]) {
      db.programmes[regionId] = makeProgramme(regionId);
      save(db);
    }
    const record = db.programmes[regionId];
    const blank = makeProgramme(regionId);
    let changed = false;
    for (const key of ["baseline", "activities", "dac", "stakeholders", "sustainability", "learning", "vfm", "teamLeaderSummary", "deliverables", "gates"]) {
      if (!record[key]) { record[key] = blank[key]; changed = true; continue; }
      for (const [id, template] of Object.entries(blank[key])) {
        if (record[key][id] === undefined) { record[key][id] = template; changed = true; }
      }
    }
    for (const key of ["dataQuality", "evidenceMap"]) {
      if (!Array.isArray(record[key])) { record[key] = []; changed = true; }
    }
    if (changed) { db.programmes[regionId] = record; save(db); }
    return record;
  }

  function putProgramme(record, event, actor) {
    const db = load();
    record.updatedAt = now();
    if (event) record.history.unshift({ at: now(), event, actor: actor || "Team Leader" });
    db.programmes[record.regionId] = record;
    save(db);
    return record;
  }

  /* --- Evidence blobs (IndexedDB) ----------------------------------------- */
  function openStore() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open("P10354Evidence", 1);
      request.onupgradeneeded = () => request.result.createObjectStore("files", { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function putFile(file, meta) {
    const store = await openStore();
    const id = uid("EV");
    return new Promise((resolve, reject) => {
      const tx = store.transaction("files", "readwrite");
      tx.objectStore("files").put({ id, file, meta: { ...meta, at: now() } });
      tx.oncomplete = () => resolve({
        id, name: file.name, type: file.type, size: file.size,
        status: navigator.onLine ? "SYNC PENDING" : "PENDING SYNC",
        description: "", stream: "Field evidence", gps: meta.gps || "", at: now(),
      });
      tx.onerror = () => reject(tx.error);
    });
  }

  async function getFile(id) {
    const store = await openStore();
    return new Promise((resolve, reject) => {
      const request = store.transaction("files", "readonly").objectStore("files").get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  /* Evidence is never hard-deleted from IndexedDB by a field action — the
     reference is detached from the report and the blob is kept for the sync
     queue. See architecture.md. */
  function detachEvidence(list, evidenceId) {
    return list.filter((e) => e.id !== evidenceId);
  }

  /* --- Session ------------------------------------------------------------ */
  const session = {
    get() { try { return JSON.parse(localStorage.getItem(SESSION_KEY)); } catch { return null; } },
    set(value) { localStorage.setItem(SESSION_KEY, JSON.stringify(value)); },
    clear() { localStorage.removeItem(SESSION_KEY); },
  };

  function users() { return load().users; }
  function activeUsers(role) {
    return users().filter((u) => u.active && (!role || u.role === role));
  }

  return {
    SCHEMA_VERSION,
    framework: F,
    schools, school, schoolsInScope, activeRegionIds,
    load, save, emptyDb,
    getReport, putReport, allReports, makeReport,
    getProject, putProject, getProgramme, putProgramme,
    putFile, getFile, detachEvidence,
    users, activeUsers, session,
    now, uid,
  };
})();

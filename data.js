/* ============================================================================
   P10354 — data layer.
   localStorage holds the structured record; IndexedDB holds evidence blobs so
   fieldwork survives being offline. Production must move both behind the
   authenticated API described in architecture.md — see the notes there.
============================================================================ */

const P10354 = (() => {
  const KEY = "p10354-school-report-system-v1";
  const SESSION_KEY = "p10354-session";
  const SYNC_QUEUE_KEY = "p10354-sync-queue";
  const SYNC_STATE_KEY = "p10354-sync-state";
  const SYNC_CONFIG_KEY = "p10354-sync-config";
  const SCHEMA_VERSION = 5;
  const DEFAULT_API_BASE = "http://127.0.0.1:8087/api";
  let syncTimer = null;
  let syncBusy = false;
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
    const sourceVersion = raw.schemaVersion || raw.systemVersion || 1;
    // Version 4 already uses the current report/programme structure. Version 5
    // only adds the local change queue, so preserve all existing records.
    if (sourceVersion >= 4) {
      const migrated = {
        ...base, ...raw,
        schemaVersion: SCHEMA_VERSION,
        consents: raw.consents || {},
        users: (raw.users || raw.agents || []).length ? (raw.users || raw.agents) : base.users,
        settings: { ...base.settings, ...(raw.settings || {}) },
        project: raw.project || base.project,
        reports: raw.reports || {},
        programmes: raw.programmes || {},
        legacy: raw.legacy || null,
      };
      localStorage.setItem(KEY, JSON.stringify(migrated));
      return migrated;
    }
    const migrated = {
      ...base,
      consents: raw.consents || {},
      users: (raw.users || raw.agents || []).length ? (raw.users || raw.agents) : base.users,
      settings: { ...base.settings, ...(raw.settings || {}) },
      legacy: raw.reports && Object.keys(raw.reports).length
        ? { migratedAt: now(), fromVersion: sourceVersion, reports: raw.reports }
        : null,
    };
    save(migrated);
    return migrated;
  }

  function save(db) {
    db.schemaVersion = SCHEMA_VERSION;
    localStorage.setItem(KEY, JSON.stringify(db));
    try { window.dispatchEvent(new Event("p10354-data-saved")); } catch {}
    return db;
  }

  function getSyncConfig() {
    let cfg = {};
    try { cfg = JSON.parse(localStorage.getItem(SYNC_CONFIG_KEY) || "{}"); } catch {}
    const globalCfg = window.P10354_SYNC_CONFIG || {};
    const assess = window.ASSESS_CONFIG || {};
    const apiBase = String(
      cfg.apiBase
      || globalCfg.apiBase
      || assess.apiBase
      || (assess.apiUrl ? `${String(assess.apiUrl).replace(/\/$/, "")}/api` : "")
      || DEFAULT_API_BASE
    ).replace(/\/$/, "");
    const jwt = (typeof AssessAPI !== "undefined" && AssessAPI.tokens?.get?.()) || null;
    return {
      apiBase,
      token: String(cfg.token || globalCfg.token || ""),
      access: jwt?.access || "",
    };
  }

  function getSyncState() {
    try { return JSON.parse(localStorage.getItem(SYNC_STATE_KEY) || "{}"); } catch { return {}; }
  }

  function setSyncState(value) {
    localStorage.setItem(SYNC_STATE_KEY, JSON.stringify(value || {}));
    try { window.dispatchEvent(new Event("p10354-sync-state")); } catch {}
  }

  function updateQueue(status) {
    let queue = [];
    try { queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]"); } catch {}
    const next = queue.map((item) => item.status === "PENDING" ? { ...item, status } : item);
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(next.slice(-500)));
    try { window.dispatchEvent(new Event("p10354-data-saved")); } catch {}
  }

  function buildSyncSnapshot() {
    const db = load();
    return {
      schemaVersion: SCHEMA_VERSION,
      project: db.project || null,
      reports: db.reports || {},
      programmes: db.programmes || {},
      consents: db.consents || {},
      settings: db.settings || null,
    };
  }

  function mergeServerSnapshot(snapshot) {
    if (!snapshot) return load();
    const db = load();
    if (snapshot.project) {
      db.project = {
        ...(db.project || makeProject()),
        ...snapshot.project,
        reconciliation: {
          ...((db.project && db.project.reconciliation) || {}),
          ...(snapshot.project.reconciliation || {}),
        },
      };
    }
    if (snapshot.reports) {
      db.reports = { ...(db.reports || {}), ...snapshot.reports };
    }
    if (snapshot.programmes) {
      db.programmes = { ...(db.programmes || {}), ...snapshot.programmes };
    }
    if (snapshot.consents) {
      db.consents = { ...(db.consents || {}), ...snapshot.consents };
    }
    const settingsSrc = snapshot.settings || snapshot.project?.settings;
    if (settingsSrc) {
      db.settings = { ...db.settings, ...settingsSrc };
    }
    save(db);
    return db;
  }

  async function apiRequest(path, options = {}) {
    const cfg = getSyncConfig();
    const headers = { "Content-Type": "application/json", Accept: "application/json", ...(options.headers || {}) };
    if (cfg.access) headers.Authorization = `Bearer ${cfg.access}`;
    else if (cfg.token) headers["X-P10354-API-Key"] = cfg.token;
    let suffix = path.startsWith("/") ? path : `/${path}`;
    if (!suffix.endsWith("/") && !suffix.includes("?")) suffix += "/";
    const response = await fetch(`${cfg.apiBase}${suffix}`, { ...options, headers });
    let body = null;
    try { body = await response.json(); } catch {}
    if (!response.ok) {
      if (response.status === 401 && typeof AssessAPI !== "undefined") {
        AssessAPI.logout(true);
      }
      const message = body?.error || body?.detail || `Sync request failed (${response.status})`;
      throw new Error(typeof message === "string" ? message : `Sync request failed (${response.status})`);
    }
    return body;
  }

  function scheduleSync(delay = 1800) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = setTimeout(() => { syncTimer = null; syncNow(); }, delay);
  }

  async function syncEvidenceToServer() {
    const db = load();
    const ids = new Set();
    Object.values(db.reports || {}).forEach((report) => {
      (report.evidenceRegister || []).forEach((e) => e?.id && ids.add(e.id));
      Object.values(report.fieldQuestions || {}).forEach((q) => (q.evidence || []).forEach((e) => e?.id && ids.add(e.id)));
      Object.values(report.accessibility || {}).forEach((a) => (a.evidence || []).forEach((e) => e?.id && ids.add(e.id)));
    });
    for (const id of ids) {
      try {
        const local = await getFile(id);
        if (!local?.file) continue;
        const meta = { ...(local.meta || {}) };
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || "").split(",")[1] || "");
          reader.onerror = () => reject(reader.error || new Error("Could not read evidence file"));
          reader.readAsDataURL(local.file);
        });
        await apiRequest(`/evidence/upload/${encodeURIComponent(id)}/`, {
          method: "POST",
          body: JSON.stringify({
            id,
            name: local.file.name,
            type: local.file.type,
            size: local.file.size,
            meta,
            base64,
            schoolId: meta.schoolId || "",
            reportId: meta.reportId || "",
          }),
        });
      } catch (error) {
        console.warn("Evidence sync failed", id, error);
      }
    }
  }

  async function syncEvidenceFromServer() {
    try {
      const result = await apiRequest("/evidence/upload/");
      const files = Array.isArray(result.files) ? result.files : [];
      for (const meta of files) {
        if (!meta?.id || await getFile(meta.id)) continue;
        try {
          const cfg = getSyncConfig();
          const headers = {};
          if (cfg.access) headers.Authorization = `Bearer ${cfg.access}`;
          else if (cfg.token) headers["X-P10354-API-Key"] = cfg.token;
          const response = await fetch(`${cfg.apiBase}/evidence/download/${encodeURIComponent(meta.id)}/`, { headers });
          if (!response.ok) continue;
          const blob = await response.blob();
          const store = await openStore();
          await new Promise((resolve, reject) => {
            const tx = store.transaction("files", "readwrite");
            tx.objectStore("files").put({ id: meta.id, file: blob, meta: meta.meta || {} });
            tx.oncomplete = resolve;
            tx.onerror = () => reject(tx.error);
          });
        } catch (error) {
          console.warn("Evidence download failed", meta.id, error);
        }
      }
    } catch (error) {
      console.warn("Evidence index sync failed", error);
    }
  }

  async function hydrateFromServer() {
    if (!navigator.onLine) return { ok: false, reason: "offline" };
    const cfg = getSyncConfig();
    if (!cfg.access && !cfg.token) return { ok: false, reason: "not authenticated" };
    try {
      const result = await apiRequest("/sync/pull/", { method: "POST", body: "{}" });
      mergeServerSnapshot(result.snapshot);
      setSyncState({
        serverVersion: result.serverVersion || 0,
        status: "SYNCED",
        lastSyncAt: now(),
        deviceId: getDeviceId(),
      });
      try { window.dispatchEvent(new Event("p10354-sync-complete")); } catch {}
      return { ok: true, ...result };
    } catch (error) {
      setSyncState({ ...getSyncState(), status: "SYNC ERROR", lastError: error.message, deviceId: getDeviceId() });
      return { ok: false, reason: error.message };
    }
  }

  async function syncNow() {
    if (syncBusy || !navigator.onLine) return { ok: false, reason: "offline" };
    const cfg = getSyncConfig();
    if (!cfg.access && !cfg.token) return { ok: false, reason: "not authenticated" };
    syncBusy = true;
    setSyncState({ ...getSyncState(), status: "SYNCING", startedAt: now() });
    try {
      const state = getSyncState();
      const result = await apiRequest("/sync/push/", {
        method: "POST",
        body: JSON.stringify({
          deviceId: getDeviceId(),
          baseVersion: Number(state.serverVersion || 0),
          snapshot: buildSyncSnapshot(),
        }),
      });
      mergeServerSnapshot(result.snapshot);
      updateQueue("SYNCED");
      await syncEvidenceToServer();
      await syncEvidenceFromServer();
      setSyncState({ serverVersion: result.serverVersion || 0, status: "SYNCED", lastSyncAt: now(), deviceId: getDeviceId(), conflicts: result.conflicts || [] });
      try { window.dispatchEvent(new Event("p10354-sync-complete")); } catch {}
      return { ok: true, ...result };
    } catch (error) {
      setSyncState({ ...getSyncState(), status: "SYNC ERROR", lastError: error.message, deviceId: getDeviceId() });
      try { window.dispatchEvent(new Event("p10354-sync-complete")); } catch {}
      return { ok: false, reason: error.message };
    } finally { syncBusy = false; }
  }

  function getDeviceId() {
    const key = "p10354-device-id";
    let id = localStorage.getItem(key);
    if (!id) { id = uid("DEV"); localStorage.setItem(key, id); }
    return id;
  }

  function enqueueSync(event, actor, recordType, recordId) {
    let queue = [];
    try { queue = JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]"); } catch {}
    queue.push({ id: uid("SYNC"), at: now(), event, actor: actor || "System", recordType, recordId, status: "PENDING" });
    // Keep only the most recent local change history needed for later sync.
    localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue.slice(-500)));
    try { window.dispatchEvent(new Event("p10354-data-saved")); } catch {}
  }

  function pendingSyncCount() {
    try { return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || "[]").filter((x) => x.status === "PENDING").length; } catch { return 0; }
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
    enqueueSync(event || "Report saved", actor || "Field Auditor", "report", report.schoolId);
    scheduleSync();
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
    enqueueSync(event || "Project saved", actor || "System", "project", "PROJECT");
    scheduleSync();
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
    enqueueSync(event || "Programme workbook saved", actor || "System", "programme", record.regionId);
    scheduleSync();
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
    getDeviceId, getSyncConfig, getSyncState, pendingSyncCount, syncNow, scheduleSync, hydrateFromServer,
  };
})();

// Sync to Django/SQLite when authenticated and online.
const maybeSync = () => {
  if (!navigator.onLine) return;
  const tokens = (typeof AssessAPI !== "undefined" && AssessAPI.tokens?.get?.()) || null;
  if (!tokens?.access) return;
  P10354.syncNow();
};
setTimeout(maybeSync, 800);
addEventListener("online", maybeSync);
setInterval(maybeSync, 60000);

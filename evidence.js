/* P10354 Evidence Library — team-wide file browsing, preview and download. */
(() => {
  const F = FRAMEWORK;
  const host = document.querySelector('#evidence-library');
  if (!host) return;

  let state = {
    q: '', region: 'ALL', school: 'ALL', type: 'ALL', source: 'ALL',
    loading: false, status: '', items: [], preview: null,
  };

  const esc = UI.esc;
  const schoolById = (id) => P10354.school(id) || null;
  const localUrlCache = new Map();

  function titleCaseType(type) {
    const value = String(type || '').split('/').pop() || 'file';
    return value.toUpperCase();
  }

  function reportReferences() {
    const refs = new Map();
    Object.values(P10354.load().reports || {}).forEach((report) => {
      const school = schoolById(report.schoolId);
      const add = (entry, source) => {
        if (!entry?.id) return;
        const current = refs.get(entry.id) || {};
        refs.set(entry.id, {
          ...current,
          schoolId: report.schoolId,
          schoolName: school?.name || report.schoolId || 'Unknown school',
          region: school?.region || current.region || '',
          description: entry.description || current.description || '',
          source: source || current.source || '',
          stream: entry.stream || current.stream || '',
          capturedAt: entry.at || current.capturedAt || '',
        });
      };
      (report.evidenceRegister || []).forEach((e) => add(e, 'Evidence register'));
      Object.entries(report.fieldQuestions || {}).forEach(([qid, q]) => (q.evidence || []).forEach((e) => add(e, `${qid} verification`)));
      Object.entries(report.accessibility || {}).forEach(([area, row]) => (row.evidence || []).forEach((e) => add(e, `Accessibility · ${area}`)));
    });
    return refs;
  }

  function authHeaders() {
    const cfg = P10354.getSyncConfig();
    const headers = { Accept: "application/json" };
    if (cfg.access) headers.Authorization = `Bearer ${cfg.access}`;
    else if (cfg.token) headers["X-P10354-API-Key"] = cfg.token;
    return { cfg, headers };
  }

  async function fetchServerIndex() {
    const { cfg, headers } = authHeaders();
    if (!cfg.access && !cfg.token) {
      throw new Error("Sign in again to load team evidence from the server.");
    }
    const response = await fetch(`${cfg.apiBase}/evidence/upload/`, { headers });
    if (!response.ok) throw new Error(`Evidence service returned ${response.status}`);
    const body = await response.json();
    return Array.isArray(body.files) ? body.files : [];
  }

  async function loadIndex() {
    state.loading = true;
    state.status = '';
    render();
    const refs = reportReferences();
    const map = new Map();

    const localFiles = await P10354.listFiles().catch(() => []);
    localFiles.forEach((row) => {
      const file = row.file;
      const meta = row.meta || {};
      const ref = refs.get(row.id) || {};
      map.set(row.id, {
        id: row.id, name: file?.name || meta.name || row.id, type: file?.type || meta.type || 'application/octet-stream',
        size: file?.size || meta.size || 0, meta, local: true, ...ref,
      });
    });

    if (navigator.onLine) {
      try {
        const serverFiles = await fetchServerIndex();
        serverFiles.forEach((item) => {
          const ref = refs.get(item.id) || {};
          map.set(item.id, { ...map.get(item.id), ...item, ...ref, local: map.get(item.id)?.local === true });
        });
      } catch (error) {
        state.status = `Server evidence list unavailable. Showing files saved on this device. ${error.message}`;
      }
    } else {
      state.status = 'Offline. Showing evidence saved on this device.';
    }

    state.items = Array.from(map.values()).sort((a, b) => String(b.capturedAt || b.meta?.at || b.uploadedAt || '').localeCompare(String(a.capturedAt || a.meta?.at || a.uploadedAt || '')));
    state.loading = false;
    render();
  }

  function filters() {
    const regions = [...new Set(state.items.map((x) => x.region).filter(Boolean))].sort();
    const schools = [...new Map(state.items.filter(x => x.schoolId).map(x => [x.schoolId, x.schoolName || x.schoolId])).entries()].sort((a,b) => String(a[1]).localeCompare(String(b[1])));
    const types = [...new Set(state.items.map(x => titleCaseType(x.type)))].sort();
    return { regions, schools, types };
  }

  function filtered() {
    const q = state.q.trim().toLowerCase();
    return state.items.filter((item) => {
      if (state.region !== 'ALL' && item.region !== state.region) return false;
      if (state.school !== 'ALL' && item.schoolId !== state.school) return false;
      if (state.type !== 'ALL' && titleCaseType(item.type) !== state.type) return false;
      if (state.source !== 'ALL' && String(item.source || '').toLowerCase().includes(state.source.toLowerCase()) === false) return false;
      if (!q) return true;
      const hay = [item.name, item.description, item.schoolName, item.region, item.source, item.stream, item.id].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }

  function prettyBytes(bytes) {
    const n = Number(bytes || 0);
    if (!n) return '—';
    if (n < 1024) return `${n} B`;
    if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1073741824) return `${(n / 1048576).toFixed(1)} MB`;
    return `${(n / 1073741824).toFixed(1)} GB`;
  }

  function dateText(value) {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString();
  }

  async function blobFor(item) {
    if (item.local) {
      const row = await P10354.getFile(item.id);
      if (row?.file) return row.file instanceof Blob ? row.file : new Blob([row.file], { type: item.type });
    }
    const { cfg, headers } = authHeaders();
    if (!cfg.access && !cfg.token) throw new Error("Sign in again to download server evidence.");
    const response = await fetch(`${cfg.apiBase}/evidence/download/${encodeURIComponent(item.id)}/`, { headers });
    if (!response.ok) throw new Error(`Unable to retrieve file (${response.status})`);
    return response.blob();
  }

  async function openItem(item, mode = 'preview') {
    try {
      state.status = `${mode === 'download' ? 'Preparing download' : 'Opening'} ${item.name}…`;
      render();
      const blob = await blobFor(item);
      if (mode === 'download') {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = item.name || item.id; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        state.status = `Downloaded ${item.name}.`;
        render();
        return;
      }
      const url = URL.createObjectURL(blob);
      if (String(item.type).startsWith('image/') || item.type === 'application/pdf' || item.type.startsWith('text/')) {
        state.preview = { item, url };
        render();
      } else {
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
        state.status = `Opened ${item.name} in a new window.`;
        render();
      }
    } catch (error) {
      state.status = `Unable to open ${item.name}: ${error.message}`;
      render();
    }
  }

  function closePreview() {
    if (state.preview?.url) URL.revokeObjectURL(state.preview.url);
    state.preview = null;
    render();
  }

  function previewModal() {
    if (!state.preview) return '';
    const item = state.preview.item;
    const url = state.preview.url;
    let body = '';
    if (String(item.type).startsWith('image/')) {
      body = `<img class="evidence-preview-image" src="${url}" alt="${esc(item.name)}">`;
    } else if (item.type === 'application/pdf' || item.type.startsWith('text/')) {
      body = `<iframe class="evidence-preview-frame" src="${url}" title="${esc(item.name)}"></iframe>`;
    }
    return `<div class="modal-backdrop" data-close-preview><div class="modal card" role="dialog" aria-modal="true" aria-label="Evidence preview">
      <div class="modal-head"><div><b>${esc(item.name)}</b><small>${esc(item.schoolName || 'Team evidence')} · ${esc(item.region || '—')}</small></div><div class="actions"><button class="btn secondary small" data-action="download-preview">Download</button><button class="btn small" data-close-preview>Close</button></div></div>
      <div class="modal-body">${body || `<div class="empty">This file type is not previewed in the browser. Use Download to open it with the appropriate application.</div>`}</div>
    </div></div>`;
  }

  function render() {
    UI.reset();
    const { regions, schools, types } = filters();
    const rows = filtered();
    host.innerHTML = `
      <div class="heading"><div><h1>Evidence Library</h1><p>Shared project evidence uploaded by the assessment team. Files are available to the team and linked back to their school/assessment where possible.</p></div><div class="actions"><button id="refreshEvidence" class="btn secondary">Refresh</button></div></div>
      ${state.status ? `<div class="notice ${state.status.startsWith('Unable') || state.status.startsWith('Server') ? 'red' : 'green'}">${esc(state.status)}</div>` : ''}
      <section class="card pad hero">
        <div class="grid compact">
          <article class="metric blue"><small>Total evidence</small><b>${state.items.length}</b></article>
          <article class="metric green"><small>Shown</small><b>${rows.length}</b></article>
          <article class="metric amber"><small>Photos / images</small><b>${state.items.filter(x => String(x.type).startsWith('image/')).length}</b></article>
          <article class="metric"><small>Documents</small><b>${state.items.filter(x => !String(x.type).startsWith('image/')).length}</b></article>
        </div>
      </section>
      <section class="card pad">
        <div class="section-head"><div><h2>Find evidence</h2><p class="help">Search by filename, school, region, question, stream or description.</p></div></div>
        <div class="fieldgrid evidence-filters">
          ${UI.field({ label: 'Search', value: state.q, placeholder: 'e.g. classroom, attendance, photo', onChange: (v) => { state.q = v; render(); } })}
          ${UI.field({ label: 'Region', type: 'select', value: state.region, options: [{ value: 'ALL', label: 'All regions' }, ...regions.map(r => ({ value: r, label: r }))], onChange: (v) => { state.region = v; render(); } })}
          ${UI.field({ label: 'School', type: 'select', value: state.school, options: [{ value: 'ALL', label: 'All schools' }, ...schools.map(([id, name]) => ({ value: id, label: name }))], onChange: (v) => { state.school = v; render(); } })}
          ${UI.field({ label: 'File type', type: 'select', value: state.type, options: [{ value: 'ALL', label: 'All types' }, ...types.map(t => ({ value: t, label: t }))], onChange: (v) => { state.type = v; render(); } })}
        </div>
      </section>
      <section class="card"><div class="pad section-head"><div><h2>Files</h2><p class="help">${rows.length} matching file${rows.length === 1 ? '' : 's'}.</p></div></div>
        <div class="tablewrap"><table><thead><tr><th>File</th><th>School</th><th>Region</th><th>Attached to</th><th>Type</th><th>Size</th><th>Date</th><th>Actions</th></tr></thead><tbody>
          ${state.loading ? `<tr><td colspan="8" class="empty">Loading evidence…</td></tr>` : rows.length ? rows.map(item => `<tr>
            <td><b>${esc(item.name)}</b><small class="help">${esc(item.description || item.stream || '')}</small></td>
            <td>${esc(item.schoolName || '—')}</td>
            <td>${esc(item.region || '—')}</td>
            <td>${esc(item.source || item.meta?.path || '—')}</td>
            <td>${pillType(item.type)}</td>
            <td>${esc(prettyBytes(item.size))}</td>
            <td>${esc(dateText(item.capturedAt || item.meta?.at || item.uploadedAt))}</td>
            <td><div class="actions"><button class="btn secondary small" data-preview="${esc(item.id)}">View</button><button class="btn small" data-download="${esc(item.id)}">Download</button></div></td>
          </tr>`).join('') : `<tr><td colspan="8" class="empty">No evidence files match the current filters.</td></tr>`}
        </tbody></table></div>
      </section>
      ${previewModal()}
    `;
    UI.wire(host);
    host.querySelector('#refreshEvidence')?.addEventListener('click', loadIndex);
    host.querySelectorAll('[data-preview]').forEach((el) => el.addEventListener('click', () => {
      const item = state.items.find(x => x.id === el.dataset.preview); if (item) openItem(item, 'preview');
    }));
    host.querySelectorAll('[data-download]').forEach((el) => el.addEventListener('click', () => {
      const item = state.items.find(x => x.id === el.dataset.download); if (item) openItem(item, 'download');
    }));
    host.querySelectorAll('[data-close-preview]').forEach((el) => el.addEventListener('click', (e) => {
      if (e.target.matches('[data-close-preview]')) closePreview();
    }));
    host.querySelector('[data-action="download-preview"]')?.addEventListener('click', () => state.preview && openItem(state.preview.item, 'download'));
    if (state.preview && !host.querySelector('.modal-backdrop')) closePreview();
  }

  function pillType(type) {
    return `<span class="pill active">${esc(titleCaseType(type))}</span>`;
  }

  (async () => { if (!(await UI.gateAuth())) return; UI.chrome(); })();
  loadIndex();
  addEventListener('p10354-sync-complete', loadIndex);
  addEventListener('online', loadIndex);
})();

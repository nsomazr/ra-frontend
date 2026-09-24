const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = path.join(__dirname, 'data');
const EVIDENCE_DIR = path.join(DATA_DIR, 'evidence');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const STATE_FILE = path.join(DATA_DIR, 'state.json');
const AUDIT_FILE = path.join(DATA_DIR, 'audit.jsonl');
const PORT = Number(process.env.PORT || 8080);
const API_KEY = String(process.env.P10354_API_KEY || '');
const MAX_BODY = 35 * 1024 * 1024;

for (const dir of [DATA_DIR, EVIDENCE_DIR, BACKUP_DIR]) fs.mkdirSync(dir, { recursive: true });

function now() { return new Date().toISOString(); }
function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
    'Access-Control-Allow-Headers': 'Content-Type, X-P10354-API-Key',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}
function send(res, status, body, type='text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Content-Length': Buffer.isBuffer(body) ? body.length : Buffer.byteLength(body),
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}
function readJson(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    let size = 0;
    req.on('data', chunk => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error('Request is too large'));
        req.destroy();
        return;
      }
      raw += chunk;
    });
    req.on('end', () => {
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch { reject(new Error('Invalid JSON body')); }
    });
    req.on('error', reject);
  });
}
function loadState() {
  try {
    return JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
  } catch {
    return { version: 0, updatedAt: '', snapshot: { schemaVersion: 5, project: null, reports: {}, programmes: {}, consents: {} } };
  }
}
function saveState(state) {
  const current = loadState();
  if (current.version) {
    const backup = path.join(BACKUP_DIR, `state-${current.version}.json`);
    fs.writeFileSync(backup, JSON.stringify(current, null, 2));
    const backups = fs.readdirSync(BACKUP_DIR).filter(f => /^state-\d+\.json$/.test(f)).sort((a,b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));
    while (backups.length > 5) fs.unlinkSync(path.join(BACKUP_DIR, backups.shift()));
  }
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}
function audit(event) {
  fs.appendFileSync(AUDIT_FILE, JSON.stringify({ at: now(), ...event }) + '\n');
}
function newest(a, b) {
  const ta = new Date(a?.updatedAt || 0).getTime();
  const tb = new Date(b?.updatedAt || 0).getTime();
  return tb >= ta ? b : a;
}
function mergeMaps(serverMap = {}, incomingMap = {}) {
  const merged = { ...serverMap };
  const conflicts = [];
  for (const [id, incoming] of Object.entries(incomingMap || {})) {
    if (!merged[id]) { merged[id] = incoming; continue; }
    if (JSON.stringify(merged[id]) === JSON.stringify(incoming)) continue;
    const chosen = newest(merged[id], incoming);
    conflicts.push({ record: id, winner: chosen === incoming ? 'incoming' : 'server' });
    merged[id] = chosen;
  }
  return { merged, conflicts };
}
function mergeSnapshots(serverSnapshot = {}, incomingSnapshot = {}) {
  const conflicts = [];
  const project = serverSnapshot.project && incomingSnapshot.project
    ? newest(serverSnapshot.project, incomingSnapshot.project)
    : (incomingSnapshot.project || serverSnapshot.project || null);
  const reports = mergeMaps(serverSnapshot.reports, incomingSnapshot.reports);
  const programmes = mergeMaps(serverSnapshot.programmes, incomingSnapshot.programmes);
  const consents = mergeMaps(serverSnapshot.consents, incomingSnapshot.consents);
  conflicts.push(...reports.conflicts.map(c => ({ ...c, type: 'report' })));
  conflicts.push(...programmes.conflicts.map(c => ({ ...c, type: 'programme' })));
  conflicts.push(...consents.conflicts.map(c => ({ ...c, type: 'consent' })));
  if (serverSnapshot.project && incomingSnapshot.project && JSON.stringify(serverSnapshot.project) !== JSON.stringify(incomingSnapshot.project)) {
    conflicts.push({ type: 'project', record: 'PROJECT', winner: project === incomingSnapshot.project ? 'incoming' : 'server' });
  }
  return {
    schemaVersion: incomingSnapshot.schemaVersion || serverSnapshot.schemaVersion || 5,
    project,
    reports: reports.merged,
    programmes: programmes.merged,
    consents: consents.merged,
    __conflicts: conflicts,
  };
}
function auth(req) {
  if (!API_KEY) return true;
  return req.headers['x-p10354-api-key'] === API_KEY;
}
function safeFileName(name) { return path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_'); }
function contentType(file) {
  const ext = path.extname(file).toLowerCase();
  return ({ '.html':'text/html; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.css':'text/css; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.webp':'image/webp', '.ico':'image/x-icon' })[ext] || 'application/octet-stream';
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*', 'Access-Control-Allow-Headers': 'Content-Type, X-P10354-API-Key', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS' }); return res.end(); }
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    if (url.pathname.startsWith('/api/')) {
      if (!auth(req)) return json(res, 401, { error: 'API authentication failed' });
      if (url.pathname === '/api/health' && req.method === 'GET') return json(res, 200, { ok: true, service: 'P10354 API', time: now(), serverVersion: loadState().version });
      if (url.pathname === '/api/sync/push' && req.method === 'POST') {
        const body = await readJson(req);
        if (!body.snapshot || typeof body.snapshot !== 'object') return json(res, 400, { error: 'snapshot is required' });
        const current = loadState();
        const incoming = body.snapshot;
        const baseVersion = Number(body.baseVersion || 0);
        let snapshot;
        let conflicts = [];
        if (baseVersion === current.version) {
          snapshot = mergeSnapshots(current.snapshot, incoming);
        } else {
          snapshot = mergeSnapshots(current.snapshot, incoming);
          conflicts.push({ type: 'version', record: 'SNAPSHOT', serverVersion: current.version, deviceBaseVersion: baseVersion });
        }
        conflicts = conflicts.concat(snapshot.__conflicts || []);
        delete snapshot.__conflicts;
        const unchanged = JSON.stringify(snapshot) === JSON.stringify(current.snapshot || {});
        const next = unchanged
          ? current
          : { version: current.version + 1, updatedAt: now(), snapshot };
        if (!unchanged) saveState(next);
        audit({ event: 'SYNC_PUSH', deviceId: body.deviceId || 'UNKNOWN', baseVersion, newVersion: next.version, changed: !unchanged, conflicts: conflicts.length });
        return json(res, 200, { ok: true, serverVersion: next.version, snapshot: next.snapshot, conflicts });
      }
      if (url.pathname === '/api/sync/pull' && req.method === 'POST') {
        const body = await readJson(req);
        const current = loadState();
        audit({ event: 'SYNC_PULL', deviceId: body.deviceId || 'UNKNOWN', version: current.version });
        return json(res, 200, { ok: true, serverVersion: current.version, snapshot: current.snapshot });
      }
      if (url.pathname === '/api/evidence' && req.method === 'GET') {
        const files = fs.readdirSync(EVIDENCE_DIR).filter(f => f.endsWith('.meta.json')).map(f => {
          try { return JSON.parse(fs.readFileSync(path.join(EVIDENCE_DIR, f), 'utf8')); } catch { return null; }
        }).filter(Boolean);
        return json(res, 200, { ok: true, files });
      }
      const evidenceMatch = url.pathname.match(/^\/api\/evidence\/([^/]+)$/);
      if (evidenceMatch && req.method === 'POST') {
        const body = await readJson(req);
        if (!body.id || !body.base64) return json(res, 400, { error: 'id and base64 are required' });
        const buffer = Buffer.from(body.base64, 'base64');
        const safeId = safeFileName(body.id);
        const dataFile = path.join(EVIDENCE_DIR, safeId);
        const metaFile = path.join(EVIDENCE_DIR, `${safeId}.meta.json`);
        fs.writeFileSync(dataFile, buffer);
        fs.writeFileSync(metaFile, JSON.stringify({ id: body.id, name: body.name || safeId, type: body.type || 'application/octet-stream', size: body.size || buffer.length, meta: body.meta || {}, sha256: crypto.createHash('sha256').update(buffer).digest('hex') }, null, 2));
        audit({ event: 'EVIDENCE_UPLOAD', deviceId: req.headers['x-p10354-device-id'] || 'UNKNOWN', evidenceId: body.id, size: buffer.length });
        return json(res, 200, { ok: true, id: body.id });
      }
      if (evidenceMatch && req.method === 'GET') {
        const safeId = safeFileName(evidenceMatch[1]);
        const file = path.join(EVIDENCE_DIR, safeId);
        if (!fs.existsSync(file)) return json(res, 404, { error: 'Evidence not found' });
        return send(res, 200, fs.readFileSync(file), 'application/octet-stream');
      }
      return json(res, 404, { error: 'API route not found' });
    }

    let pathname = decodeURIComponent(url.pathname);
    if (pathname === '/') pathname = '/index.html';
    const file = path.resolve(ROOT, '.' + pathname);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return send(res, 404, 'Not found');
    return send(res, 200, fs.readFileSync(file), contentType(file));
  } catch (error) {
    console.error(error);
    if (!res.headersSent) json(res, 500, { error: error.message || 'Server error' });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`P10354 server running at http://localhost:${PORT}`);
  console.log(`API authentication: ${API_KEY ? 'enabled' : 'disabled (set P10354_API_KEY for deployment)'}`);
});

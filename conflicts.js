(() => {
  const { esc, button, pill } = UI;
  function value(v) {
    if (v === undefined) return '<em>Not present</em>';
    return `<pre class="conflict-value">${esc(typeof v === "string" ? v : JSON.stringify(v, null, 2))}</pre>`;
  }
  async function render() {
    const host = UI.$("#conflicts");
    UI.reset();
    const conflicts = await P10354.getSyncConflicts();
    host.innerHTML = `<div class="heading"><div><h1>Synchronization conflicts</h1><p>Only changes made to the exact same field at the same time require a decision.</p></div><div class="actions"><a class="btn secondary" href="dashboard.html">Back to Command Centre</a></div></div>
      ${conflicts.length ? `<section class="card pad"><p class="help">${conflicts.length} conflict${conflicts.length===1?"":"s"} waiting for review. Different fields are merged automatically.</p></section>${conflicts.map(c => `<section class="card pad conflict-card"><div class="section-head"><div><h2>${esc(c.type || "Record")} · ${esc(c.recordId || c.record || "")}</h2><p class="help">${esc(c.summary || "Concurrent change detected")} · ${new Date(c.detectedAt).toLocaleString()}</p></div>${pill("OPEN", "alert")}</div><div class="grid compact"><div><b>Existing server value</b>${value(c.serverValue)}</div><div><b>Other auditor's value</b>${value(c.incomingValue)}</div></div><div class="actions"><button class="btn secondary" data-choice="server" data-id="${esc(c.id)}">Keep server value</button><button class="btn" data-choice="incoming" data-id="${esc(c.id)}">Use other auditor's value</button></div></section>`).join("")}` : `<section class="card pad"><h2>No unresolved conflicts</h2><p class="help">The server has merged non-conflicting changes automatically.</p></section>`}`;
    host.querySelectorAll('[data-choice]').forEach(btn => btn.onclick = async () => {
      btn.disabled = true;
      try { await P10354.resolveSyncConflict(btn.dataset.id, btn.dataset.choice); await render(); } catch (e) { alert(e.message); btn.disabled = false; }
    });
  }
  (async () => { if (!(await UI.gateAuth())) return; UI.chrome(); render(); })();
})();

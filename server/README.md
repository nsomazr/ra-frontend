# P10354 Server / API

This folder provides the server-side API and synchronization service for the P10354 field assessment system.

## Requirements

- Node.js 18 or newer
- A writable `server/data/` directory

## Start on Windows

From the `P10354_Field_Audit_Web` folder:

```bat
start-server.bat
```

Or:

```bash
node server/server.js
```

Then open:

`http://localhost:8080`

## API endpoints

- `GET /api/health` — server health and current data version
- `POST /api/sync/push` — sends the offline/local snapshot to the server
- `POST /api/sync/pull` — retrieves the current server snapshot
- `POST /api/evidence/:id` — uploads an evidence file
- `GET /api/evidence` — lists server evidence files
- `GET /api/evidence/:id` — downloads an evidence file

The client automatically attempts synchronization when it is online, every 60 seconds, and when the user clicks the sync status button.

## Optional API key

For a controlled/internal deployment, set `P10354_API_KEY` before starting the server. The browser client can be configured with the same token in `sync-config.js` or browser storage.

Example (Windows CMD):

```bat
set P10354_API_KEY=replace-with-a-long-random-value
node server/server.js
```

Example (PowerShell):

```powershell
$env:P10354_API_KEY="replace-with-a-long-random-value"
node server/server.js
```

For public production deployment, put the service behind HTTPS and a proper authentication layer/reverse proxy rather than relying only on a browser-held API key.

## How synchronization works

1. Field users continue working from the local browser cache when offline.
2. Changes are kept in the local pending queue.
3. When online, the client sends the project, report, programme and consent data to `/api/sync/push`.
4. The server stores a versioned snapshot in `server/data/state.json` and keeps the last five backups.
5. When two copies have changed, records are reconciled at record level using their `updatedAt` values. The server returns a conflict list instead of silently hiding the fact that a merge occurred.
6. Evidence files are uploaded separately and stored under `server/data/evidence/`.
7. Synchronization events are recorded in `server/data/audit.jsonl`.

## REET visual branding
The current build includes the supplied REET logo in `assets/reet-logo.png` and the cropped application icon in `assets/reet-icon.png`. The shared header, dashboard, field forms and executive report use the same REET visual language.

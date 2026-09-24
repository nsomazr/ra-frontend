# ra-frontend

Static field assessment client (P10354), served by Node on port **3087**.

Deployed **independently** from the API.

| | |
| --- | --- |
| Public URL | https://assess.nileagi.com |
| PM2 | `assess-frontend` on `:3087` |
| API | https://api.assess.nileagi.com (browser → API directly) |

## Deploy

```bash
cp -n .env.example .env
# API_URL=https://api.assess.nileagi.com
./deploy.sh
```

Nginx should proxy `assess.nileagi.com` → `127.0.0.1:3087`.

## Local

```bash
./start.sh
```

Uses `API_URL=http://127.0.0.1:8087` from `.env` (start the API separately).

## Logins

| Role | Username | Password |
| --- | --- | --- |
| Admin | `Angel` | `ChangeMeNow!` |
| View only | `viewer` | `ViewOnly123!` |

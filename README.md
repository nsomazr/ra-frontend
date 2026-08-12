# ra-frontend

Node.js static server for the P10354 field assessment client (vanilla HTML/CSS/JS).

- **Public URL:** https://assess.nileagi.com
- **PM2 port:** `3087`
- **API:** https://api.assess.nileagi.com (injected via `/config.js`)

## Admin login

| | |
| --- | --- |
| URL | http://localhost:3087/login.html (prod: https://assess.nileagi.com/login.html) |
| Username | `Angel` |
| Password | `ChangeMeNow!` |

Admins land on **Administration** (`admin.html`) after sign-in. Change the password via `BOOTSTRAP_ADMIN_*` in `ra-backend/.env` and re-run `python manage.py seed_framework`.

## Local

```bash
./start.sh
```

Opens on http://localhost:3087 with `API_URL` from `.env` (defaults to `http://127.0.0.1:8087`).

## Production

```bash
cp .env.example .env   # API_URL=https://api.assess.nileagi.com
./deploy.sh            # npm install + pm2 start server.js
```

Point the reverse proxy for `assess.nileagi.com` at `127.0.0.1:3087`.

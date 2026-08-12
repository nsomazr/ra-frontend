/**
 * P10354 field assessment — Node.js static server.
 * Serves the vanilla HTML/JS client and injects runtime API config.
 *
 * Local:  http://localhost:3087
 * Public: https://assess.nileagi.com  (reverse proxy -> :3087)
 * API:    https://api.assess.nileagi.com
 */
const path = require("path");
const express = require("express");
require("dotenv").config();

const PORT = Number(process.env.PORT || process.env.FRONTEND_PORT || 3087);
const API_URL = (process.env.API_URL || "https://api.assess.nileagi.com").replace(/\/$/, "");
const ROOT = __dirname;

const app = express();

app.disable("x-powered-by");

app.get("/config.js", (_req, res) => {
  res.type("application/javascript");
  res.set("Cache-Control", "no-store");
  res.send(
    `window.ASSESS_CONFIG = Object.freeze(${JSON.stringify({
      apiUrl: API_URL,
      apiBase: `${API_URL}/api`,
      publicUrl: process.env.PUBLIC_URL || "https://assess.nileagi.com",
      env: process.env.NODE_ENV || "production",
    })});\n`
  );
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "assess-frontend", apiUrl: API_URL });
});

app.use(express.static(ROOT, {
  extensions: ["html"],
  setHeaders(res, filePath) {
    if (filePath.endsWith(".html") || filePath.endsWith(".js")) {
      res.setHeader("Cache-Control", "no-cache");
    }
  },
}));

app.get("*", (req, res, next) => {
  if (req.path.includes(".")) return next();
  res.sendFile(path.join(ROOT, "index.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`assess-frontend listening on http://0.0.0.0:${PORT}`);
  console.log(`API_URL=${API_URL}`);
});

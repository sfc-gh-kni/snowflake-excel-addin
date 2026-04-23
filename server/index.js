require("dotenv").config();
const express = require("express");
const cors = require("cors");
const https = require("https");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const axios = require("axios");
const {
  executeSQL,
  getDatabases,
  getSchemas,
  getTables,
  getViews,
  getColumns,
  getWarehouses,
  formatResults,
  getAccountUrl,
} = require("./snowflake");

const app = express();
app.use(cors({ origin: "*" }));
app.use(express.json());

app.use(express.static(path.join(__dirname, "../dist")));
app.use("/assets", express.static(path.join(__dirname, "../assets")));

const CLIENT_ID = process.env.OAUTH_CLIENT_ID || "";
const REDIRECT_URI = process.env.OAUTH_REDIRECT_URI || "https://localhost:3000/oauth/callback";

const pkceStore = new Map();

function generatePKCE() {
  const verifier = crypto.randomBytes(48).toString("base64url");
  const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

app.get("/oauth/start", (req, res) => {
  const { account } = req.query;
  if (!account) return res.status(400).send("Missing account");

  const { verifier, challenge } = generatePKCE();
  const state = crypto.randomBytes(16).toString("hex");

  pkceStore.set(state, { verifier, account });
  setTimeout(() => pkceStore.delete(state), 10 * 60 * 1000);

  const baseUrl = getAccountUrl(account);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    state,
    code_challenge: challenge,
    code_challenge_method: "S256",
    scope: "session:role:PUBLIC refresh_token",
  });

  res.redirect(`${baseUrl}/oauth/authorize?${params}`);
});

app.get("/oauth/callback", async (req, res) => {
  const { code, state, error, error_description } = req.query;

  if (error) {
    return res.send(callbackPage({ error: error_description || error }));
  }

  const stored = pkceStore.get(state);
  if (!stored) {
    return res.send(callbackPage({ error: "Invalid or expired session. Please try again." }));
  }

  pkceStore.delete(state);

  try {
    const { verifier, account } = stored;
    const baseUrl = getAccountUrl(account);

    const tokenRes = await axios.post(
      `${baseUrl}/oauth/token-request`,
      new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        code_verifier: verifier,
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );

    const { access_token, refresh_token } = tokenRes.data;
    res.send(callbackPage({ token: access_token, refreshToken: refresh_token, account }));
  } catch (err) {
    const msg = err.response?.data?.message || err.response?.data?.error_description || err.message;
    res.send(callbackPage({ error: msg }));
  }
});

function callbackPage({ token, refreshToken, account, error } = {}) {
  const payload = error
    ? JSON.stringify({ error })
    : JSON.stringify({ token, refreshToken, account, tokenType: "oauth" });

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Signing in…</title>
  <script src="https://appsforoffice.microsoft.com/lib/1.1/hosted/office.js"></script>
  <style>
    body { font-family: -apple-system, sans-serif; display: flex; align-items: center;
           justify-content: center; height: 100vh; margin: 0; background: #f9fafb; }
    .box { text-align: center; color: ${error ? "#ef4444" : "#1a2b4a"}; }
    .icon { font-size: 40px; margin-bottom: 12px; }
    p { color: #6b7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon">${error ? "✗" : "✓"}</div>
    <h2>${error ? "Sign-in failed" : "Signed in successfully"}</h2>
    <p>${error ? String(error) : "You can close this window."}</p>
  </div>
  <script>
    Office.onReady(function() {
      Office.context.ui.messageParent(${JSON.stringify(payload)});
    });
  </script>
</body>
</html>`;
}

function getConn(req) {
  const { account, token, tokenType, warehouse, database, schema } = req.body;
  return { account, token, tokenType, warehouse, database, schema };
}

app.post("/api/auth/verify", async (req, res) => {
  try {
    const conn = getConn(req);
    const raw = await executeSQL({ ...conn, sql: "SELECT CURRENT_USER(), CURRENT_ACCOUNT(), CURRENT_WAREHOUSE()" });
    const result = formatResults(raw);
    res.json({ success: true, user: result.rows[0] });
  } catch (err) {
    res.status(401).json({ error: err.response?.data?.message || err.message });
  }
});

app.post("/api/warehouses", async (req, res) => {
  try {
    const conn = getConn(req);
    const raw = await getWarehouses(conn);
    res.json(formatResults(raw));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post("/api/databases", async (req, res) => {
  try {
    const conn = getConn(req);
    const raw = await getDatabases(conn);
    res.json(formatResults(raw));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post("/api/schemas", async (req, res) => {
  try {
    const conn = getConn(req);
    const { database } = req.body;
    const raw = await getSchemas(conn, database);
    res.json(formatResults(raw));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post("/api/tables", async (req, res) => {
  try {
    const conn = getConn(req);
    const { database, schema } = req.body;
    const [tablesRaw, viewsRaw] = await Promise.all([
      getTables(conn, database, schema),
      getViews(conn, database, schema),
    ]);
    const tables = formatResults(tablesRaw);
    const views = formatResults(viewsRaw);
    res.json({
      columns: tables.columns,
      rows: [
        ...tables.rows.map((r) => ({ ...r, _kind: "table" })),
        ...views.rows.map((r) => ({ ...r, _kind: "view" })),
      ],
    });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post("/api/columns", async (req, res) => {
  try {
    const conn = getConn(req);
    const { database, schema, table } = req.body;
    const raw = await getColumns(conn, database, schema, table);
    res.json(formatResults(raw));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post("/api/execute", async (req, res) => {
  try {
    const conn = getConn(req);
    const { sql, params } = req.body;

    let resolvedSql = sql;
    if (params && Object.keys(params).length > 0) {
      for (const [key, value] of Object.entries(params)) {
        resolvedSql = resolvedSql.replace(
          new RegExp(`:${key}\\b`, "g"),
          typeof value === "string" ? `'${value}'` : value
        );
      }
    }

    const raw = await executeSQL({ ...conn, sql: resolvedSql });
    res.json(formatResults(raw));
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

app.post("/api/preview", async (req, res) => {
  try {
    const conn = getConn(req);
    const { database, schema, table, columns, filters, limit } = req.body;

    const cols = columns && columns.length > 0 ? columns.map((c) => `"${c}"`).join(", ") : "*";
    const whereClauses = (filters || [])
      .filter((f) => f.column && f.operator)
      .map((f) => {
        const col = `"${f.column}"`;
        switch (f.operator) {
          case "IS NULL":      return `${col} IS NULL`;
          case "IS NOT NULL":  return `${col} IS NOT NULL`;
          case "EQUALS":       return `${col} = '${f.value}'`;
          case "NOT EQUALS":   return `${col} != '${f.value}'`;
          case "LIKE":         return `${col} LIKE '${f.value}'`;
          case "ILIKE":        return `${col} ILIKE '${f.value}'`;
          case "CONTAINS":     return `${col} ILIKE '%${f.value}%'`;
          case "STARTS WITH":  return `${col} ILIKE '${f.value}%'`;
          case "ENDS WITH":    return `${col} ILIKE '%${f.value}'`;
          case "IN":           return `${col} IN (${f.value.split(",").map((v) => `'${v.trim()}'`).join(", ")})`;
          default:             return null;
        }
      })
      .filter(Boolean);

    const where = whereClauses.length > 0 ? `WHERE ${whereClauses.join(" AND ")}` : "";
    const rowLimit = limit ? `LIMIT ${parseInt(limit, 10)}` : "LIMIT 1000";
    const sql = `SELECT ${cols} FROM "${database}"."${schema}"."${table}" ${where} ${rowLimit}`;

    const raw = await executeSQL({ ...conn, sql });
    res.json({ ...formatResults(raw), sql });
  } catch (err) {
    res.status(500).json({ error: err.response?.data?.message || err.message });
  }
});

const PORT = process.env.PORT || 3000;
const useHttps = process.env.HTTPS === "true";

if (useHttps && fs.existsSync(path.join(__dirname, "cert.pem"))) {
  const options = {
    key: fs.readFileSync(path.join(__dirname, "key.pem")),
    cert: fs.readFileSync(path.join(__dirname, "cert.pem")),
  };
  https.createServer(options, app).listen(PORT, () => {
    console.log(`Snowflake Add-in server running at https://localhost:${PORT}`);
  });
} else {
  app.listen(PORT, () => {
    console.log(`Snowflake Add-in server running at http://localhost:${PORT}`);
  });
}

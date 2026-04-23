const axios = require("axios");

function getAccountUrl(account) {
  const id = account.replace(/_/g, "-").toLowerCase();
  return `https://${id}.snowflakecomputing.com`;
}

async function executeSQL({ account, token, tokenType, sql, warehouse, database, schema }) {
  const baseUrl = getAccountUrl(account);
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-Snowflake-Authorization-Token-Type": tokenType === "pat" ? "PROGRAMMATIC_ACCESS_TOKEN" : "OAUTH",
  };

  if (tokenType === "basic") {
    headers["Authorization"] = `Basic ${token}`;
    headers["X-Snowflake-Authorization-Token-Type"] = undefined;
    delete headers["X-Snowflake-Authorization-Token-Type"];
  } else {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const body = {
    statement: sql,
    timeout: 60,
    ...(warehouse && { warehouse }),
    ...(database && { database }),
    ...(schema && { schema }),
  };

  const res = await axios.post(`${baseUrl}/api/v2/statements`, body, { headers });
  return res.data;
}

async function pollStatement({ account, token, tokenType, statementHandle }) {
  const baseUrl = getAccountUrl(account);
  const headers = buildAuthHeaders(token, tokenType);
  const res = await axios.get(`${baseUrl}/api/v2/statements/${statementHandle}`, { headers });
  return res.data;
}

async function getWarehouses(conn) {
  return executeSQL({ ...conn, sql: "SHOW WAREHOUSES" });
}

async function getDatabases(conn) {
  return executeSQL({ ...conn, sql: "SHOW DATABASES" });
}

async function getSchemas(conn, database) {
  return executeSQL({ ...conn, sql: `SHOW SCHEMAS IN DATABASE "${database}"` });
}

async function getTables(conn, database, schema) {
  return executeSQL({
    ...conn,
    sql: `SHOW TABLES IN SCHEMA "${database}"."${schema}"`,
  });
}

async function getViews(conn, database, schema) {
  return executeSQL({
    ...conn,
    sql: `SHOW VIEWS IN SCHEMA "${database}"."${schema}"`,
  });
}

async function getColumns(conn, database, schema, table) {
  return executeSQL({
    ...conn,
    sql: `SHOW COLUMNS IN TABLE "${database}"."${schema}"."${table}"`,
  });
}

function buildAuthHeaders(token, tokenType) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };
  if (tokenType === "basic") {
    headers["Authorization"] = `Basic ${token}`;
  } else if (tokenType === "pat") {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Snowflake-Authorization-Token-Type"] = "PROGRAMMATIC_ACCESS_TOKEN";
  } else {
    headers["Authorization"] = `Bearer ${token}`;
    headers["X-Snowflake-Authorization-Token-Type"] = "OAUTH";
  }
  return headers;
}

async function loginBasic({ account, username, password }) {
  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  const testConn = { account, token: credentials, tokenType: "basic" };
  await executeSQL({ ...testConn, sql: "SELECT CURRENT_USER()" });
  return { token: credentials, tokenType: "basic", account };
}

function formatResults(apiResponse) {
  if (!apiResponse || !apiResponse.resultSetMetaData) return { columns: [], rows: [] };

  const columns = apiResponse.resultSetMetaData.rowType.map((col) => ({
    name: col.name,
    type: col.type,
  }));

  const rows = (apiResponse.data || []).map((row) =>
    Object.fromEntries(row.map((val, i) => [columns[i].name, val]))
  );

  return { columns, rows };
}

module.exports = {
  executeSQL,
  pollStatement,
  getDatabases,
  getSchemas,
  getTables,
  getViews,
  getColumns,
  getWarehouses,
  loginBasic,
  formatResults,
  getAccountUrl,
};

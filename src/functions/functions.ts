// Uses a relative path so it works on any host (localhost, SPCS, etc.)
const API_BASE = "/api";

function getSession(): { account: string; token: string; tokenType: string } | null {
  try {
    const raw = localStorage.getItem("sf_session");
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function callAPI(path: string, body: object): Promise<unknown> {
  const session = getSession();
  if (!session) throw new CustomFunctions.Error(CustomFunctions.ErrorCode.invalidValue, "Not signed in. Open the Snowflake pane to authenticate.");

  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...session, ...body }),
  });
  const data = await res.json();
  if (!res.ok) throw new CustomFunctions.Error(CustomFunctions.ErrorCode.invalidValue, data.error || "Query failed");
  return data;
}

/**
 * Import rows from a Snowflake table.
 * @customfunction
 * @param {string} tableRef Fully qualified table name: DATABASE.SCHEMA.TABLE
 * @param {string[][]} [columns] Column names to import (optional)
 * @param {number} [limit] Max rows to return (default 1000)
 * @returns {Promise<string[][]>} Table data as a 2D array
 */
export async function TABLE(
  tableRef: string,
  columns?: string[][],
  limit?: number
): Promise<string[][]> {
  const parts = tableRef.split(".");
  if (parts.length !== 3) {
    throw new CustomFunctions.Error(
      CustomFunctions.ErrorCode.invalidValue,
      `Expected DATABASE.SCHEMA.TABLE, got: ${tableRef}`
    );
  }
  const [database, schema, table] = parts;

  const cols = columns
    ? (columns.flat() as string[]).filter(Boolean)
    : [];

  const result = (await callAPI("/preview", {
    database,
    schema,
    table,
    columns: cols,
    filters: [],
    limit: limit || 1000,
  })) as { columns: { name: string }[]; rows: Record<string, string>[] };

  const headers = result.columns.map((c) => c.name);
  const rows = result.rows.map((row) => headers.map((h) => row[h] ?? ""));
  return [headers, ...rows];
}

/**
 * Run a Snowflake SQL query and return the results.
 * @customfunction
 * @param {string} query SQL query text. Use :param_name for parameters.
 * @param {string[][]} [params] Parameter pairs [[name, value], [name, value], ...]
 * @returns {Promise<string[][]>} Query results as a 2D array
 */
export async function SQL(
  query: string,
  params?: string[][]
): Promise<string[][]> {
  const paramMap: Record<string, string> = {};
  if (params) {
    for (const pair of params) {
      if (pair.length >= 2 && pair[0]) {
        paramMap[pair[0]] = pair[1];
      }
    }
  }

  const result = (await callAPI("/execute", {
    sql: query,
    params: paramMap,
  })) as { columns: { name: string }[]; rows: Record<string, string>[] };

  const headers = result.columns.map((c) => c.name);
  const rows = result.rows.map((row) => headers.map((h) => row[h] ?? ""));
  return [headers, ...rows];
}

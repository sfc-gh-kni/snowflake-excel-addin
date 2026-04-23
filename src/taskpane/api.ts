import { AuthState, QueryResult } from "./types";

const BASE = "/api";

async function post<T>(path: string, body: object): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data as T;
}

export async function authPassword(account: string, username: string, password: string) {
  return post<{ token: string; tokenType: string; account: string }>("/auth/password", {
    account,
    username,
    password,
  });
}

export async function verifyToken(auth: AuthState) {
  return post<{ success: boolean; user: Record<string, string> }>("/auth/verify", auth);
}

export async function listWarehouses(auth: AuthState): Promise<QueryResult> {
  return post<QueryResult>("/warehouses", auth);
}

export async function listDatabases(auth: AuthState): Promise<QueryResult> {
  return post<QueryResult>("/databases", auth);
}

export async function listSchemas(auth: AuthState, database: string): Promise<QueryResult> {
  return post<QueryResult>("/schemas", { ...auth, database });
}

export async function listTables(auth: AuthState, database: string, schema: string): Promise<QueryResult> {
  return post<QueryResult>("/tables", { ...auth, database, schema });
}

export async function listColumns(auth: AuthState, database: string, schema: string, table: string): Promise<QueryResult> {
  return post<QueryResult>("/columns", { ...auth, database, schema, table });
}

export async function previewData(
  auth: AuthState,
  database: string,
  schema: string,
  table: string,
  columns: string[],
  filters: { column: string; operator: string; value: string }[],
  limit: number
): Promise<QueryResult> {
  return post<QueryResult>("/preview", { ...auth, database, schema, table, columns, filters, limit });
}

export async function executeSQL(auth: AuthState, sql: string, params?: Record<string, string>): Promise<QueryResult> {
  return post<QueryResult>("/execute", { ...auth, sql, params });
}

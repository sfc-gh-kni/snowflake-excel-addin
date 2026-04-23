export type TokenType = "oauth" | "pat" | "basic";

export interface AuthState {
  account: string;
  token: string;
  tokenType: TokenType;
  warehouse?: string;
  database?: string;
  schema?: string;
  user?: Record<string, string>;
}

export interface Column {
  name: string;
  type: string;
}

export interface Filter {
  column: string;
  operator: string;
  value: string;
}

export type ImportMethod = "table" | "sql";

export interface SavedImport {
  id: string;
  name: string;
  method: ImportMethod;
  database?: string;
  schema?: string;
  table?: string;
  columns?: string[];
  filters?: Filter[];
  limit?: number;
  sql?: string;
  params?: Record<string, string>;
  sheetName?: string;
  cellRef?: string;
  lastRefreshed?: string;
}

export interface QueryResult {
  columns: Column[];
  rows: Record<string, string>[];
  sql?: string;
}

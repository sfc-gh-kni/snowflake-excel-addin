import React, { useState, useEffect } from "react";
import AuthScreen from "./components/AuthScreen";
import ObjectBrowser from "./components/ObjectBrowser";
import ImportConfig from "./components/ImportConfig";
import SQLEditor from "./components/SQLEditor";
import ImportList from "./components/ImportList";
import { AuthState, SavedImport } from "./types";
import { previewData, executeSQL } from "./api";

declare const Office: any;
declare const Excel: any;

type Tab = "new" | "imports";
type View = "browser" | "tableConfig" | "sqlEditor";

const IMPORTS_KEY = "snowflake_imports";

function loadImports(): SavedImport[] {
  try {
    return JSON.parse(localStorage.getItem(IMPORTS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveImports(imports: SavedImport[]) {
  localStorage.setItem(IMPORTS_KEY, JSON.stringify(imports));
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [tab, setTab] = useState<Tab>("new");
  const [view, setView] = useState<View>("browser");
  const [selectedTable, setSelectedTable] = useState<{ db: string; schema: string; table: string } | null>(null);
  const [editingImport, setEditingImport] = useState<SavedImport | null>(null);
  const [imports, setImports] = useState<SavedImport[]>(loadImports());
  const [refreshing, setRefreshing] = useState<Set<string>>(new Set());
  const [status, setStatus] = useState("");
  const [authError, setAuthError] = useState("");

  function handleStartOAuth(account: string) {
    setAuthError("");
    const dialogUrl = `${window.location.origin}/oauth/start?account=${encodeURIComponent(account)}`;

    Office.context.ui.displayDialogAsync(
      dialogUrl,
      { height: 60, width: 40, promptBeforeOpen: false },
      (result: any) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          setAuthError("Could not open sign-in window. Please try again.");
          return;
        }
        const dialog = result.value;
        dialog.addEventHandler(Office.EventType.DialogMessageReceived, (msg: any) => {
          dialog.close();
          try {
            const data = JSON.parse(msg.message);
            if (data.error) {
              setAuthError(data.error);
            } else {
              const a: AuthState = { account, token: data.token, tokenType: "oauth" };
              setAuth(a);
              setStatus(`Connected — ${account}`);
            }
          } catch {
            setAuthError("Unexpected response from sign-in. Please try again.");
          }
        });
        dialog.addEventHandler(Office.EventType.DialogEventReceived, (evt: any) => {
          if (evt.error === 12006) setAuthError("Sign-in window was closed.");
        });
      }
    );
  }

  function handleSelectTable(db: string, schema: string, table: string) {
    setSelectedTable({ db, schema, table });
    setView("tableConfig");
  }

  function handleOpenSQL() {
    setSelectedTable(null);
    setEditingImport(null);
    setView("sqlEditor");
  }

  function handleEditImport(imp: SavedImport) {
    setEditingImport(imp);
    if (imp.method === "sql") {
      setView("sqlEditor");
    } else if (imp.database && imp.schema && imp.table) {
      setSelectedTable({ db: imp.database, schema: imp.schema, table: imp.table });
      setView("tableConfig");
    }
    setTab("new");
  }

  async function doImport(
    imp: Omit<SavedImport, "id" | "lastRefreshed">,
    existing?: SavedImport
  ) {
    if (!auth) return;
    const id = existing?.id || `import-${Date.now()}`;

    try {
      let result: { columns: { name: string }[]; rows: Record<string, string>[] };

      if (imp.method === "table" && imp.database && imp.schema && imp.table) {
        result = await previewData(auth, imp.database, imp.schema, imp.table, imp.columns || [], imp.filters || [], imp.limit || 1000);
      } else if (imp.method === "sql" && imp.sql) {
        result = await executeSQL(auth, imp.sql, imp.params);
      } else {
        return;
      }

      await writeToSheet(result, imp.sheetName, imp.cellRef || "A1", imp.name);

      const saved: SavedImport = { ...imp, id, lastRefreshed: new Date().toISOString() };
      const updated = existing
        ? imports.map((i) => (i.id === existing.id ? saved : i))
        : [...imports, saved];
      setImports(updated);
      saveImports(updated);
      setView("browser");
      setEditingImport(null);
      setTab("imports");
      setStatus(`Imported "${imp.name}" successfully`);
    } catch (err: any) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function refreshImport(id: string) {
    if (!auth) return;
    const imp = imports.find((i) => i.id === id);
    if (!imp) return;

    setRefreshing((prev) => new Set([...prev, id]));
    try {
      let result: { columns: { name: string }[]; rows: Record<string, string>[] };

      if (imp.method === "table" && imp.database && imp.schema && imp.table) {
        result = await previewData(auth, imp.database, imp.schema, imp.table, imp.columns || [], imp.filters || [], imp.limit || 1000);
      } else if (imp.method === "sql" && imp.sql) {
        result = await executeSQL(auth, imp.sql, imp.params);
      } else return;

      await writeToSheet(result, imp.sheetName, imp.cellRef || "A1", imp.name);

      const updated = imports.map((i) =>
        i.id === id ? { ...i, lastRefreshed: new Date().toISOString() } : i
      );
      setImports(updated);
      saveImports(updated);
      setStatus(`Refreshed "${imp.name}"`);
    } catch (err: any) {
      setStatus(`Refresh error: ${err.message}`);
    } finally {
      setRefreshing((prev) => { const s = new Set(prev); s.delete(id); return s; });
    }
  }

  async function refreshAll() {
    for (const imp of imports) {
      await refreshImport(imp.id);
    }
  }

  function deleteImport(id: string) {
    const updated = imports.filter((i) => i.id !== id);
    setImports(updated);
    saveImports(updated);
  }

  async function writeToSheet(
    result: { columns: { name: string }[]; rows: Record<string, string>[] },
    sheetName: string | undefined,
    cellRef: string,
    importName: string
  ) {
    await Excel.run(async (context: any) => {
      let sheet: any;

      if (sheetName) {
        try {
          sheet = context.workbook.worksheets.getItem(sheetName);
        } catch {
          sheet = context.workbook.worksheets.add(sheetName);
        }
      } else {
        sheet = context.workbook.worksheets.add(importName.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 31));
      }

      sheet.activate();

      const headers = result.columns.map((c) => c.name);
      const dataRows = result.rows.map((row) => headers.map((h) => row[h] ?? ""));
      const allData = [headers, ...dataRows];

      const startCell = sheet.getRange(cellRef);
      const range = startCell.getAbsoluteResizedRange(allData.length, headers.length);
      range.values = allData;

      const headerRange = startCell.getAbsoluteResizedRange(1, headers.length);
      headerRange.format.font.bold = true;
      headerRange.format.fill.color = "#29B5E8";
      headerRange.format.font.color = "#FFFFFF";

      range.format.autofitColumns();

      await context.sync();
    });
  }

  if (!auth) {
    return <AuthScreen onStartOAuth={handleStartOAuth} error={authError} />;
  }

  return (
    <div className="app">
      <div className="app-header">
        <img src="/assets/snowflake-logo.svg" alt="Snowflake" className="header-logo" />
        <div className="header-right">
          <span className="header-user" title={status}>{auth.account}</span>
          <button className="link-btn small" onClick={() => setAuth(null)}>Sign out</button>
        </div>
      </div>

      {view === "browser" && (
        <>
          <div className="tab-bar">
            <button className={`tab ${tab === "new" ? "active" : ""}`} onClick={() => setTab("new")}>New Import</button>
            <button className={`tab ${tab === "imports" ? "active" : ""}`} onClick={() => setTab("imports")}>
              Imports {imports.length > 0 && <span className="badge">{imports.length}</span>}
            </button>
          </div>

          {tab === "new" && (
            <div className="new-import-pane">
              <div className="import-method-bar">
                <span className="import-method-label">Import method:</span>
                <button className="method-btn active">Select data</button>
                <button className="method-btn" onClick={handleOpenSQL}>Write SQL</button>
              </div>
              <ObjectBrowser auth={auth} onSelect={handleSelectTable} />
            </div>
          )}

          {tab === "imports" && (
            <ImportList
              imports={imports}
              onRefresh={refreshImport}
              onRefreshAll={refreshAll}
              onEdit={handleEditImport}
              onDelete={deleteImport}
              refreshing={refreshing}
            />
          )}
        </>
      )}

      {view === "tableConfig" && selectedTable && (
        <ImportConfig
          auth={auth}
          database={selectedTable.db}
          schema={selectedTable.schema}
          table={selectedTable.table}
          existing={editingImport || undefined}
          onImport={(imp) => doImport(imp, editingImport || undefined)}
          onCancel={() => { setView("browser"); setEditingImport(null); }}
        />
      )}

      {view === "sqlEditor" && (
        <SQLEditor
          auth={auth}
          existing={editingImport || undefined}
          onImport={(imp) => doImport(imp, editingImport || undefined)}
          onCancel={() => { setView("browser"); setEditingImport(null); }}
        />
      )}

      {status && (
        <div className="status-bar" onClick={() => setStatus("")}>{status}</div>
      )}
    </div>
  );
}

import React, { useState } from "react";
import { AuthState, SavedImport } from "../types";
import { executeSQL, previewData } from "../api";

interface Props {
  auth: AuthState;
  sql?: string;
  existing?: SavedImport;
  onImport: (imp: Omit<SavedImport, "id" | "lastRefreshed">) => void;
  onCancel: () => void;
}

export default function SQLEditor({ auth, sql: initialSql, existing, onImport, onCancel }: Props) {
  const [sql, setSql] = useState(existing?.sql || initialSql || "SELECT\n  *\nFROM my_database.my_schema.my_table\nLIMIT 100;");
  const [params, setParams] = useState<{ name: string; value: string }[]>(
    existing?.params ? Object.entries(existing.params).map(([name, value]) => ({ name, value })) : []
  );
  const [name, setName] = useState(existing?.name || "Custom SQL");
  const [destination, setDestination] = useState<"new" | "current">("new");
  const [cellRef, setCellRef] = useState("A1");
  const [result, setResult] = useState<{ columns: { name: string }[]; rows: Record<string, string>[] } | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  function addParam() {
    setParams((prev) => [...prev, { name: "", value: "" }]);
  }

  function updateParam(i: number, patch: Partial<{ name: string; value: string }>) {
    setParams((prev) => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)));
  }

  function removeParam(i: number) {
    setParams((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function runQuery() {
    setError("");
    setRunning(true);
    try {
      const paramMap = Object.fromEntries(params.filter((p) => p.name).map((p) => [p.name, p.value]));
      const res = await executeSQL(auth, sql, paramMap);
      setResult(res);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  }

  function handleImport() {
    const paramMap = Object.fromEntries(params.filter((p) => p.name).map((p) => [p.name, p.value]));
    onImport({
      name,
      method: "sql",
      sql,
      params: paramMap,
      cellRef: destination === "current" ? cellRef : "A1",
    });
  }

  return (
    <div className="sql-editor">
      <div className="config-header">
        <button className="back-btn" onClick={onCancel}>← Back</button>
        <h2>Write SQL</h2>
      </div>

      <div className="config-section">
        <label>Query Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="config-section">
        <label>SQL Query</label>
        <textarea
          className="sql-textarea"
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          rows={12}
          spellCheck={false}
        />
        <span className="hint">Use :param_name for query parameters.</span>
      </div>

      <div className="config-section">
        <div className="section-header">
          <label>Parameters</label>
          <button className="link-btn" onClick={addParam}>+ Add</button>
        </div>
        {params.map((p, i) => (
          <div key={i} className="param-row">
            <input
              type="text"
              placeholder=":param_name"
              value={p.name}
              onChange={(e) => updateParam(i, { name: e.target.value })}
            />
            <input
              type="text"
              placeholder="value"
              value={p.value}
              onChange={(e) => updateParam(i, { value: e.target.value })}
            />
            <button className="remove-btn" onClick={() => removeParam(i)}>✕</button>
          </div>
        ))}
      </div>

      <div className="config-section">
        <label>Output Destination</label>
        <div className="radio-group">
          <label><input type="radio" value="new" checked={destination === "new"} onChange={() => setDestination("new")} /> New sheet</label>
          <label><input type="radio" value="current" checked={destination === "current"} onChange={() => setDestination("current")} /> Current sheet at cell</label>
          {destination === "current" && (
            <input type="text" value={cellRef} onChange={(e) => setCellRef(e.target.value)} placeholder="A1" className="small-input" />
          )}
        </div>
      </div>

      {error && <div className="error-box">{error}</div>}

      {result && (
        <div className="preview-pane">
          <div className="preview-header">
            <strong>Results — {result.rows.length} rows</strong>
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>{result.columns.map((c) => <th key={c.name}>{c.name}</th>)}</tr>
              </thead>
              <tbody>
                {result.rows.slice(0, 50).map((row, i) => (
                  <tr key={i}>
                    {result.columns.map((c) => <td key={c.name}>{row[c.name]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="config-actions">
        <button className="btn-secondary" onClick={runQuery} disabled={running}>
          {running ? "Running…" : "▶ Run"}
        </button>
        <button className="btn-primary" onClick={handleImport}>
          Save &amp; Import
        </button>
      </div>
    </div>
  );
}

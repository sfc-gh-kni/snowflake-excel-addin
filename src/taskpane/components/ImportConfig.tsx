import React, { useState, useEffect } from "react";
import { AuthState, Column, Filter, SavedImport } from "../types";
import { listColumns, previewData } from "../api";

const FILTER_OPS = [
  "EQUALS", "NOT EQUALS", "CONTAINS", "STARTS WITH", "ENDS WITH",
  "LIKE", "ILIKE", "IN", "IS NULL", "IS NOT NULL",
];

interface Props {
  auth: AuthState;
  database: string;
  schema: string;
  table: string;
  existing?: SavedImport;
  onImport: (imp: Omit<SavedImport, "id" | "lastRefreshed">) => void;
  onCancel: () => void;
}

export default function ImportConfig({ auth, database, schema, table, existing, onImport, onCancel }: Props) {
  const [columns, setColumns] = useState<Column[]>([]);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [filters, setFilters] = useState<Filter[]>([]);
  const [limit, setLimit] = useState<number>(1000);
  const [name, setName] = useState(existing?.name || `${table} import`);
  const [destination, setDestination] = useState<"new" | "current">("new");
  const [cellRef, setCellRef] = useState("A1");
  const [preview, setPreview] = useState<{ columns: Column[]; rows: Record<string, string>[]; sql?: string } | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    loadColumns();
  }, []);

  async function loadColumns() {
    try {
      const result = await listColumns(auth, database, schema, table);
      const nameCol = result.columns.find((c) => c.name === "column_name" || c.name === "COLUMN_NAME");
      const typeCol = result.columns.find((c) => c.name === "data_type" || c.name === "DATA_TYPE");
      const cols: Column[] = result.rows.map((r) => ({
        name: nameCol ? r[nameCol.name] : Object.values(r)[0],
        type: typeCol ? r[typeCol.name] : "",
      }));
      setColumns(cols);
      if (existing?.columns) {
        setSelectedCols(existing.columns);
      } else {
        setSelectedCols(cols.map((c) => c.name));
      }
      if (existing?.filters) setFilters(existing.filters);
      if (existing?.limit) setLimit(existing.limit);
    } catch (err: any) {
      setError(err.message);
    }
  }

  function toggleCol(name: string) {
    setSelectedCols((prev) =>
      prev.includes(name) ? prev.filter((c) => c !== name) : [...prev, name]
    );
  }

  function addFilter() {
    setFilters((prev) => [...prev, { column: columns[0]?.name || "", operator: "EQUALS", value: "" }]);
  }

  function updateFilter(i: number, patch: Partial<Filter>) {
    setFilters((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeFilter(i: number) {
    setFilters((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function runPreview() {
    setError("");
    setPreviewing(true);
    try {
      const result = await previewData(auth, database, schema, table, selectedCols, filters, 10);
      setPreview(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPreviewing(false);
    }
  }

  function handleImport() {
    onImport({
      name,
      method: "table",
      database,
      schema,
      table,
      columns: selectedCols,
      filters,
      limit,
      sheetName: destination === "new" ? undefined : undefined,
      cellRef: destination === "current" ? cellRef : "A1",
    });
  }

  return (
    <div className="import-config">
      <div className="config-header">
        <button className="back-btn" onClick={onCancel}>← Back</button>
        <h2>
          <span className="db-path">{database}.{schema}.</span>{table}
        </h2>
      </div>

      <div className="config-section">
        <label>Import Name</label>
        <input type="text" value={name} onChange={(e) => setName(e.target.value)} />
      </div>

      <div className="config-section">
        <div className="section-header">
          <label>Columns</label>
          <div className="col-actions">
            <button className="link-btn" onClick={() => setSelectedCols(columns.map((c) => c.name))}>All</button>
            <span> / </span>
            <button className="link-btn" onClick={() => setSelectedCols([])}>None</button>
          </div>
        </div>
        <div className="column-list">
          {columns.map((col) => (
            <label key={col.name} className="col-item">
              <input
                type="checkbox"
                checked={selectedCols.includes(col.name)}
                onChange={() => toggleCol(col.name)}
              />
              <span className="col-name">{col.name}</span>
              <span className="col-type">{col.type}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="config-section">
        <div className="section-header">
          <label>Filters</label>
          <button className="link-btn" onClick={addFilter}>+ Add filter</button>
        </div>
        {filters.map((f, i) => (
          <div key={i} className="filter-row">
            <select value={f.column} onChange={(e) => updateFilter(i, { column: e.target.value })}>
              {columns.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <select value={f.operator} onChange={(e) => updateFilter(i, { operator: e.target.value })}>
              {FILTER_OPS.map((op) => <option key={op} value={op}>{op}</option>)}
            </select>
            {!["IS NULL", "IS NOT NULL"].includes(f.operator) && (
              <input type="text" value={f.value} onChange={(e) => updateFilter(i, { value: e.target.value })} placeholder="value" />
            )}
            <button className="remove-btn" onClick={() => removeFilter(i)}>✕</button>
          </div>
        ))}
      </div>

      <div className="config-section inline">
        <label>Row Limit</label>
        <input
          type="number"
          value={limit}
          min={1}
          max={1048576}
          onChange={(e) => setLimit(parseInt(e.target.value, 10))}
          className="small-input"
        />
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

      {preview && (
        <div className="preview-pane">
          <div className="preview-header">
            <strong>Preview (10 rows)</strong>
            {preview.sql && <code className="preview-sql">{preview.sql}</code>}
          </div>
          <div className="preview-table-wrap">
            <table className="preview-table">
              <thead>
                <tr>{preview.columns.map((c) => <th key={c.name}>{c.name}</th>)}</tr>
              </thead>
              <tbody>
                {preview.rows.map((row, i) => (
                  <tr key={i}>
                    {preview.columns.map((c) => <td key={c.name}>{row[c.name]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="config-actions">
        <button className="btn-secondary" onClick={runPreview} disabled={previewing}>
          {previewing ? "Loading…" : "Preview"}
        </button>
        <button className="btn-primary" onClick={handleImport}>
          Save &amp; Import
        </button>
      </div>
    </div>
  );
}

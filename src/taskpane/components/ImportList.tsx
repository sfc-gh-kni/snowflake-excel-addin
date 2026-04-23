import React from "react";
import { SavedImport } from "../types";

interface Props {
  imports: SavedImport[];
  onRefresh: (id: string) => void;
  onRefreshAll: () => void;
  onEdit: (imp: SavedImport) => void;
  onDelete: (id: string) => void;
  refreshing: Set<string>;
}

export default function ImportList({ imports, onRefresh, onRefreshAll, onEdit, onDelete, refreshing }: Props) {
  if (imports.length === 0) {
    return (
      <div className="imports-empty">
        <p>No saved imports yet.</p>
        <p className="hint">Use the <strong>New Import</strong> tab to bring Snowflake data into Excel.</p>
      </div>
    );
  }

  return (
    <div className="import-list">
      <div className="list-toolbar">
        <span className="list-count">{imports.length} import{imports.length !== 1 ? "s" : ""}</span>
        <button className="btn-secondary small" onClick={onRefreshAll}>⟳ Refresh All</button>
      </div>
      {imports.map((imp) => (
        <div key={imp.id} className={`import-card ${refreshing.has(imp.id) ? "refreshing" : ""}`}>
          <div className="import-card-header">
            <div className="import-card-title">
              <span className="import-icon">{imp.method === "sql" ? "⌨" : "📋"}</span>
              <span className="import-name">{imp.name}</span>
            </div>
            <div className="import-card-actions">
              <button
                className="icon-btn"
                title="Refresh"
                onClick={() => onRefresh(imp.id)}
                disabled={refreshing.has(imp.id)}
              >
                {refreshing.has(imp.id) ? "…" : "⟳"}
              </button>
              <button className="icon-btn" title="Edit" onClick={() => onEdit(imp)}>✏</button>
              <button className="icon-btn danger" title="Remove" onClick={() => onDelete(imp.id)}>✕</button>
            </div>
          </div>
          <div className="import-card-meta">
            {imp.method === "table" && (
              <code>{imp.database}.{imp.schema}.{imp.table}</code>
            )}
            {imp.method === "sql" && (
              <code className="sql-preview">{(imp.sql || "").slice(0, 80)}{(imp.sql || "").length > 80 ? "…" : ""}</code>
            )}
          </div>
          {imp.lastRefreshed && (
            <div className="import-card-refreshed">Last refreshed: {new Date(imp.lastRefreshed).toLocaleString()}</div>
          )}
        </div>
      ))}
    </div>
  );
}

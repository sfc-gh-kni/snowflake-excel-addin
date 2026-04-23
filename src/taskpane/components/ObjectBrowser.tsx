import React, { useState, useEffect } from "react";
import { AuthState } from "../types";
import { listDatabases, listSchemas, listTables } from "../api";

interface TreeNode {
  name: string;
  kind: "database" | "schema" | "table" | "view";
  children?: TreeNode[];
  loaded?: boolean;
}

interface Props {
  auth: AuthState;
  onSelect: (database: string, schema: string, table: string) => void;
}

export default function ObjectBrowser({ auth, onSelect }: Props) {
  const [tree, setTree] = useState<TreeNode[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    loadDatabases();
  }, []);

  async function loadDatabases() {
    try {
      setLoading("root");
      const result = await listDatabases(auth);
      const nameCol = result.columns.find((c) => c.name === "name" || c.name === "NAME");
      const nodes: TreeNode[] = result.rows.map((r) => ({
        name: nameCol ? r[nameCol.name] : Object.values(r)[0],
        kind: "database",
      }));
      setTree(nodes);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function loadSchemas(dbName: string) {
    try {
      setLoading(dbName);
      const result = await listSchemas(auth, dbName);
      const nameCol = result.columns.find((c) => c.name === "name" || c.name === "NAME");
      const children: TreeNode[] = result.rows.map((r) => ({
        name: nameCol ? r[nameCol.name] : Object.values(r)[0],
        kind: "schema",
        children: [],
      }));
      setTree((prev) =>
        prev.map((db) => db.name === dbName ? { ...db, children, loaded: true } : db)
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function loadTables(dbName: string, schemaName: string) {
    const key = `${dbName}.${schemaName}`;
    try {
      setLoading(key);
      const result = await listTables(auth, dbName, schemaName);
      const nameCol = result.columns.find((c) => c.name === "name" || c.name === "NAME");
      const children: TreeNode[] = result.rows.map((r) => ({
        name: nameCol ? r[nameCol.name] : Object.values(r)[0],
        kind: r._kind === "view" ? "view" : "table",
      }));
      setTree((prev) =>
        prev.map((db) =>
          db.name === dbName
            ? {
                ...db,
                children: (db.children || []).map((s) =>
                  s.name === schemaName ? { ...s, children, loaded: true } : s
                ),
              }
            : db
        )
      );
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  function toggle(path: string, node: TreeNode, db?: string, schema?: string) {
    const isExpanded = expanded.has(path);
    const next = new Set(expanded);
    if (isExpanded) {
      next.delete(path);
    } else {
      next.add(path);
      if (node.kind === "database" && !node.loaded) {
        loadSchemas(node.name);
      }
      if (node.kind === "schema" && !node.loaded && db) {
        loadTables(db, node.name);
      }
    }
    setExpanded(next);
  }

  function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
    if (!query) return nodes;
    return nodes
      .map((db) => ({
        ...db,
        children: (db.children || [])
          .map((s) => ({
            ...s,
            children: (s.children || []).filter((t) =>
              t.name.toLowerCase().includes(query.toLowerCase())
            ),
          }))
          .filter(
            (s) =>
              s.name.toLowerCase().includes(query.toLowerCase()) ||
              (s.children || []).length > 0
          ),
      }))
      .filter(
        (db) =>
          db.name.toLowerCase().includes(query.toLowerCase()) ||
          (db.children || []).length > 0
      );
  }

  const visibleTree = filterTree(tree, search);

  return (
    <div className="object-browser">
      <div className="browser-toolbar">
        <input
          type="text"
          className="search-input"
          placeholder="Search tables…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <button className="icon-btn" title="Refresh" onClick={loadDatabases}>⟳</button>
      </div>

      {error && <div className="error-box small">{error}</div>}

      <div className="tree">
        {loading === "root" && <div className="tree-loading">Loading databases…</div>}
        {visibleTree.map((db) => {
          const dbPath = db.name;
          const dbExpanded = expanded.has(dbPath);
          return (
            <div key={db.name} className="tree-item">
              <div
                className="tree-node database"
                onClick={() => toggle(dbPath, db)}
              >
                <span className="tree-arrow">{dbExpanded ? "▾" : "▸"}</span>
                <span className="tree-icon">🗄</span>
                <span className="tree-label">{db.name}</span>
                {loading === db.name && <span className="tree-spinner">…</span>}
              </div>
              {dbExpanded && (
                <div className="tree-children">
                  {(db.children || []).map((s) => {
                    const sPath = `${db.name}.${s.name}`;
                    const sExpanded = expanded.has(sPath);
                    return (
                      <div key={s.name} className="tree-item">
                        <div
                          className="tree-node schema"
                          onClick={() => toggle(sPath, s, db.name)}
                        >
                          <span className="tree-arrow">{sExpanded ? "▾" : "▸"}</span>
                          <span className="tree-icon">📁</span>
                          <span className="tree-label">{s.name}</span>
                          {loading === sPath && <span className="tree-spinner">…</span>}
                        </div>
                        {sExpanded && (
                          <div className="tree-children">
                            {(s.children || []).map((t) => (
                              <div
                                key={t.name}
                                className="tree-node table selectable"
                                onClick={() => onSelect(db.name, s.name, t.name)}
                              >
                                <span className="tree-arrow" />
                                <span className="tree-icon">{t.kind === "view" ? "👁" : "📋"}</span>
                                <span className="tree-label">{t.name}</span>
                                <span className="tree-badge">{t.kind}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

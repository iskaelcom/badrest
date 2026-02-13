import { useState, useRef, useEffect } from "react";
import type { Collection } from "./App";

interface KeyValue {
  key: string;
  value: string;
}

interface CollectionsSidebarProps {
  collections: Collection[];
  onCreateCollection: (name: string) => void;
  onRenameCollection: (id: string, name: string) => void;
  onDeleteCollection: (id: string) => void;
  onToggleCollapsed: (id: string) => void;
  onSaveRequest: (collectionId: string) => void;
  onOpenRequest: (collectionId: string, requestId: string) => void;
  onRemoveRequest: (collectionId: string, requestId: string) => void;
  onRenameRequest: (collectionId: string, requestId: string, name: string) => void;
  onReorderRequest: (collectionId: string, fromIndex: number, toIndex: number) => void;
  onUpdateHeaders: (id: string, headers: KeyValue[]) => void;
  onUpdateVariables: (id: string, variables: KeyValue[]) => void;
  onExportCollection: (id: string) => void;
  onImportCollection: () => void;
  onReorderCollections: (fromIndex: number, toIndex: number) => void;
}

const METHOD_COLORS: Record<string, string> = {
  GET: "#10b981",
  POST: "#6366f1",
  PUT: "#f59e0b",
  DELETE: "#ef4444",
  PATCH: "#8b5cf6",
  HEAD: "#71717a",
  OPTIONS: "#71717a",
};

export function CollectionsSidebar({
  collections,
  onCreateCollection,
  onRenameCollection,
  onDeleteCollection,
  onToggleCollapsed,
  onSaveRequest,
  onOpenRequest,
  onRemoveRequest,
  onRenameRequest,
  onReorderRequest,
  onUpdateHeaders,
  onUpdateVariables,
  onExportCollection,
  onImportCollection,
  onReorderCollections,
}: CollectionsSidebarProps) {
  const [newCollectionName, setNewCollectionName] = useState("");
  const [showNewInput, setShowNewInput] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [settingsId, setSettingsId] = useState<string | null>(null);
  const [renamingRequestId, setRenamingRequestId] = useState<string | null>(null);
  const [renamingRequestName, setRenamingRequestName] = useState("");
  const newInputRef = useRef<HTMLInputElement>(null);

  // Mouse-based drag state for request reordering
  const dragRef = useRef<{ collectionId: string; index: number; startY: number } | null>(null);
  const [dragFrom, setDragFrom] = useState<{ collectionId: string; index: number } | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  // Mouse-based drag state for collection reordering
  const colDragRef = useRef<{ index: number; startY: number } | null>(null);
  const [colDragFrom, setColDragFrom] = useState<number | null>(null);
  const [colDragOver, setColDragOver] = useState<number | null>(null);

  const handleCreateCollection = () => {
    if (newCollectionName.trim()) {
      onCreateCollection(newCollectionName.trim());
      setNewCollectionName("");
      setShowNewInput(false);
    }
  };

  const handleStartRename = (collection: Collection) => {
    setEditingId(collection.id);
    setEditingName(collection.name);
  };

  const handleFinishRename = () => {
    if (editingId && editingName.trim()) {
      onRenameCollection(editingId, editingName.trim());
    }
    setEditingId(null);
    setEditingName("");
  };

  const handleRequestMouseDown = (collectionId: string, index: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.collection-request-remove')) return;
    e.preventDefault();
    dragRef.current = { collectionId, index, startY: e.clientY };
  };

  useEffect(() => {
    const THRESHOLD = 6;

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragRef.current) return;

      if (dragFrom === null) {
        if (Math.abs(e.clientY - dragRef.current.startY) >= THRESHOLD) {
          setDragFrom({ collectionId: dragRef.current.collectionId, index: dragRef.current.index });
        }
        return;
      }

      // Find which request item the cursor is over
      const items = document.querySelectorAll(
        `.collection-requests[data-collection-id="${dragRef.current.collectionId}"] .collection-request-item`
      );
      let hoverIdx: number | null = null;
      items.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          hoverIdx = i;
        }
      });
      setDragOverIndex(hoverIdx);
    };

    const handleMouseUp = () => {
      if (dragFrom !== null && dragOverIndex !== null && dragFrom.index !== dragOverIndex) {
        onReorderRequest(dragFrom.collectionId, dragFrom.index, dragOverIndex);
      }
      dragRef.current = null;
      setDragFrom(null);
      setDragOverIndex(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [dragFrom, dragOverIndex, onReorderRequest]);

  const handleCollectionMouseDown = (index: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.collection-action-btn-small')) return;
    if ((e.target as HTMLElement).closest('.collection-toggle')) return;
    if ((e.target as HTMLElement).closest('.collection-rename-input')) return;
    e.preventDefault();
    colDragRef.current = { index, startY: e.clientY };
  };

  useEffect(() => {
    const THRESHOLD = 6;

    const handleMouseMove = (e: MouseEvent) => {
      if (!colDragRef.current) return;

      if (colDragFrom === null) {
        if (Math.abs(e.clientY - colDragRef.current.startY) >= THRESHOLD) {
          setColDragFrom(colDragRef.current.index);
        }
        return;
      }

      const items = document.querySelectorAll('.collection-item');
      let hoverIdx: number | null = null;
      items.forEach((el, i) => {
        const rect = el.getBoundingClientRect();
        if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
          hoverIdx = i;
        }
      });
      setColDragOver(hoverIdx);
    };

    const handleMouseUp = () => {
      if (colDragFrom !== null && colDragOver !== null && colDragFrom !== colDragOver) {
        onReorderCollections(colDragFrom, colDragOver);
      }
      colDragRef.current = null;
      setColDragFrom(null);
      setColDragOver(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [colDragFrom, colDragOver, onReorderCollections]);

  const handleStartRenameRequest = (_collectionId: string, request: { id: string; name: string; url: string }) => {
    setRenamingRequestId(request.id);
    setRenamingRequestName(request.name || getShortUrl(request.url));
  };

  const handleFinishRenameRequest = (collectionId: string) => {
    if (renamingRequestId && renamingRequestName.trim()) {
      onRenameRequest(collectionId, renamingRequestId, renamingRequestName.trim());
    }
    setRenamingRequestId(null);
    setRenamingRequestName("");
  };

  const getShortUrl = (url: string) => {
    try {
      const parsed = new URL(url);
      return parsed.pathname + parsed.search;
    } catch {
      return url || "New Request";
    }
  };

  return (
    <div className="collections-sidebar">
      <div className="collections-header">
        <h3>Collections</h3>
        <div className="collections-header-actions">
          <button
            className="collections-action-btn"
            onClick={onImportCollection}
            title="Import collection"
          >
            ↓
          </button>
          <button
            className="collections-action-btn"
            onClick={() => {
              setShowNewInput(true);
              requestAnimationFrame(() => newInputRef.current?.focus());
            }}
            title="New collection"
          >
            +
          </button>
        </div>
      </div>

      {showNewInput && (
        <div className="collections-new-input">
          <input
            ref={newInputRef}
            type="text"
            placeholder="Collection name..."
            value={newCollectionName}
            onChange={(e) => setNewCollectionName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleCreateCollection();
              if (e.key === "Escape") {
                setShowNewInput(false);
                setNewCollectionName("");
              }
            }}
          />
          <button className="collections-new-save" onClick={handleCreateCollection}>
            Save
          </button>
        </div>
      )}

      <div className="collections-list">
        {collections.length === 0 && !showNewInput && (
          <div className="collections-empty">
            No collections yet.
            <br />
            Click + to create one.
          </div>
        )}

        {collections.map((collection, colIndex) => (
          <div
            key={collection.id}
            className={`collection-item ${colDragFrom !== null && colDragOver === colIndex && colDragFrom !== colIndex ? 'collection-drop-target' : ''} ${colDragFrom === colIndex ? 'collection-dragging' : ''}`}
          >
            <div
              className="collection-header"
              onMouseDown={(e) => handleCollectionMouseDown(colIndex, e)}
            >
              <button
                className="collection-toggle"
                onClick={() => onToggleCollapsed(collection.id)}
              >
                {collection.collapsed ? "▶" : "▼"}
              </button>

              {editingId === collection.id ? (
                <input
                  className="collection-rename-input"
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleFinishRename();
                    if (e.key === "Escape") {
                      setEditingId(null);
                      setEditingName("");
                    }
                  }}
                  onBlur={handleFinishRename}
                  autoFocus
                />
              ) : (
                <span
                  className="collection-name"
                  onDoubleClick={() => handleStartRename(collection)}
                >
                  {collection.name}
                </span>
              )}

              <span className="collection-count">
                {collection.requests.length}
              </span>

              <div className="collection-actions">
                <button
                  className="collection-action-btn-small"
                  onClick={() =>
                    setSettingsId(settingsId === collection.id ? null : collection.id)
                  }
                  title="Settings"
                >
                  ⚙
                </button>
                <button
                  className="collection-action-btn-small"
                  onClick={() => onExportCollection(collection.id)}
                  title="Export"
                >
                  ↑
                </button>
                <button
                  className="collection-action-btn-small delete"
                  onClick={() => onDeleteCollection(collection.id)}
                  title="Delete"
                >
                  ×
                </button>
              </div>
            </div>

            {/* Settings panel */}
            {settingsId === collection.id && (
              <div className="collection-settings">
                <CollectionKeyValueEditor
                  label="Headers"
                  items={collection.headers}
                  onChange={(items) => onUpdateHeaders(collection.id, items)}
                  keyPlaceholder="Header Name"
                  valuePlaceholder="Header Value"
                />
                <CollectionKeyValueEditor
                  label="Variables"
                  items={collection.variables}
                  onChange={(items) => onUpdateVariables(collection.id, items)}
                  keyPlaceholder="Variable Name"
                  valuePlaceholder="Value"
                />
              </div>
            )}

            {/* Requests list */}
            {!collection.collapsed && (
              <div className="collection-requests" data-collection-id={collection.id}>
                {collection.requests.map((request, index) => (
                  <div
                    key={request.id}
                    className={`collection-request-item ${
                      dragFrom?.collectionId === collection.id && dragOverIndex === index && dragFrom.index !== index
                        ? "drop-target"
                        : ""
                    } ${dragFrom?.collectionId === collection.id && dragFrom.index === index ? "dragging" : ""}`}
                    onMouseDown={(e) => handleRequestMouseDown(collection.id, index, e)}
                    onClick={() => { if (dragFrom === null) onOpenRequest(collection.id, request.id); }}
                  >
                    <span className="collection-request-drag">⠿</span>
                    <span
                      className="collection-request-method"
                      style={{
                        color: METHOD_COLORS[request.method] || "#71717a",
                      }}
                    >
                      {request.method}
                    </span>
                    {renamingRequestId === request.id ? (
                      <input
                        className="collection-request-rename-input"
                        type="text"
                        value={renamingRequestName}
                        onChange={(e) => setRenamingRequestName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleFinishRenameRequest(collection.id);
                          if (e.key === "Escape") {
                            setRenamingRequestId(null);
                            setRenamingRequestName("");
                          }
                        }}
                        onBlur={() => handleFinishRenameRequest(collection.id)}
                        onClick={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        autoFocus
                      />
                    ) : (
                      <span
                        className="collection-request-name"
                        onDoubleClick={(e) => {
                          e.stopPropagation();
                          handleStartRenameRequest(collection.id, request);
                        }}
                        title={request.url}
                      >
                        {request.name && request.name !== request.url
                          ? request.name
                          : getShortUrl(request.url)}
                      </span>
                    )}
                    <button
                      className="collection-request-remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRemoveRequest(collection.id, request.id);
                      }}
                      title="Remove"
                    >
                      ×
                    </button>
                  </div>
                ))}

                <button
                  className="collection-save-request-btn"
                  onClick={() => onSaveRequest(collection.id)}
                >
                  + Save Current Request
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// Sub-component for editing collection-level headers and variables
function CollectionKeyValueEditor({
  label,
  items,
  onChange,
  keyPlaceholder,
  valuePlaceholder,
}: {
  label: string;
  items: KeyValue[];
  onChange: (items: KeyValue[]) => void;
  keyPlaceholder: string;
  valuePlaceholder: string;
}) {
  const addItem = () => onChange([...items, { key: "", value: "" }]);
  const removeItem = (index: number) =>
    onChange(items.filter((_, i) => i !== index));
  const updateItem = (
    index: number,
    field: "key" | "value",
    value: string
  ) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    onChange(updated);
  };

  return (
    <div className="collection-kv-editor">
      <div className="collection-kv-label">{label}</div>
      {items.map((item, index) => (
        <div key={index} className="collection-kv-row">
          <input
            type="text"
            placeholder={keyPlaceholder}
            value={item.key}
            onChange={(e) => updateItem(index, "key", e.target.value)}
          />
          <input
            type="text"
            placeholder={valuePlaceholder}
            value={item.value}
            onChange={(e) => updateItem(index, "value", e.target.value)}
          />
          <button onClick={() => removeItem(index)}>×</button>
        </div>
      ))}
      <button className="collection-kv-add" onClick={addItem}>
        + Add
      </button>
    </div>
  );
}

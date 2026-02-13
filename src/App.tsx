import { useState, useEffect, useRef } from "react";
import logo from "./assets/badrest_logo.png";
import { invoke } from "@tauri-apps/api/core";
import { save, open } from "@tauri-apps/plugin-dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/plugin-fs";
import { JsonViewer } from "./JsonViewer";
import { CollectionsSidebar } from "./Collections";
import "./App.css";
import "./History.css";
import "./Tabs.css";
import "./Collections.css";

export interface KeyValue {
  key: string;
  value: string;
}

interface HttpResponse {
  status: number;
  status_text: string;
  headers: Record<string, string>;
  body: string;
  duration_ms: number;
}

type BodyType = "none" | "json" | "text" | "form";
type Tab = "params" | "headers" | "body";
type ResponseTab = "body" | "headers";

interface HistoryItem {
  id: string;
  method: string;
  url: string;
  timestamp: number;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  bodyContent: string;
}

interface RequestTab {
  id: string;
  name: string;
  method: string;
  url: string;
  activeTab: Tab;
  responseTab: ResponseTab;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  bodyContent: string;
  response: HttpResponse | null;
  loading: boolean;
  error: string | null;
  collectionRequestId?: string;
  collectionId?: string;
  collectionDirty?: boolean;
}

export interface SavedRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  params: KeyValue[];
  headers: KeyValue[];
  bodyType: BodyType;
  bodyContent: string;
}

export interface Collection {
  id: string;
  name: string;
  requests: SavedRequest[];
  headers: KeyValue[];
  variables: KeyValue[];
  createdAt: number;
  updatedAt: number;
  collapsed: boolean;
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

function App() {
  const [theme, setTheme] = useState<"light" | "dark">(() => {
    const savedTheme = localStorage.getItem("badrest-theme");
    return (savedTheme as "light" | "dark") || "dark";
  });

  // Individual request state (will be managed by tabs later)
  const [method, setMethod] = useState("GET");
  const [url, setUrl] = useState("https://jsonplaceholder.typicode.com/posts/1");
  const [activeTab, setActiveTab] = useState<Tab>("params");
  const [responseTab, setResponseTab] = useState<ResponseTab>("body");
  const [params, setParams] = useState<KeyValue[]>([{ key: "", value: "" }]);
  const [headers, setHeaders] = useState<KeyValue[]>([{ key: "", value: "" }]);
  const [bodyType, setBodyType] = useState<BodyType>("none");
  const [bodyContent, setBodyContent] = useState("");
  const [response, setResponse] = useState<HttpResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Tab management (for future multi-tab feature)
  const [tabs, setTabs] = useState<RequestTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>("");

  // Refs
  const tabListRef = useRef<HTMLDivElement>(null);
  const tabDragState = useRef<{ index: number; startX: number } | null>(null);
  const loadingTabRef = useRef(false);
  const [tabDragFrom, setTabDragFrom] = useState<number | null>(null);
  const [tabDragOver, setTabDragOver] = useState<number | null>(null);

  // Tab rename state
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renamingTabName, setRenamingTabName] = useState("");

  // UI state
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Collections state
  const [collections, setCollections] = useState<Collection[]>([]);
  const [showCollections, setShowCollections] = useState(false);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);

  // Tab context menu state
  const [tabContextMenu, setTabContextMenu] = useState<{
    x: number;
    y: number;
    tabId: string;
  } | null>(null);

  // Save-to-collection picker
  const [showCollectionPicker, setShowCollectionPicker] = useState(false);

  // Panel resize state
  const [requestPanelWidth, setRequestPanelWidth] = useState<number | null>(null);
  const resizeRef = useRef<{ startX: number; startWidth: number } | null>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);



  // Tab management functions
  const createDefaultTab = () => {
    const newTab: RequestTab = {
      id: Date.now().toString(),
      name: "New Request",
      method: "GET",
      url: "https://jsonplaceholder.typicode.com/posts/1",
      activeTab: "params",
      responseTab: "body",
      params: [{ key: "", value: "" }],
      headers: [{ key: "", value: "" }],
      bodyType: "none",
      bodyContent: "",
      response: null,
      loading: false,
      error: null
    };

    setTabs([newTab]);
    setActiveTabId(newTab.id);
    loadTabState(newTab);
  };

  const loadTabState = (tab: RequestTab) => {
    loadingTabRef.current = true;
    setMethod(tab.method);
    setUrl(tab.url);
    setActiveTab(tab.activeTab);
    setResponseTab(tab.responseTab);
    setParams(tab.params.length > 0 ? tab.params : [{ key: "", value: "" }]);
    setHeaders(tab.headers.length > 0 ? tab.headers : [{ key: "", value: "" }]);
    setBodyType(tab.bodyType);
    setBodyContent(tab.bodyContent);
    setResponse(tab.response);
    setLoading(tab.loading);
    setError(tab.error);
  };

  const saveCurrentTab = () => {
    if (!activeTabId) return;

    const updatedTabs = tabs.map(tab =>
      tab.id === activeTabId
        ? {
          ...tab,
          method,
          url,
          activeTab,
          responseTab,
          params,
          headers,
          bodyType,
          bodyContent,
          response,
          loading,
          error
        }
        : tab
    );

    setTabs(updatedTabs);
    saveTabs(updatedTabs);
  };

  const saveTabs = (tabsToSave: RequestTab[]) => {
    localStorage.setItem('badrest-tabs', JSON.stringify(tabsToSave));
    localStorage.setItem('badrest-active-tab', activeTabId);
  };

  const createNewTab = () => {
    saveCurrentTab(); // Save current tab before creating new one

    const newTab: RequestTab = {
      id: Date.now().toString(),
      name: "New Request",
      method: "GET",
      url: "",
      activeTab: "params",
      responseTab: "body",
      params: [{ key: "", value: "" }],
      headers: [{ key: "", value: "" }],
      bodyType: "none",
      bodyContent: "",
      response: null,
      loading: false,
      error: null
    };

    const updatedTabs = [...tabs, newTab];
    setTabs(updatedTabs);
    setActiveTabId(newTab.id);
    loadTabState(newTab);
    saveTabs(updatedTabs);

    // Auto-scroll to the new tab
    requestAnimationFrame(() => {
      if (tabListRef.current) {
        tabListRef.current.scrollTo({
          left: tabListRef.current.scrollWidth,
          behavior: 'smooth'
        });
      }
    });
  };

  const duplicateTab = (tabId: string) => {
    saveCurrentTab();
    const sourceTab = tabs.find(t => t.id === tabId);
    if (!sourceTab) return;

    const newTab: RequestTab = {
      ...sourceTab,
      id: Date.now().toString(),
      name: sourceTab.name ? `${sourceTab.name} (copy)` : "New Request",
      collectionRequestId: undefined,
      collectionId: undefined,
      collectionDirty: undefined,
    };

    const sourceIndex = tabs.findIndex(t => t.id === tabId);
    const updatedTabs = [...tabs];
    updatedTabs.splice(sourceIndex + 1, 0, newTab);
    setTabs(updatedTabs);
    setActiveTabId(newTab.id);
    loadTabState(newTab);
    saveTabs(updatedTabs);

    requestAnimationFrame(() => {
      const tabEl = tabListRef.current?.children[sourceIndex + 1] as HTMLElement | undefined;
      tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
    });
  };

  const switchTab = (tabId: string) => {
    if (tabId === activeTabId) return;

    saveCurrentTab(); // Save current tab before switching

    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      loadTabState(tab);
      localStorage.setItem('badrest-active-tab', tabId);
    }
  };

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return; // Don't close last tab

    const updatedTabs = tabs.filter(t => t.id !== tabId);
    setTabs(updatedTabs);

    // If closing active tab, switch to another tab
    if (tabId === activeTabId) {
      const newActiveTab = updatedTabs[0];
      setActiveTabId(newActiveTab.id);
      loadTabState(newActiveTab);
      localStorage.setItem('badrest-active-tab', newActiveTab.id);
    }

    saveTabs(updatedTabs);
  };

  const closeOtherTabs = (tabId: string) => {
    const keepTab = tabs.find(t => t.id === tabId);
    if (!keepTab) return;
    setTabs([keepTab]);
    if (activeTabId !== tabId) {
      setActiveTabId(keepTab.id);
      loadTabState(keepTab);
      localStorage.setItem('badrest-active-tab', keepTab.id);
    }
    saveTabs([keepTab]);
  };

  const closeTabsToRight = (tabId: string) => {
    const index = tabs.findIndex(t => t.id === tabId);
    if (index === -1 || index === tabs.length - 1) return;
    const updatedTabs = tabs.slice(0, index + 1);
    setTabs(updatedTabs);
    if (!updatedTabs.find(t => t.id === activeTabId)) {
      const newActive = updatedTabs[updatedTabs.length - 1];
      setActiveTabId(newActive.id);
      loadTabState(newActive);
      localStorage.setItem('badrest-active-tab', newActive.id);
    }
    saveTabs(updatedTabs);
  };

  const reorderTabs = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reordered = [...tabs];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    setTabs(reordered);
    saveTabs(reordered);
  };

  const startTabRename = (tab: RequestTab) => {
    setRenamingTabId(tab.id);
    setRenamingTabName(tab.name && tab.name !== tab.url ? tab.name : (tab.url || ''));
  };

  const finishTabRename = () => {
    if (renamingTabId && renamingTabName.trim()) {
      const updatedTabs = tabs.map(t =>
        t.id === renamingTabId ? { ...t, name: renamingTabName.trim() } : t
      );
      setTabs(updatedTabs);
      saveTabs(updatedTabs);

      // Also update collection request name if linked
      const tab = tabs.find(t => t.id === renamingTabId);
      if (tab?.collectionRequestId) {
        const colId = tab.collectionId || collections.find(c =>
          c.requests.some(r => r.id === tab.collectionRequestId)
        )?.id;
        if (colId) {
          renameRequestInCollection(colId, tab.collectionRequestId, renamingTabName.trim());
        }
      }
    }
    setRenamingTabId(null);
    setRenamingTabName("");
  };

  const handleTabMouseDown = (index: number, e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.tab-close')) return;
    if ((e.target as HTMLElement).closest('.tab-rename-input')) return;
    e.preventDefault();
    tabDragState.current = { index, startX: e.clientX };
  };

  // Mouse-based tab reorder
  useEffect(() => {
    const DRAG_THRESHOLD = 8;

    const getHoverIndex = (clientX: number): number | null => {
      const tabList = tabListRef.current;
      if (!tabList) return null;
      const tabElements = tabList.querySelectorAll('.request-tab');
      for (let i = 0; i < tabElements.length; i++) {
        const rect = tabElements[i].getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          return i;
        }
      }
      return null;
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!tabDragState.current) return;

      // Start drag only after threshold
      if (tabDragFrom === null) {
        if (Math.abs(e.clientX - tabDragState.current.startX) >= DRAG_THRESHOLD) {
          setTabDragFrom(tabDragState.current.index);
        }
        return;
      }

      setTabDragOver(getHoverIndex(e.clientX));
    };

    const handleMouseUp = () => {
      if (tabDragFrom !== null && tabDragOver !== null && tabDragFrom !== tabDragOver) {
        reorderTabs(tabDragFrom, tabDragOver);
      }
      tabDragState.current = null;
      setTabDragFrom(null);
      setTabDragOver(null);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [tabDragFrom, tabDragOver, tabs]);

  // Collection management functions
  const saveCollections = (cols: Collection[]) => {
    setCollections(cols);
    localStorage.setItem('badrest-collections', JSON.stringify(cols));
  };

  const createCollection = (name: string) => {
    const newCollection: Collection = {
      id: Date.now().toString(),
      name,
      requests: [],
      headers: [],
      variables: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      collapsed: false,
    };
    saveCollections([...collections, newCollection]);
  };

  const renameCollection = (id: string, name: string) => {
    saveCollections(collections.map(c =>
      c.id === id ? { ...c, name, updatedAt: Date.now() } : c
    ));
  };

  const deleteCollection = (id: string) => {
    const collection = collections.find(c => c.id === id);
    const name = collection?.name || "this collection";
    setConfirmDialog({
      message: `Delete "${name}"? This cannot be undone.`,
      onConfirm: () => {
        saveCollections(collections.filter(c => c.id !== id));
        setConfirmDialog(null);
      },
    });
  };

  const reorderCollections = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    const reordered = [...collections];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);
    saveCollections(reordered);
  };

  const toggleCollectionCollapsed = (id: string) => {
    saveCollections(collections.map(c =>
      c.id === id ? { ...c, collapsed: !c.collapsed } : c
    ));
  };

  const saveRequestToCollection = (collectionId: string) => {
    const savedRequest: SavedRequest = {
      id: Date.now().toString(),
      name: url || 'New Request',
      method,
      url,
      params: params.filter(p => p.key || p.value),
      headers: headers.filter(h => h.key || h.value),
      bodyType,
      bodyContent,
    };

    saveCollections(collections.map(c =>
      c.id === collectionId
        ? { ...c, requests: [...c.requests, savedRequest], updatedAt: Date.now() }
        : c
    ));
  };

  const openRequestFromCollection = (collectionId: string, requestId: string) => {
    const collection = collections.find(c => c.id === collectionId);
    if (!collection) return;
    const request = collection.requests.find(r => r.id === requestId);
    if (!request) return;

    // Check if this collection request is already open in an existing tab
    const existingTab = tabs.find(t => t.collectionRequestId === requestId);
    if (existingTab) {
      if (existingTab.id !== activeTabId) {
        switchTab(existingTab.id);
      }
      // Scroll the tab into view
      requestAnimationFrame(() => {
        const tabIndex = tabs.findIndex(t => t.id === existingTab.id);
        const tabEl = tabListRef.current?.children[tabIndex] as HTMLElement | undefined;
        tabEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      });
      return;
    }

    saveCurrentTab();

    // Apply collection variables to the request
    const vars = collection.variables.filter(v => v.key && v.value);
    const applyVars = (str: string) => {
      let result = str;
      vars.forEach(({ key, value }) => {
        result = result.split(`{{${key}}}`).join(value);
      });
      return result;
    };

    const newTab: RequestTab = {
      id: Date.now().toString(),
      name: request.name,
      method: request.method,
      url: applyVars(request.url),
      activeTab: "params",
      responseTab: "body",
      params: request.params.length > 0
        ? request.params.map(p => ({ key: p.key, value: applyVars(p.value) }))
        : [{ key: "", value: "" }],
      headers: [
        ...collection.headers.filter(h => h.key && h.value),
        ...(request.headers.length > 0 ? request.headers : []),
        { key: "", value: "" }
      ],
      bodyType: request.bodyType,
      bodyContent: applyVars(request.bodyContent),
      response: null,
      loading: false,
      error: null,
      collectionRequestId: requestId,
      collectionId: collectionId,
      collectionDirty: false,
    };

    const updatedTabs = [...tabs, newTab];
    setTabs(updatedTabs);
    setActiveTabId(newTab.id);
    loadTabState(newTab);
    saveTabs(updatedTabs);

    requestAnimationFrame(() => {
      if (tabListRef.current) {
        tabListRef.current.scrollTo({ left: tabListRef.current.scrollWidth, behavior: 'smooth' });
      }
    });
  };

  const saveTabToCollection = () => {
    const currentTab = tabs.find(t => t.id === activeTabId);

    // If tab is not linked to a collection, show picker
    if (!currentTab?.collectionRequestId) {
      if (collections.length === 0) {
        // No collections exist, open collections sidebar so user can create one
        setShowCollections(true);
        return;
      }
      setShowCollectionPicker(true);
      return;
    }

    // Find which collection contains this request
    let targetCollectionId = currentTab.collectionId;
    if (!targetCollectionId) {
      const found = collections.find(c =>
        c.requests.some(r => r.id === currentTab.collectionRequestId)
      );
      if (!found) return;
      targetCollectionId = found.id;
    }

    saveCollections(collections.map(c => {
      if (c.id !== targetCollectionId) return c;
      return {
        ...c,
        requests: c.requests.map(r => {
          if (r.id !== currentTab.collectionRequestId) return r;
          return {
            ...r,
            method,
            url,
            params: params.filter(p => p.key || p.value),
            headers: headers.filter(h => h.key || h.value),
            bodyType,
            bodyContent,
          };
        }),
        updatedAt: Date.now(),
      };
    }));

    // Clear dirty flag
    const updatedTabs = tabs.map(t =>
      t.id === activeTabId ? { ...t, collectionDirty: false } : t
    );
    setTabs(updatedTabs);
    saveTabs(updatedTabs);
  };

  const saveNewRequestToCollection = (collectionId: string) => {
    const requestId = Date.now().toString();
    const currentTab = tabs.find(t => t.id === activeTabId);
    const tabName = currentTab?.name && currentTab.name !== currentTab.url
      ? currentTab.name
      : url || 'New Request';

    const savedRequest: SavedRequest = {
      id: requestId,
      name: tabName,
      method,
      url,
      params: params.filter(p => p.key || p.value),
      headers: headers.filter(h => h.key || h.value),
      bodyType,
      bodyContent,
    };

    saveCollections(collections.map(c =>
      c.id === collectionId
        ? { ...c, requests: [...c.requests, savedRequest], updatedAt: Date.now() }
        : c
    ));

    // Link the current tab to this collection request
    const updatedTabs = tabs.map(t =>
      t.id === activeTabId
        ? { ...t, collectionRequestId: requestId, collectionId, collectionDirty: false }
        : t
    );
    setTabs(updatedTabs);
    saveTabs(updatedTabs);
    setShowCollectionPicker(false);
  };

  const renameRequestInCollection = (collectionId: string, requestId: string, name: string) => {
    saveCollections(collections.map(c => {
      if (c.id !== collectionId) return c;
      return {
        ...c,
        requests: c.requests.map(r =>
          r.id === requestId ? { ...r, name } : r
        ),
        updatedAt: Date.now(),
      };
    }));

    // Also update the open tab's name if this request is open
    const openTab = tabs.find(t => t.collectionRequestId === requestId);
    if (openTab) {
      const updatedTabs = tabs.map(t =>
        t.id === openTab.id ? { ...t, name } : t
      );
      setTabs(updatedTabs);
      saveTabs(updatedTabs);
    }
  };

  const removeRequestFromCollection = (collectionId: string, requestId: string) => {
    saveCollections(collections.map(c =>
      c.id === collectionId
        ? { ...c, requests: c.requests.filter(r => r.id !== requestId), updatedAt: Date.now() }
        : c
    ));
  };

  const reorderRequest = (collectionId: string, fromIndex: number, toIndex: number) => {
    saveCollections(collections.map(c => {
      if (c.id !== collectionId) return c;
      const reqs = [...c.requests];
      const [moved] = reqs.splice(fromIndex, 1);
      reqs.splice(toIndex, 0, moved);
      return { ...c, requests: reqs, updatedAt: Date.now() };
    }));
  };

  const updateCollectionHeaders = (id: string, newHeaders: KeyValue[]) => {
    saveCollections(collections.map(c =>
      c.id === id ? { ...c, headers: newHeaders, updatedAt: Date.now() } : c
    ));
  };

  const updateCollectionVariables = (id: string, newVariables: KeyValue[]) => {
    saveCollections(collections.map(c =>
      c.id === id ? { ...c, variables: newVariables, updatedAt: Date.now() } : c
    ));
  };

  const exportCollection = async (id: string) => {
    const collection = collections.find(c => c.id === id);
    if (!collection) return;

    try {
      const filePath = await save({
        defaultPath: `${collection.name}.json`,
        filters: [{ name: 'JSON', extensions: ['json'] }],
      });
      if (filePath) {
        await writeTextFile(filePath, JSON.stringify(collection, null, 2));
      }
    } catch (err) {
      console.error('Failed to export collection:', err);
    }
  };

  const importCollection = async () => {
    try {
      const filePath = await open({
        filters: [{ name: 'JSON', extensions: ['json'] }],
        multiple: false,
      });
      if (filePath) {
        const content = await readTextFile(filePath as string);
        const imported = JSON.parse(content) as Collection;
        // Give it a new ID to avoid conflicts
        imported.id = Date.now().toString();
        imported.createdAt = Date.now();
        imported.updatedAt = Date.now();
        saveCollections([...collections, imported]);
      }
    } catch (err) {
      console.error('Failed to import collection:', err);
    }
  };



  // Load theme, history, and collections from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("badrest-history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load history:', e);
      }
    }

    const savedCollections = localStorage.getItem("badrest-collections");
    if (savedCollections) {
      try {
        setCollections(JSON.parse(savedCollections));
      } catch (e) {
        console.error('Failed to load collections:', e);
      }
    }

    // Load tabs from localStorage or create default tab
    const savedTabs = localStorage.getItem("badrest-tabs");
    const savedActiveTabId = localStorage.getItem("badrest-active-tab");

    if (savedTabs && savedActiveTabId) {
      try {
        const parsedTabs = JSON.parse(savedTabs);
        setTabs(parsedTabs);
        setActiveTabId(savedActiveTabId);

        // Load the active tab's state
        const activeTab = parsedTabs.find((t: RequestTab) => t.id === savedActiveTabId);
        if (activeTab) {
          loadTabState(activeTab);
        }
      } catch (e) {
        console.error('Failed to load tabs:', e);
        createDefaultTab();
      }
    } else {
      createDefaultTab();
    }
  }, []);

  // Apply theme to document root
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("badrest-theme", theme);
  }, [theme]);

  // Cmd+W closes current tab instead of window
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "w") {
        e.preventDefault();
        if (tabs.length > 1) {
          closeTab(activeTabId);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId]);

  // Auto-save current tab when state changes
  useEffect(() => {
    if (activeTabId && tabs.length > 0) {
      saveCurrentTab();
    }
  }, [method, url, params, headers, bodyType, bodyContent, response, loading, error]);

  // Track dirty state for collection-linked tabs
  useEffect(() => {
    if (loadingTabRef.current) {
      loadingTabRef.current = false;
      return;
    }
    // Use functional updater to avoid overwriting concurrent saveCurrentTab updates
    setTabs(prevTabs => {
      const activeTab = prevTabs.find(t => t.id === activeTabId);
      if (activeTab?.collectionRequestId && !activeTab.collectionDirty) {
        const updated = prevTabs.map(t =>
          t.id === activeTabId ? { ...t, collectionDirty: true } : t
        );
        localStorage.setItem('badrest-tabs', JSON.stringify(updated));
        localStorage.setItem('badrest-active-tab', activeTabId);
        return updated;
      }
      return prevTabs;
    });
  }, [method, url, params, headers, bodyType, bodyContent]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        saveTabToCollection();
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyH") {
        e.preventDefault();
        e.stopPropagation();
        setShowHistory(prev => !prev);
      }
      if (e.altKey && !e.metaKey && !e.ctrlKey && e.code === "KeyC") {
        e.preventDefault();
        e.stopPropagation();
        setShowCollections(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [tabs, activeTabId, collections, method, url, params, headers, bodyType, bodyContent]);

  // Close tab context menu on click anywhere
  useEffect(() => {
    if (!tabContextMenu) return;
    const handleClick = () => setTabContextMenu(null);
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [tabContextMenu]);

  // Panel resize handlers
  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    const requestPanel = mainContentRef.current?.querySelector('.request-panel') as HTMLElement;
    if (!requestPanel) return;
    resizeRef.current = { startX: e.clientX, startWidth: requestPanel.getBoundingClientRect().width };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!resizeRef.current || !mainContentRef.current) return;
      const containerWidth = mainContentRef.current.getBoundingClientRect().width;
      const delta = e.clientX - resizeRef.current.startX;
      const newWidth = resizeRef.current.startWidth + delta;
      const minWidth = 320;
      const maxWidth = containerWidth - 320;
      setRequestPanelWidth(Math.max(minWidth, Math.min(maxWidth, newWidth)));
    };

    const handleMouseUp = () => {
      if (!resizeRef.current) return;
      resizeRef.current = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);

  const toggleTheme = () => {
    setTheme(theme === "dark" ? "light" : "dark");
  };

  const buildUrl = () => {
    try {
      const urlObj = new URL(url);
      params.forEach(({ key, value }) => {
        if (key && value) {
          urlObj.searchParams.set(key, value);
        }
      });
      return urlObj.toString();
    } catch {
      return url;
    }
  };

  const sendRequest = async () => {
    setLoading(true);
    setError(null);

    try {
      const finalUrl = buildUrl();
      const requestHeaders: Record<string, string> = {};

      headers.forEach(({ key, value }) => {
        if (key && value) {
          requestHeaders[key] = value;
        }
      });

      // Add content-type for JSON body
      if (bodyType === "json" && bodyContent) {
        requestHeaders["Content-Type"] = "application/json";
      } else if (bodyType === "form" && bodyContent) {
        requestHeaders["Content-Type"] = "application/x-www-form-urlencoded";
      }

      const result = await invoke<HttpResponse>("send_request", {
        request: {
          method,
          url: finalUrl,
          headers: requestHeaders,
          body: bodyType !== "none" ? bodyContent : null,
        },
      });

      setResponse(result);

      // Save to history
      const historyItem: HistoryItem = {
        id: Date.now().toString(),
        method,
        url: finalUrl,
        timestamp: Date.now(),
        params: params.filter(p => p.key && p.value),
        headers: headers.filter(h => h.key && h.value),
        bodyType,
        bodyContent
      };

      const newHistory = [historyItem, ...history].slice(0, 50); // Keep last 50
      setHistory(newHistory);
      localStorage.setItem('badrest-history', JSON.stringify(newHistory));
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  const addParam = () => setParams([...params, { key: "", value: "" }]);
  const removeParam = (index: number) => setParams(params.filter((_, i) => i !== index));
  const updateParam = (index: number, field: "key" | "value", value: string) => {
    const newParams = [...params];
    newParams[index][field] = value;
    setParams(newParams);
  };

  const addHeader = () => setHeaders([...headers, { key: "", value: "" }]);
  const removeHeader = (index: number) => setHeaders(headers.filter((_, i) => i !== index));
  const updateHeader = (index: number, field: "key" | "value", value: string) => {
    const newHeaders = [...headers];
    newHeaders[index][field] = value;
    setHeaders(newHeaders);
  };

  const getStatusClass = (status: number) => {
    if (status >= 200 && status < 300) return "success";
    if (status >= 400) return "error";
    return "warning";
  };

  const copyToClipboard = async () => {
    if (!response) return;

    try {
      await navigator.clipboard.writeText(response.body);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const saveJsonToFile = async () => {
    if (!response) return;

    try {
      // Show save dialog
      const filePath = await save({
        defaultPath: 'response.json',
        filters: [{
          name: 'JSON',
          extensions: ['json']
        }]
      });

      if (filePath) {
        // Format JSON if possible
        let content = response.body;
        try {
          const parsed = JSON.parse(response.body);
          content = JSON.stringify(parsed, null, 2);
        } catch {
          // If not valid JSON, save as-is
        }

        await writeTextFile(filePath, content);
        console.log('File saved successfully:', filePath);
      }
    } catch (err) {
      console.error('Failed to save file:', err);
    }
  };

  const loadFromHistory = (item: HistoryItem) => {
    setMethod(item.method);
    setUrl(item.url);
    setParams(item.params.length > 0 ? item.params : [{ key: "", value: "" }]);
    setHeaders(item.headers.length > 0 ? item.headers : [{ key: "", value: "" }]);
    setBodyType(item.bodyType);
    setBodyContent(item.bodyContent);
    setShowHistory(false);
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem('badrest-history');
  };

  return (
    <div className="app">
      <header className="header">
        <div className="logo">
          <img src={logo} alt="BadRest Logo" className="logo-icon" />
          <h1>BadRest</h1>
        </div>
        <div className="header-actions">
          <button
            className={`collections-toggle ${showCollections ? 'active' : ''}`}
            onClick={() => setShowCollections(!showCollections)}
            title="Toggle Collections"
          >
            📁 Collections
          </button>
          <button
            className="history-toggle"
            onClick={() => setShowHistory(!showHistory)}
            title="Request History"
          >
            📜 History {history.length > 0 && `(${history.length})`}
          </button>
          <button className="theme-toggle" onClick={toggleTheme} title="Toggle theme">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {/* History Panel */}
      {showHistory && (
        <div className="history-panel">
          <div className="history-header">
            <h3>Request History</h3>
            <button onClick={clearHistory} className="clear-history-btn">Clear All</button>
          </div>
          <div className="history-list">
            {history.length === 0 ? (
              <div className="history-empty">No history yet</div>
            ) : (
              history.map((item) => (
                <div
                  key={item.id}
                  className="history-item"
                  onClick={() => loadFromHistory(item)}
                >
                  <div className="history-item-method" style={{ color: METHOD_COLORS[item.method] || "#71717a" }}>{item.method}</div>
                  <div className="history-item-url">{item.url}</div>
                  <div className="history-item-time">
                    {new Date(item.timestamp).toLocaleString()}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      <div className="app-body">
        {showCollections && (
          <CollectionsSidebar
            collections={collections}
            onCreateCollection={createCollection}
            onRenameCollection={renameCollection}
            onDeleteCollection={deleteCollection}
            onToggleCollapsed={toggleCollectionCollapsed}
            onSaveRequest={saveRequestToCollection}
            onOpenRequest={openRequestFromCollection}
            onRemoveRequest={removeRequestFromCollection}
            onRenameRequest={renameRequestInCollection}
            onReorderRequest={reorderRequest}
            onUpdateHeaders={updateCollectionHeaders}
            onUpdateVariables={updateCollectionVariables}
            onExportCollection={exportCollection}
            onImportCollection={importCollection}
            onReorderCollections={reorderCollections}
          />
        )}
      <div className="main-content" ref={mainContentRef}>
        {/* Request Panel */}
        <div className="request-panel" style={requestPanelWidth ? { width: requestPanelWidth, flex: 'none' } : undefined}>
          {/* Tab Bar */}
          <div className="tab-bar">
            <div className="tab-list" ref={tabListRef}>
              {tabs.map((tab, index) => (
                <div
                  key={tab.id}
                  className={`request-tab ${tab.id === activeTabId ? 'active' : ''} ${tabDragFrom !== null && tabDragOver === index && tabDragFrom !== index ? 'tab-drop-target' : ''} ${tabDragFrom === index ? 'tab-dragging' : ''}`}
                  onClick={() => { if (tabDragFrom === null) switchTab(tab.id); }}
                  onMouseDown={(e) => handleTabMouseDown(index, e)}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId: tab.id });
                  }}
                >
                  <span className="tab-method-badge" style={{ background: METHOD_COLORS[tab.method] || "#71717a" }}>{tab.method}</span>
                  {tab.collectionDirty && <span className="tab-dirty-dot" title="Unsaved changes (Cmd+S to save)" />}
                  {renamingTabId === tab.id ? (
                    <input
                      className="tab-rename-input"
                      type="text"
                      value={renamingTabName}
                      onChange={(e) => setRenamingTabName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") finishTabRename();
                        if (e.key === "Escape") {
                          setRenamingTabId(null);
                          setRenamingTabName("");
                        }
                      }}
                      onBlur={finishTabRename}
                      onClick={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span
                      className="tab-url"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        startTabRename(tab);
                      }}
                    >
                      {tab.name && tab.name !== tab.url ? tab.name : (tab.url || 'New Request')}
                    </span>
                  )}
                  {tabs.length > 1 && (
                    <button
                      className="tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeTab(tab.id);
                      }}
                      title="Close tab"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button className="new-tab-btn" onClick={createNewTab} title="New tab">
              +
            </button>
          </div>

          <div className="request-builder">
            <div className="url-bar">
              <select
                className="method-select"
                value={method}
                onChange={(e) => setMethod(e.target.value)}
              >
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
                <option value="DELETE">DELETE</option>
                <option value="PATCH">PATCH</option>
                <option value="HEAD">HEAD</option>
                <option value="OPTIONS">OPTIONS</option>
              </select>

              <textarea
                className="url-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter request URL..."
                rows={1}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    sendRequest();
                  }
                }}
              />

              <button
                className="send-button"
                onClick={sendRequest}
                disabled={loading || !url}
              >
                {loading ? "Sending..." : "Send"}
              </button>
            </div>
          </div>

          <div className="tabs">
            <button
              className={`tab ${activeTab === "params" ? "active" : ""}`}
              onClick={() => setActiveTab("params")}
            >
              Params
            </button>
            <button
              className={`tab ${activeTab === "headers" ? "active" : ""}`}
              onClick={() => setActiveTab("headers")}
            >
              Headers
            </button>
            <button
              className={`tab ${activeTab === "body" ? "active" : ""}`}
              onClick={() => setActiveTab("body")}
            >
              Body
            </button>
          </div>

          <div className="tab-content">
            {activeTab === "params" && (
              <div className="key-value-editor">
                {params.map((param, index) => (
                  <div key={index} className="key-value-row">
                    <input
                      type="text"
                      className="key-value-input"
                      placeholder="Key"
                      value={param.key}
                      onChange={(e) => updateParam(index, "key", e.target.value)}
                    />
                    <input
                      type="text"
                      className="key-value-input"
                      placeholder="Value"
                      value={param.value}
                      onChange={(e) => updateParam(index, "value", e.target.value)}
                    />
                    <button
                      className="remove-button"
                      onClick={() => removeParam(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button className="add-button" onClick={addParam}>
                  + Add Parameter
                </button>
              </div>
            )}

            {activeTab === "headers" && (
              <div className="key-value-editor">
                {headers.map((header, index) => (
                  <div key={index} className="key-value-row">
                    <input
                      type="text"
                      className="key-value-input"
                      placeholder="Header Name"
                      value={header.key}
                      onChange={(e) => updateHeader(index, "key", e.target.value)}
                    />
                    <input
                      type="text"
                      className="key-value-input"
                      placeholder="Header Value"
                      value={header.value}
                      onChange={(e) => updateHeader(index, "value", e.target.value)}
                    />
                    <button
                      className="remove-button"
                      onClick={() => removeHeader(index)}
                    >
                      ✕
                    </button>
                  </div>
                ))}
                <button className="add-button" onClick={addHeader}>
                  + Add Header
                </button>
              </div>
            )}

            {activeTab === "body" && (
              <div className="body-editor">
                <div className="body-type-selector">
                  <button
                    className={`body-type-button ${bodyType === "none" ? "active" : ""}`}
                    onClick={() => setBodyType("none")}
                  >
                    None
                  </button>
                  <button
                    className={`body-type-button ${bodyType === "json" ? "active" : ""}`}
                    onClick={() => setBodyType("json")}
                  >
                    JSON
                  </button>
                  <button
                    className={`body-type-button ${bodyType === "text" ? "active" : ""}`}
                    onClick={() => setBodyType("text")}
                  >
                    Text
                  </button>
                  <button
                    className={`body-type-button ${bodyType === "form" ? "active" : ""}`}
                    onClick={() => setBodyType("form")}
                  >
                    Form
                  </button>
                </div>

                {bodyType !== "none" && (
                  <textarea
                    className="body-textarea"
                    value={bodyContent}
                    onChange={(e) => setBodyContent(e.target.value)}
                    placeholder={
                      bodyType === "json"
                        ? '{\n  "key": "value"\n}'
                        : bodyType === "form"
                          ? "key1=value1&key2=value2"
                          : "Enter request body..."
                    }
                  />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Resize Handle */}
        <div className="resize-handle" onMouseDown={handleResizeMouseDown} />

        {/* Response Panel */}
        <div className="response-panel">
          {response ? (
            <div className="response-viewer">
              <div className="response-header">
                <div className="response-status">
                  <span className={`status-badge ${getStatusClass(response.status)}`}>
                    {response.status} {response.status_text}
                  </span>
                  <span className="response-meta">
                    Time: {response.duration_ms}ms
                  </span>
                  <span className="response-meta">
                    Size: {new Blob([response.body]).size} bytes
                  </span>
                </div>
              </div>

              <div className="tabs">
                <button
                  className={`tab ${responseTab === "body" ? "active" : ""}`}
                  onClick={() => setResponseTab("body")}
                >
                  Body
                </button>
                <button
                  className={`tab ${responseTab === "headers" ? "active" : ""}`}
                  onClick={() => setResponseTab("headers")}
                >
                  Headers ({Object.keys(response.headers).length})
                </button>
                <button
                  className="copy-button"
                  onClick={copyToClipboard}
                  title="Copy response body"
                >
                  {copied ? '✓ Copied!' : '📋 Copy'}
                </button>
                <button
                  className="save-button"
                  onClick={saveJsonToFile}
                  title="Save JSON to file"
                >
                  💾 Save
                </button>
              </div>

              <div className="response-body">
                {responseTab === "body" && (
                  <div className="json-tree-container">
                    {(() => {
                      try {
                        console.log('Response body:', response.body);
                        const parsed = JSON.parse(response.body);
                        console.log('Parsed JSON:', parsed);
                        return <JsonViewer data={parsed} />;
                      } catch (e) {
                        console.log('JSON parse error, showing raw:', e);
                        return <pre className="response-content">{response.body}</pre>;
                      }
                    })()}
                  </div>
                )}

                {responseTab === "headers" && (
                  <div className="headers-list">
                    {Object.entries(response.headers).map(([key, value]) => (
                      <div key={key} className="header-item">
                        <span className="header-key">{key}:</span>
                        <span className="header-value">{value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : error ? (
            <div className="empty-state">
              <div className="empty-state-icon">⚠️</div>
              <div className="empty-state-text">Error: {error}</div>
            </div>
          ) : loading ? (
            <div className="empty-state">
              <div className="spinner"></div>
              <div className="empty-state-text">Sending request...</div>
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">🚀</div>
              <div className="empty-state-text">
                Enter a URL and click Send to get started
              </div>
            </div>
          )}
        </div>
      </div>
      </div>

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <div
          className="tab-context-menu"
          style={{ top: tabContextMenu.y, left: tabContextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="tab-context-menu-item"
            onClick={() => {
              duplicateTab(tabContextMenu.tabId);
              setTabContextMenu(null);
            }}
          >
            Duplicate Tab
          </button>
          <button
            className="tab-context-menu-item"
            onClick={() => {
              const tab = tabs.find(t => t.id === tabContextMenu.tabId);
              if (tab) startTabRename(tab);
              setTabContextMenu(null);
            }}
          >
            Rename Tab
          </button>
          {tabs.length > 1 && (
            <>
              <button
                className="tab-context-menu-item delete"
                onClick={() => {
                  closeTab(tabContextMenu.tabId);
                  setTabContextMenu(null);
                }}
              >
                Close Tab
              </button>
              <button
                className="tab-context-menu-item delete"
                onClick={() => {
                  closeOtherTabs(tabContextMenu.tabId);
                  setTabContextMenu(null);
                }}
              >
                Close Other Tabs
              </button>
              {tabs.findIndex(t => t.id === tabContextMenu.tabId) < tabs.length - 1 && (
                <button
                  className="tab-context-menu-item delete"
                  onClick={() => {
                    closeTabsToRight(tabContextMenu.tabId);
                    setTabContextMenu(null);
                  }}
                >
                  Close Tabs to the Right
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Save to Collection Picker */}
      {showCollectionPicker && (
        <div className="confirm-overlay" onClick={() => setShowCollectionPicker(false)}>
          <div className="confirm-dialog collection-picker" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">Save to Collection</p>
            <div className="collection-picker-list">
              {collections.map(c => (
                <button
                  key={c.id}
                  className="collection-picker-item"
                  onClick={() => saveNewRequestToCollection(c.id)}
                >
                  <span className="collection-picker-name">{c.name}</span>
                  <span className="collection-picker-count">{c.requests.length}</span>
                </button>
              ))}
            </div>
            <div className="confirm-actions">
              <button
                className="confirm-cancel-btn"
                onClick={() => setShowCollectionPicker(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      {confirmDialog && (
        <div className="confirm-overlay" onClick={() => setConfirmDialog(null)}>
          <div className="confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <p className="confirm-message">{confirmDialog.message}</p>
            <div className="confirm-actions">
              <button
                className="confirm-cancel-btn"
                onClick={() => setConfirmDialog(null)}
              >
                Cancel
              </button>
              <button
                className="confirm-delete-btn"
                onClick={confirmDialog.onConfirm}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;

import { useState, useEffect } from "react";
import logo from "./assets/badrest_logo.png";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";
import { JsonViewer } from "./JsonViewer";
import "./App.css";
import "./History.css";
import "./Tabs.css";

interface KeyValue {
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
}

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

  // UI state
  const [copied, setCopied] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);



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





  // Load theme and history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem("badrest-history");
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error('Failed to load history:', e);
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

  // Auto-save current tab when state changes
  useEffect(() => {
    if (activeTabId && tabs.length > 0) {
      saveCurrentTab();
    }
  }, [method, url, params, headers, bodyType, bodyContent, response, loading, error]);

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
                  <div className="history-item-method">{item.method}</div>
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

      <div className="main-content">
        {/* Request Panel */}
        <div className="request-panel">
          {/* Tab Bar */}
          <div className="tab-bar">
            <div className="tab-list">
              {tabs.map((tab) => (
                <div
                  key={tab.id}
                  className={`request-tab ${tab.id === activeTabId ? 'active' : ''}`}
                  onClick={() => switchTab(tab.id)}
                >
                  <span className="tab-method-badge">{tab.method}</span>
                  <span className="tab-url">{tab.url || 'New Request'}</span>
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

              <input
                type="text"
                className="url-input"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Enter request URL..."
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
  );
}

export default App;

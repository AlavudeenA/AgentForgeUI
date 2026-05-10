import { useEffect, useState } from "react";
import { api } from "./api/client.js";
import { useWorkflowStore } from "./store/useWorkflowStore.js";
import Toolbar from "./components/Toolbar.jsx";
import CreateTab from "./components/tabs/CreateTab.jsx";
import RunTab from "./components/tabs/RunTab.jsx";
import LLMTab from "./components/tabs/LLMTab.jsx";
import LogsModal from "./components/LogsModal.jsx";

const TABS = [
  { id: "create", label: "⚒ Create Workflow" },
  { id: "run",    label: "▶ Run Workflow" },
  { id: "llm",    label: "✨ LLM Generate" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState("create");
  const [showLogs, setShowLogs] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const setAgents = useWorkflowStore((s) => s.setAgents);

  useEffect(() => {
    api.getAgents()
      .then(setAgents)
      .catch((e) => console.error("Failed to load agents:", e))
      .finally(() => setLoadingAgents(false));
  }, [setAgents]);

  return (
    <div className="app">
      <Toolbar onShowLogs={() => setShowLogs(true)} />

      <nav className="tab-nav">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab-btn ${activeTab === t.id ? "tab-btn--active" : ""}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
        {loadingAgents && (
          <span className="tab-nav__loading">Loading agents…</span>
        )}
      </nav>

      <main className="app__main">
        {activeTab === "create" && <CreateTab />}
        {activeTab === "run"    && <RunTab />}
        {activeTab === "llm"    && <LLMTab onSwitchToCreate={() => setActiveTab("create")} />}
      </main>

      {showLogs && <LogsModal onClose={() => setShowLogs(false)} />}
    </div>
  );
}

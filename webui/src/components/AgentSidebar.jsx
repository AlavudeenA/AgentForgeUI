import { useState } from "react";
import { api } from "../api/client.js";
import { useWorkflowStore } from "../store/useWorkflowStore.js";
import { SIDEBAR_GROUPS } from "../config/nodeRegistry.js";

function AgentCard({ agent }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify(agent));
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <div className="agent-card" draggable onDragStart={onDragStart} title={agent.description}>
      <div className="agent-card__info">
        <div className="agent-card__name">{agent.name.replace(/_/g, " ")}</div>
        <div className="agent-card__desc">{agent.description}</div>
      </div>
    </div>
  );
}

function ShapeButton({ entry }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData("application/shape", entry.shapeKey);
    e.dataTransfer.effectAllowed = "move";
  };
  return (
    <button className="shape-btn" draggable onDragStart={onDragStart} title={entry.title}>
      <span className="shape-btn__icon">{entry.icon}</span>
      <span>{entry.label}</span>
    </button>
  );
}

export default function AgentSidebar() {
  const agents    = useWorkflowStore((s) => s.agents);
  const setAgents = useWorkflowStore((s) => s.setAgents);
  const [search, setSearch]           = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const [elementsOpen, setElementsOpen] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshAgentsMetadata();
      setAgents(await api.getAgents());
    } catch (e) {
      console.error("Failed to refresh agents:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="agent-sidebar">
      <div className="agent-sidebar__header">
        <span className="agent-sidebar__title">Agents</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="agent-sidebar__count">{agents.length}</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Reload agents from server"
            style={{
              background: "none", border: "none",
              cursor: refreshing ? "not-allowed" : "pointer",
              color: "var(--text-muted)", fontSize: "0.85rem",
              padding: "2px 4px", borderRadius: "4px", lineHeight: 1,
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            {refreshing ? "…" : "↻"}
          </button>
        </div>
      </div>

      <div className="agent-sidebar__search">
        <input
          className="agent-sidebar__search-input"
          type="text"
          placeholder="Search agents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="agent-sidebar__hint">Drag an agent onto the canvas</div>

      <div className="agent-sidebar__list">
        {filtered.map((a) => <AgentCard key={a.name} agent={a} />)}
        {filtered.length === 0 && (
          <div style={{ color: "var(--text-muted)", padding: "1rem", textAlign: "center", fontSize: "0.8rem" }}>
            No agents found
          </div>
        )}
      </div>

      {/* Workflow elements — collapsed by default, derived entirely from nodeRegistry */}
      <button
        className="agent-sidebar__elements-toggle"
        onClick={() => setElementsOpen((o) => !o)}
      >
        <span>Workflow Elements</span>
        <span className={`agent-sidebar__elements-chevron${elementsOpen ? " open" : ""}`}>›</span>
      </button>

      {elementsOpen && (
        <div className="agent-sidebar__shapes">
          {Object.entries(SIDEBAR_GROUPS).map(([group, entries]) => (
            <div key={group}>
              <div className="bpmn-group-label">{group}</div>
              <div className="bpmn-shape-grid">
                {entries.map((entry) => (
                  <ShapeButton key={entry.type} entry={entry} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

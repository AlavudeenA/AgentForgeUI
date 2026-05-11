import { useState } from "react";
import { api } from "../api/client.js";
import { useWorkflowStore } from "../store/useWorkflowStore.js";

function AgentCard({ agent }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData("application/json", JSON.stringify(agent));
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <div
      className="agent-card"
      draggable
      onDragStart={onDragStart}
      title={agent.description}
    >
      <div className="agent-card__info">
        <div className="agent-card__name">{agent.name.replace(/_/g, " ")}</div>
        <div className="agent-card__desc">{agent.description}</div>
      </div>
    </div>
  );
}

function ShapeButton({ shapeKey, icon, label, title }) {
  const onDragStart = (e) => {
    e.dataTransfer.setData("application/shape", shapeKey);
    e.dataTransfer.effectAllowed = "move";
  };

  return (
    <button
      className="shape-btn"
      draggable
      onDragStart={onDragStart}
      title={title || `Drag to add ${label}`}
    >
      <span className="shape-btn__icon">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

export default function AgentSidebar() {
  const agents = useWorkflowStore((s) => s.agents);
  const setAgents = useWorkflowStore((s) => s.setAgents);
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshAgentsMetadata();
      const updated = await api.getAgents();
      setAgents(updated);
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
              background: "none",
              border: "none",
              cursor: refreshing ? "not-allowed" : "pointer",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              padding: "2px 4px",
              borderRadius: "4px",
              lineHeight: 1,
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
        {filtered.map((a) => (
          <AgentCard key={a.name} agent={a} />
        ))}
        {filtered.length === 0 && (
          <div style={{ color: "var(--text-muted)", padding: "1rem", textAlign: "center", fontSize: "0.8rem" }}>
            No agents found
          </div>
        )}
      </div>

      <div className="agent-sidebar__divider" />

      <div className="agent-sidebar__shapes">
        <div className="bpmn-group-label">Events</div>
        <div className="bpmn-shape-grid">
          <ShapeButton shapeKey="timerEvent" icon="⏱" label="Timer" title="Timer Event — wait / delay" />
        </div>

        <div className="bpmn-group-label">Gateways</div>
        <div className="bpmn-shape-grid">
          <ShapeButton shapeKey="decision"        icon="◆" label="XOR"      title="Exclusive Gateway — one path (XOR)" />
          <ShapeButton shapeKey="parallelGateway" icon="⊕" label="Parallel" title="Parallel Gateway — all paths (AND)" />
        </div>

        <div className="bpmn-group-label">Tasks</div>
        <div className="bpmn-shape-grid">
          <ShapeButton shapeKey="serviceTask" icon="⚙"  label="Service" title="Service Task — automated HTTP/API call" />
          <ShapeButton shapeKey="scriptTask"  icon="📜" label="Script"  title="Script Task — runs a script" />
        </div>

        <div className="bpmn-group-label">Other</div>
        <div className="bpmn-shape-grid">
          <ShapeButton shapeKey="annotation" icon="📝" label="Note" title="Annotation — add a text note to the canvas" />
        </div>
      </div>
    </aside>
  );
}

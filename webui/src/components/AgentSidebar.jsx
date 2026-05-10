import { useState } from "react";
import { useWorkflowStore } from "../store/useWorkflowStore.js";

function agentColor(name) {
  if (name.includes("jira")) return "#0052cc";
  if (name.includes("github")) return "#24292f";
  if (name.includes("copilot") || name.includes("llm")) return "#6366f1";
  if (name.includes("test")) return "#10b981";
  if (name.includes("deploy")) return "#f59e0b";
  return "#4f7fff";
}

function agentIcon(name) {
  if (name.includes("jira")) return "🎫";
  if (name.includes("github")) return "🐙";
  if (name.includes("copilot") || name.includes("llm")) return "🤖";
  if (name.includes("test")) return "🧪";
  if (name.includes("deploy")) return "🚀";
  return "⚙";
}

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
      style={{ "--agent-color": agentColor(agent.name) }}
    >
      <div className="agent-card__icon">{agentIcon(agent.name)}</div>
      <div className="agent-card__info">
        <div className="agent-card__name">{agent.name.replace(/_/g, " ")}</div>
        <div className="agent-card__desc">{agent.description}</div>
      </div>
      <div className="agent-card__drag-hint">⠿</div>
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
  const [search, setSearch] = useState("");

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="agent-sidebar">
      <div className="agent-sidebar__header">
        <span className="agent-sidebar__title">Agents</span>
        <span className="agent-sidebar__count">{agents.length}</span>
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
          <ShapeButton shapeKey="startEvent" icon="▶" label="Start" title="Start Event — begins the workflow" />
          <ShapeButton shapeKey="endEvent"   icon="■" label="End"   title="End Event — terminates the workflow" />
          <ShapeButton shapeKey="timerEvent" icon="⏱" label="Timer" title="Timer Event — wait / delay" />
          <ShapeButton shapeKey="messageEvent" icon="✉" label="Message" title="Message Event — receive a message" />
        </div>

        <div className="bpmn-group-label">Gateways</div>
        <div className="bpmn-shape-grid">
          <ShapeButton shapeKey="decision"        icon="◆" label="XOR"      title="Exclusive Gateway — one path (XOR)" />
          <ShapeButton shapeKey="parallelGateway" icon="⊕" label="Parallel" title="Parallel Gateway — all paths (AND)" />
        </div>

        <div className="bpmn-group-label">Tasks</div>
        <div className="bpmn-shape-grid">
          <ShapeButton shapeKey="userTask"    icon="👤" label="User"    title="User Task — manual step requiring a person" />
          <ShapeButton shapeKey="serviceTask" icon="⚙"  label="Service" title="Service Task — automated HTTP/API call" />
          <ShapeButton shapeKey="scriptTask"  icon="📜" label="Script"  title="Script Task — runs a script" />
          <ShapeButton shapeKey="sendTask"    icon="📤" label="Send"    title="Send Task — send an email or notification" />
          <ShapeButton shapeKey="mcpTask"     icon="🔌" label="MCP"     title="MCP Server — call a Model Context Protocol tool" />
        </div>

        <div className="bpmn-group-label">Other</div>
        <div className="bpmn-shape-grid">
          <ShapeButton shapeKey="annotation" icon="📝" label="Note" title="Annotation — add a text note to the canvas" />
        </div>
      </div>
    </aside>
  );
}

import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "../../store/useWorkflowStore.js";

const STATUS_COLORS = {
  "not-started":     "#4a6080",
  "in-progress":     "#f59e0b",
  completed:         "#10b981",
  approved:          "#10b981",
  "pending-approval":"#a78bfa",
  rejected:          "#f97316",
  error:             "#ef4444",
};

const STATUS_ICONS = {
  "not-started":     "○",
  "in-progress":     "⟳",
  completed:         "✓",
  approved:          "✓",
  "pending-approval":"⏸",
  rejected:          "✗",
  error:             "⚠",
};

function agentIcon(name) {
  if (name.includes("jira")) return "🎫";
  if (name.includes("github")) return "🐙";
  if (name.includes("copilot") || name.includes("llm")) return "🤖";
  if (name.includes("test")) return "🧪";
  if (name.includes("deploy")) return "🚀";
  return "⚙";
}

export default function AgentNode({ id, data, selected }) {
  const runStatus = useWorkflowStore((s) => s.runStatus);
  const status = runStatus[id] || runStatus[data.agentName] || null;
  const statusColor = status ? STATUS_COLORS[status] || "#4a6080" : null;
  const statusIcon = status ? STATUS_ICONS[status] || "○" : null;

  const inputCount = Object.keys(data.inputs || {}).length;
  const outputCount = Object.keys(data.outputFormat || {}).length;

  return (
    <div
      className={`agent-node ${selected ? "agent-node--selected" : ""}`}
      style={{ "--status-color": statusColor || "var(--primary)" }}
    >
      <Handle type="target" position={Position.Top} className="flow-handle" />

      <div className="agent-node__header">
        <span className="agent-node__icon">{agentIcon(data.agentName || "")}</span>
        <div className="agent-node__title-block">
          <span className="agent-node__name">{data.label}</span>
          {data.requires_approval && <span className="agent-node__badge">HITL</span>}
        </div>
        {status && (
          <span
            className="agent-node__status"
            style={{ color: statusColor, borderColor: statusColor }}
            title={status}
          >
            {statusIcon}
          </span>
        )}
      </div>

      <div className="agent-node__body">
        <p className="agent-node__desc">{data.description || data.agentName}</p>
        <div className="agent-node__io">
          <span className="agent-node__io-tag">↓ {inputCount} inputs</span>
          <span className="agent-node__io-tag">↑ {outputCount} outputs</span>
        </div>
      </div>

      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

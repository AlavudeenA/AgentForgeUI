import { Handle, Position } from "@xyflow/react";

export default function McpTaskNode({ data, selected }) {
  return (
    <div className={`task-node task-node--mcp ${selected ? "task-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="task-node__header">
        <span className="task-node__icon">🔌</span>
        <span className="task-node__title">{data.label || "MCP Client"}</span>
      </div>
      <div className="task-node__body">
        {data.serverName && <div className="task-node__detail task-node__method">{data.serverName}</div>}
        {data.toolName && <div className="task-node__detail">{data.toolName}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

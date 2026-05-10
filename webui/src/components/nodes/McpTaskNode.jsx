import { Handle, Position } from "@xyflow/react";

export default function McpTaskNode({ data, selected }) {
  return (
    <div className={`task-node task-node--mcp ${selected ? "task-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="task-node__header">
        <span className="task-node__icon">🔌</span>
        <span className="task-node__title">{data.label || "MCP Server"}</span>
      </div>
      <div className="task-node__body">
        {data.toolName && <div className="task-node__detail task-node__method">{data.toolName}</div>}
        {data.serverUrl && (
          <div className="task-node__detail">
            {data.serverUrl.length > 28 ? data.serverUrl.slice(0, 28) + "…" : data.serverUrl}
          </div>
        )}
      </div>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

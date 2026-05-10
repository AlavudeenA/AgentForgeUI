import { Handle, Position } from "@xyflow/react";

export default function ServiceTaskNode({ data, selected }) {
  const urlDisplay = data.url
    ? (data.url.length > 28 ? data.url.slice(0, 28) + "…" : data.url)
    : null;

  return (
    <div className={`task-node task-node--service ${selected ? "task-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="task-node__header">
        <span className="task-node__icon">⚙</span>
        <span className="task-node__title">{data.label || "Service Task"}</span>
      </div>
      {urlDisplay && (
        <div className="task-node__body">
          <div className="task-node__detail task-node__method">{data.method || "GET"}</div>
          <div className="task-node__detail">{urlDisplay}</div>
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

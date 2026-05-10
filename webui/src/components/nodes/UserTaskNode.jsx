import { Handle, Position } from "@xyflow/react";

export default function UserTaskNode({ data, selected }) {
  return (
    <div className={`task-node task-node--user ${selected ? "task-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="task-node__header">
        <span className="task-node__icon">👤</span>
        <span className="task-node__title">{data.label || "User Task"}</span>
        {data.requires_approval && <span className="agent-node__badge">HITL</span>}
      </div>
      {(data.assignee || data.instructions) && (
        <div className="task-node__body">
          {data.assignee && <div className="task-node__detail">→ {data.assignee}</div>}
          {data.instructions && (
            <div className="task-node__detail">
              {data.instructions.length > 50 ? data.instructions.slice(0, 50) + "…" : data.instructions}
            </div>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

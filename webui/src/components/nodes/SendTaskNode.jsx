import { Handle, Position } from "@xyflow/react";

export default function SendTaskNode({ data, selected }) {
  return (
    <div className={`task-node task-node--send ${selected ? "task-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="task-node__header">
        <span className="task-node__icon">📤</span>
        <span className="task-node__title">{data.label || "Send Task"}</span>
      </div>
      {(data.to || data.subject) && (
        <div className="task-node__body">
          {data.to && <div className="task-node__detail">To: {data.to}</div>}
          {data.subject && (
            <div className="task-node__detail">
              {data.subject.length > 30 ? data.subject.slice(0, 30) + "…" : data.subject}
            </div>
          )}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

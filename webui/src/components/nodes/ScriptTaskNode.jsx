import { Handle, Position } from "@xyflow/react";

export default function ScriptTaskNode({ data, selected }) {
  const preview = data.script
    ? (data.script.trim().split("\n")[0].slice(0, 35) + (data.script.trim().split("\n")[0].length > 35 ? "…" : ""))
    : null;

  return (
    <div className={`task-node task-node--script ${selected ? "task-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="task-node__header">
        <span className="task-node__icon">📜</span>
        <span className="task-node__title">{data.label || "Script Task"}</span>
      </div>
      <div className="task-node__body">
        {data.language && <div className="task-node__detail task-node__method">{data.language}</div>}
        {preview && <div className="task-node__detail task-node__code">{preview}</div>}
      </div>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

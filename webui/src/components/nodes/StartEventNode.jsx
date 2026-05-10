import { Handle, Position } from "@xyflow/react";

export default function StartEventNode({ data, selected }) {
  return (
    <div className={`event-node event-node--start ${selected ? "event-node--selected" : ""}`}>
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
      <div className="event-node__circle">▶</div>
      <div className="event-node__label">{data.label || "Start"}</div>
    </div>
  );
}

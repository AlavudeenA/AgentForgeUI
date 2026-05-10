import { Handle, Position } from "@xyflow/react";

export default function EndEventNode({ data, selected }) {
  return (
    <div className={`event-node event-node--end ${selected ? "event-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="event-node__circle">■</div>
      <div className="event-node__label">{data.label || "End"}</div>
    </div>
  );
}

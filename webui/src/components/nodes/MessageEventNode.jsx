import { Handle, Position } from "@xyflow/react";

export default function MessageEventNode({ data, selected }) {
  return (
    <div className={`event-node event-node--message ${selected ? "event-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="event-node__circle">✉</div>
      <div className="event-node__label">{data.label || "Message"}</div>
      {data.messageName && <div className="event-node__sublabel">{data.messageName}</div>}
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

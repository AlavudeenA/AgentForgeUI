import { Handle, Position } from "@xyflow/react";

export default function TimerEventNode({ data, selected }) {
  return (
    <div className={`event-node event-node--timer ${selected ? "event-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="event-node__circle">⏱</div>
      <div className="event-node__label">{data.label || "Timer"}</div>
      {data.timerValue && <div className="event-node__sublabel">{data.timerValue}</div>}
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

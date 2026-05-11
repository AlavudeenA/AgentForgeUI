import { Handle, Position } from "@xyflow/react";
import { useWorkflowStore } from "../../store/useWorkflowStore.js";

export default function TimerEventNode({ id, data, selected }) {
  const status = useWorkflowStore((s) => s.runStatus[id]);
  const active = status === "in-progress";
  const done   = status === "completed";

  return (
    <div className={`event-node event-node--timer ${selected ? "event-node--selected" : ""} ${active ? "event-node--timer-active" : ""} ${done ? "event-node--timer-done" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" />
      <div className="event-node__circle">
        <span className={active ? "timer-icon-spin" : ""}>⏱</span>
      </div>
      <div className="event-node__label">{data.label || "Timer"}</div>
      {data.timerValue && (
        <div className="event-node__sublabel">
          {/^\d+(\.\d+)?$/.test(data.timerValue) ? `${data.timerValue}s` : data.timerValue}
        </div>
      )}
      <Handle type="source" position={Position.Bottom} className="flow-handle" />
    </div>
  );
}

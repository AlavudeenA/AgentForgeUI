import { Handle, Position } from "@xyflow/react";

export default function ParallelGatewayNode({ data, selected }) {
  return (
    <div className={`decision-node decision-node--parallel ${selected ? "decision-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" id="in" />
      <div className="decision-node__diamond">
        <div className="decision-node__inner">
          <span className="decision-node__icon" style={{ fontSize: "1.4rem", fontWeight: 900, color: "#059669" }}>+</span>
          <span className="decision-node__label">{data.label || "Parallel"}</span>
        </div>
      </div>
      <Handle type="source" position={Position.Left}   id="out-1" className="flow-handle" />
      <Handle type="source" position={Position.Bottom} id="out-2" className="flow-handle" />
      <Handle type="source" position={Position.Right}  id="out-3" className="flow-handle" />
    </div>
  );
}

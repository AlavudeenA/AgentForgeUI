import { Handle, Position } from "@xyflow/react";

export default function DecisionNode({ data, selected }) {
  return (
    <div className={`decision-node ${selected ? "decision-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" id="in" />

      <div className="decision-node__diamond">
        <div className="decision-node__inner">
          <span className="decision-node__label">{data.label || "Decision"}</span>
        </div>
      </div>

<Handle type="source" position={Position.Bottom} id="yes" className="flow-handle flow-handle--true" />
      <Handle type="source" position={Position.Right}  id="no"  className="flow-handle flow-handle--false" />
    </div>
  );
}

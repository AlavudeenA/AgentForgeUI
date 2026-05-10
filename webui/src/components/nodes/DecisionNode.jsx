import { Handle, Position } from "@xyflow/react";

export default function DecisionNode({ id, data, selected }) {
  return (
    <div className={`decision-node ${selected ? "decision-node--selected" : ""}`}>
      <Handle type="target" position={Position.Top} className="flow-handle" id="top" />

      <div className="decision-node__diamond">
        <div className="decision-node__inner">
          <span className="decision-node__icon">◆</span>
          <span className="decision-node__label">{data.label || "Decision"}</span>
        </div>
      </div>

      {data.condition && (
        <div className="decision-node__condition">
          <code>{data.condition}</code>
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        id="true"
        className="flow-handle flow-handle--true"
        style={{ left: "30%" }}
      />
      <Handle
        type="source"
        position={Position.Bottom}
        id="false"
        className="flow-handle flow-handle--false"
        style={{ left: "70%" }}
      />
    </div>
  );
}

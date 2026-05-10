import { BaseEdge, EdgeLabelRenderer, getBezierPath } from "@xyflow/react";
import { useWorkflowStore } from "../../store/useWorkflowStore.js";

export default function CustomEdge({
  id, sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition, data, selected,
}) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition,
  });

  const selectEdge = useWorkflowStore((s) => s.selectEdge);

  return (
    <>
      <BaseEdge
        path={edgePath}
        className={`custom-edge ${selected ? "custom-edge--selected" : ""}`}
        onClick={() => selectEdge(id)}
      />
      {data?.label && (
        <EdgeLabelRenderer>
          <div
            className="edge-label"
            style={{ transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)` }}
            onClick={() => selectEdge(id)}
          >
            {data.label}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

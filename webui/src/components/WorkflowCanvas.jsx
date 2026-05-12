import { useCallback, useRef } from "react";
import {
  Background,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import { useWorkflowStore } from "../store/useWorkflowStore.js";
import { NODE_TYPES_MAP, REGISTRY_BY_TYPE } from "../config/nodeRegistry.js";
import CustomEdge from "./edges/CustomEdge.jsx";

const EDGE_TYPES = { customEdge: CustomEdge };

function miniMapColor(n) {
  return REGISTRY_BY_TYPE[n.type]?.minimapColor ?? "var(--primary)";
}

function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow();
  const containerRef = useRef(null);

  const nodes          = useWorkflowStore((s) => s.nodes);
  const edges          = useWorkflowStore((s) => s.edges);
  const onNodesChange  = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange  = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect      = useWorkflowStore((s) => s.onConnect);
  const selectNode     = useWorkflowStore((s) => s.selectNode);
  const selectEdge     = useWorkflowStore((s) => s.selectEdge);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const addAgentNode   = useWorkflowStore((s) => s.addAgentNode);
  const addNode        = useWorkflowStore((s) => s.addNode);

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });

      const shapeKey = e.dataTransfer.getData("application/shape");
      if (shapeKey) {
        addNode(shapeKey, position);
        return;
      }

      const raw = e.dataTransfer.getData("application/json");
      if (raw) addAgentNode(JSON.parse(raw), position);
    },
    [screenToFlowPosition, addAgentNode, addNode]
  );

  const onNodeClick = useCallback((_, node) => selectNode(node.id), [selectNode]);
  const onEdgeClick = useCallback((_, edge) => selectEdge(edge.id), [selectEdge]);
  const onPaneClick = useCallback(() => clearSelection(), [clearSelection]);

  return (
    <div ref={containerRef} className="canvas-container">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onEdgeClick={onEdgeClick}
        onPaneClick={onPaneClick}
        onDrop={onDrop}
        onDragOver={onDragOver}
        nodeTypes={NODE_TYPES_MAP}
        edgeTypes={EDGE_TYPES}
        defaultEdgeOptions={{ type: "customEdge", animated: false, data: { label: "", condition: "" } }}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        snapToGrid
        snapGrid={[16, 16]}
        deleteKeyCode="Delete"
        proOptions={{ hideAttribution: true }}
      >
        <Background variant="dots" gap={24} size={1.5} color="var(--border)" />
        <Controls className="flow-controls" />
        <MiniMap
          className="flow-minimap"
          nodeColor={miniMapColor}
          maskColor="rgba(244,241,237,0.7)"
        />
        {nodes.length === 0 && (
          <div className="canvas-empty-state">
            <div className="canvas-empty-state__icon">⬡</div>
            <h3>Drag agents to build your workflow</h3>
            <p>Pull agents from the left panel onto the canvas to get started</p>
          </div>
        )}
      </ReactFlow>
    </div>
  );
}

export default function WorkflowCanvas() {
  return (
    <ReactFlowProvider>
      <CanvasInner />
    </ReactFlowProvider>
  );
}

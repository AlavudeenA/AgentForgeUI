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
import AgentNode from "./nodes/AgentNode.jsx";
import DecisionNode from "./nodes/DecisionNode.jsx";
import TimerEventNode from "./nodes/TimerEventNode.jsx";
import MessageEventNode from "./nodes/MessageEventNode.jsx";
import ParallelGatewayNode from "./nodes/ParallelGatewayNode.jsx";
import UserTaskNode from "./nodes/UserTaskNode.jsx";
import ServiceTaskNode from "./nodes/ServiceTaskNode.jsx";
import ScriptTaskNode from "./nodes/ScriptTaskNode.jsx";
import SendTaskNode from "./nodes/SendTaskNode.jsx";
import AnnotationNode from "./nodes/AnnotationNode.jsx";
import McpTaskNode from "./nodes/McpTaskNode.jsx";
import CustomEdge from "./edges/CustomEdge.jsx";

const NODE_TYPES = {
  agentNode: AgentNode,
  decisionNode: DecisionNode,
  timerEventNode: TimerEventNode,
  messageEventNode: MessageEventNode,
  parallelGatewayNode: ParallelGatewayNode,
  userTaskNode: UserTaskNode,
  serviceTaskNode: ServiceTaskNode,
  scriptTaskNode: ScriptTaskNode,
  sendTaskNode: SendTaskNode,
  annotationNode: AnnotationNode,
  mcpTaskNode: McpTaskNode,
};

const EDGE_TYPES = { customEdge: CustomEdge };

const EVENT_NODE_COLORS = {
  timerEventNode: "#06b6d4",
  messageEventNode: "#8b5cf6",
};

const TASK_NODE_COLORS = {
  userTaskNode: "#4f7fff",
  serviceTaskNode: "#6366f1",
  scriptTaskNode: "#8b5cf6",
  sendTaskNode: "#06b6d4",
};

function miniMapColor(n) {
  if (n.type === "decisionNode" || n.type === "parallelGatewayNode") return "#f59e0b";
  if (EVENT_NODE_COLORS[n.type]) return EVENT_NODE_COLORS[n.type];
  if (TASK_NODE_COLORS[n.type]) return TASK_NODE_COLORS[n.type];
  if (n.type === "annotationNode") return "#ca8a04";
  return "var(--primary)";
}

function CanvasInner() {
  const { screenToFlowPosition } = useReactFlow();
  const containerRef = useRef(null);

  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const onNodesChange = useWorkflowStore((s) => s.onNodesChange);
  const onEdgesChange = useWorkflowStore((s) => s.onEdgesChange);
  const onConnect = useWorkflowStore((s) => s.onConnect);
  const selectNode = useWorkflowStore((s) => s.selectNode);
  const selectEdge = useWorkflowStore((s) => s.selectEdge);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const addAgentNode = useWorkflowStore((s) => s.addAgentNode);
  const addDecisionNode = useWorkflowStore((s) => s.addDecisionNode);
  const addTimerEventNode = useWorkflowStore((s) => s.addTimerEventNode);
  const addMessageEventNode = useWorkflowStore((s) => s.addMessageEventNode);
  const addParallelGatewayNode = useWorkflowStore((s) => s.addParallelGatewayNode);
  const addUserTaskNode = useWorkflowStore((s) => s.addUserTaskNode);
  const addServiceTaskNode = useWorkflowStore((s) => s.addServiceTaskNode);
  const addScriptTaskNode = useWorkflowStore((s) => s.addScriptTaskNode);
  const addSendTaskNode = useWorkflowStore((s) => s.addSendTaskNode);
  const addAnnotationNode = useWorkflowStore((s) => s.addAnnotationNode);
  const addMcpTaskNode = useWorkflowStore((s) => s.addMcpTaskNode);

  const SHAPE_ADDERS = {
    decision: addDecisionNode,
    timerEvent: addTimerEventNode,
    messageEvent: addMessageEventNode,
    parallelGateway: addParallelGatewayNode,
    userTask: addUserTaskNode,
    serviceTask: addServiceTaskNode,
    scriptTask: addScriptTaskNode,
    sendTask: addSendTaskNode,
    annotation: addAnnotationNode,
    mcpTask: addMcpTaskNode,
  };

  const onDragOver = useCallback((e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  const onDrop = useCallback(
    (e) => {
      e.preventDefault();

      const shapeType = e.dataTransfer.getData("application/shape");
      if (shapeType && SHAPE_ADDERS[shapeType]) {
        const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
        SHAPE_ADDERS[shapeType](position);
        return;
      }

      const raw = e.dataTransfer.getData("application/json");
      if (!raw) return;
      const agentMeta = JSON.parse(raw);
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY });
      addAgentNode(agentMeta, position);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [screenToFlowPosition, addAgentNode, addDecisionNode,
     addTimerEventNode, addMessageEventNode, addParallelGatewayNode,
     addUserTaskNode, addServiceTaskNode, addScriptTaskNode, addSendTaskNode, addAnnotationNode, addMcpTaskNode]
  );

  const onNodeClick = useCallback(
    (_, node) => selectNode(node.id),
    [selectNode]
  );

  const onEdgeClick = useCallback(
    (_, edge) => selectEdge(edge.id),
    [selectEdge]
  );

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
        nodeTypes={NODE_TYPES}
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

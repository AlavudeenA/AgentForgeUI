/**
 * NODE REGISTRY — full registry with React components.
 *
 * To add a new node type:
 *   1. Create the React component in webui/src/components/nodes/
 *   2. Add ONE entry in nodeRegistryData.js
 *   3. Add the component mapping below
 *   4. If executable: add the matching handler in api/routes/workflows.py
 *
 * WorkflowCanvas and AgentSidebar import from here.
 * useWorkflowStore and RunPanel import from nodeRegistryData.js (no React, no circular dep).
 */

import AgentNode        from "../components/nodes/AgentNode.jsx";
import DecisionNode     from "../components/nodes/DecisionNode.jsx";
import TimerEventNode   from "../components/nodes/TimerEventNode.jsx";
import MessageEventNode from "../components/nodes/MessageEventNode.jsx";
import ServiceTaskNode  from "../components/nodes/ServiceTaskNode.jsx";
import ScriptTaskNode   from "../components/nodes/ScriptTaskNode.jsx";
import AnnotationNode   from "../components/nodes/AnnotationNode.jsx";
import McpTaskNode      from "../components/nodes/McpTaskNode.jsx";

import { NODE_REGISTRY_DATA } from "./nodeRegistryData.js";

const COMPONENT_MAP = {
  timerEventNode:   TimerEventNode,
  messageEventNode: MessageEventNode,
  decisionNode:     DecisionNode,
  mcpTaskNode:      McpTaskNode,
  serviceTaskNode:  ServiceTaskNode,
  scriptTaskNode:   ScriptTaskNode,
  annotationNode:   AnnotationNode,
};

export const NODE_REGISTRY = NODE_REGISTRY_DATA.map((e) => ({
  ...e,
  component: COMPONENT_MAP[e.type] ?? null,
}));

/** React Flow nodeTypes map — pass directly to <ReactFlow nodeTypes={...} /> */
export const NODE_TYPES_MAP = {
  agentNode: AgentNode,
  ...Object.fromEntries(NODE_REGISTRY.map((e) => [e.type, e.component])),
};

// Re-export data-only lookups so callers don't need to know about the split
export { REGISTRY_BY_TYPE, EXECUTABLE_TYPES, SIDEBAR_GROUPS } from "./nodeRegistryData.js";

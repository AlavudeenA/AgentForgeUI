import { create } from "zustand";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";

let nodeCounter = 0;
const newId = () => `node-${++nodeCounter}-${Date.now()}`;

export const useWorkflowStore = create((set, get) => ({
  // ── Agents metadata ──────────────────────────────────────────────────────
  agents: [],
  setAgents: (agents) => set({ agents }),

  // ── Canvas state ─────────────────────────────────────────────────────────
  nodes: [],
  edges: [],
  selectedNodeId: null,
  selectedEdgeId: null,
  workflowName: "my-workflow",

  setWorkflowName: (name) => set({ workflowName: name }),

  onNodesChange: (changes) =>
    set((s) => ({ nodes: applyNodeChanges(changes, s.nodes) })),

  onEdgesChange: (changes) =>
    set((s) => ({ edges: applyEdgeChanges(changes, s.edges) })),

  onConnect: (connection) =>
    set((s) => ({
      edges: [
        ...s.edges,
        {
          ...connection,
          id: `edge-${Date.now()}`,
          type: "customEdge",
          animated: false,
          data: { label: "", condition: "" },
        },
      ],
    })),

  selectNode: (id) => set({ selectedNodeId: id, selectedEdgeId: null }),
  selectEdge: (id) => set({ selectedEdgeId: id, selectedNodeId: null }),
  clearSelection: () => set({ selectedNodeId: null, selectedEdgeId: null }),

  addAgentNode: (agentMeta, position) => {
    const id = newId();
    const node = {
      id,
      type: "agentNode",
      position,
      data: {
        agentName: agentMeta.name,
        label: agentMeta.name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        description: agentMeta.description,
        inputFormat: agentMeta.input_format,
        inputOrder: agentMeta.input_order,
        outputFormat: agentMeta.output_format,
        inputs: Object.fromEntries(
          agentMeta.input_order.map((k) => [k, agentMeta.input_format[k]?.default ?? ""])
        ),
        requires_approval: false,
      },
    };
    set((s) => ({ nodes: [...s.nodes, node], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addDecisionNode: (position) => {
    const id = newId();
    set((s) => ({
      nodes: [
        ...s.nodes,
        {
          id,
          type: "decisionNode",
          position,
          data: { label: "Decision", condition: "", description: "Conditional branch" },
        },
      ],
      selectedNodeId: id,
      selectedEdgeId: null,
    }));
    return id;
  },

  addStartEventNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "startEventNode", position, data: { label: "Start" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addEndEventNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "endEventNode", position, data: { label: "End" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addTimerEventNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "timerEventNode", position, data: { label: "Timer", timerType: "duration", timerValue: "5" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addMessageEventNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "messageEventNode", position, data: { label: "Message", messageName: "" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addParallelGatewayNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "parallelGatewayNode", position, data: { label: "Parallel" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addUserTaskNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "userTaskNode", position, data: { label: "User Task", assignee: "", instructions: "", requires_approval: true } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addServiceTaskNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "serviceTaskNode", position, data: { label: "Service Task", method: "GET", url: "", headers: "", body: "" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addScriptTaskNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "scriptTaskNode", position, data: { label: "Script Task", language: "python", script: "" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addSendTaskNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "sendTaskNode", position, data: { label: "Send Task", to: "", subject: "", body: "" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

  addAnnotationNode: (position) => {
    const id = newId();
    set((s) => ({ nodes: [...s.nodes, { id, type: "annotationNode", position, data: { text: "Add a note…" } }], selectedNodeId: id, selectedEdgeId: null }));
    return id;
  },

updateNodeData: (id, patch) =>
    set((s) => ({
      nodes: s.nodes.map((n) => (n.id === id ? { ...n, data: { ...n.data, ...patch } } : n)),
    })),

  updateNodeInput: (id, fieldName, value) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, inputs: { ...n.data.inputs, [fieldName]: value } } } : n
      ),
    })),

  updateEdgeData: (id, patch) =>
    set((s) => ({
      edges: s.edges.map((e) => (e.id === id ? { ...e, data: { ...e.data, ...patch } } : e)),
    })),

  deleteNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
      selectedNodeId: s.selectedNodeId === id ? null : s.selectedNodeId,
    })),

  deleteEdge: (id) =>
    set((s) => ({
      edges: s.edges.filter((e) => e.id !== id),
      selectedEdgeId: s.selectedEdgeId === id ? null : s.selectedEdgeId,
    })),

  clearCanvas: () => set({ nodes: [], edges: [], selectedNodeId: null, selectedEdgeId: null }),

  loadWorkflowToCanvas: (wf) => {
    set({
      nodes: wf.nodes || [],
      edges: wf.edges || [],
      workflowName: wf.name || "my-workflow",
      selectedNodeId: null,
      selectedEdgeId: null,
    });
  },

  // ── Derive the full workflow payload for backend execution ────────────────
  buildWorkflowPayload: () => {
    const { nodes, edges } = get();
    const EXEC_TYPES = new Set(["agentNode", "timerEventNode", "decisionNode"]);

    // Topological sort
    const adj = {};
    const inDegree = {};
    nodes.forEach((n) => { adj[n.id] = []; inDegree[n.id] = 0; });
    edges.forEach((e) => {
      if (adj[e.source]) adj[e.source].push(e.target);
      if (e.target in inDegree) inDegree[e.target] = (inDegree[e.target] || 0) + 1;
    });
    const queue = nodes.filter((n) => inDegree[n.id] === 0).map((n) => n.id);
    const sorted = [];
    while (queue.length) {
      const cur = queue.shift();
      sorted.push(cur);
      (adj[cur] || []).forEach((next) => {
        inDegree[next]--;
        if (inDegree[next] === 0) queue.push(next);
      });
    }
    const order = sorted.length === nodes.length ? sorted : nodes.map((n) => n.id);
    const nodeMap = Object.fromEntries(nodes.map((n) => [n.id, n]));

    const execNodes = order.map((id) => nodeMap[id]).filter((n) => n && EXEC_TYPES.has(n.type));
    const execNodeIds = new Set(execNodes.map((n) => n.id));

    const agents = execNodes.map((n) => {
      if (n.type === "timerEventNode") {
        return { node_type: "timer", agent_name: "__timer__", node_id: n.id,
                 timer_value: n.data.timerValue || "5", inputs: {}, requires_approval: false };
      }
      if (n.type === "decisionNode") {
        return { node_type: "decision", agent_name: "__decision__", node_id: n.id,
                 condition: n.data.condition || "False", inputs: {}, requires_approval: false };
      }
return { agent_name: n.data.agentName, node_id: n.id,
               inputs: n.data.inputs || {}, requires_approval: n.data.requires_approval || false };
    });

    const payloadEdges = edges
      .filter((e) => execNodeIds.has(e.source) && execNodeIds.has(e.target))
      .map((e) => ({ source: e.source, target: e.target, sourceHandle: e.sourceHandle || null }));

    return { agents, edges: payloadEdges };
  },

  // ── Legacy alias (kept for RunTab compatibility) ───────────────────────────
  buildAgentsPayload: () => {
    const payload = get().buildWorkflowPayload();
    return payload.agents;
  },

  // ── Active run ────────────────────────────────────────────────────────────
  activeRunId: null,
  runStatus: {},  // { [node_id]: status string }
  runOutputs: {}, // { [node_id]: output dict }
  runCompleted: false,
  runError: null,

  setActiveRun: (runId) => set({ activeRunId: runId, runStatus: {}, runOutputs: {}, runCompleted: false, runError: null }),
  updateRunStatus: (agentStatus, agents, completed, error) =>
    set({
      runStatus: agentStatus || {},
      runOutputs: Object.fromEntries((agents || []).map((a) => [a.node_id, a.output])),
      runCompleted: completed,
      runError: error,
    }),
  clearRun: () => set({ activeRunId: null, runStatus: {}, runOutputs: {}, runCompleted: false, runError: null }),
}));

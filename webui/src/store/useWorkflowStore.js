import { create } from "zustand";
import { applyEdgeChanges, applyNodeChanges } from "@xyflow/react";
import { REGISTRY_BY_TYPE, EXECUTABLE_TYPES } from "../config/nodeRegistryData.js";

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

  // Generic add — driven by nodeRegistry. shapeKey matches entry.shapeKey.
  addNode: (shapeKey, position) => {
    const entry = Object.values(REGISTRY_BY_TYPE).find((e) => e.shapeKey === shapeKey);
    if (!entry) return;
    const id = newId();
    set((s) => ({
      nodes: [...s.nodes, { id, type: entry.type, position, data: { ...entry.defaultData } }],
      selectedNodeId: id,
      selectedEdgeId: null,
    }));
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

    const execNodes = order.map((id) => nodeMap[id]).filter((n) => n && EXECUTABLE_TYPES.has(n.type));
    const execNodeIds = new Set(execNodes.map((n) => n.id));

    const agents = execNodes.map((n) => {
      if (n.type === "agentNode") {
        return { agent_name: n.data.agentName, node_id: n.id,
                 inputs: n.data.inputs || {}, requires_approval: n.data.requires_approval || false };
      }
      // All other executable types: delegate to registry toPayload
      const reg = REGISTRY_BY_TYPE[n.type];
      return reg?.toPayload(n.data, n.id) ?? null;
    }).filter(Boolean);

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

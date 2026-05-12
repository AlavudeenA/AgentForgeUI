import { create } from "zustand";

export const EMPTY_XML = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn2:definitions
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xmlns:bpmn2="http://www.omg.org/spec/BPMN/20100524/MODEL"
  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
  id="Definitions_1"
  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn2:process id="Process_1" isExecutable="true" />
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1" />
  </bpmndi:BPMNDiagram>
</bpmn2:definitions>`;

const EXEC_BPMN_TYPES = new Set([
  "bpmn:ServiceTask",
  "bpmn:ScriptTask",
  "bpmn:IntermediateCatchEvent",
  "bpmn:ExclusiveGateway",
]);

export const useWorkflowStore = create((set, get) => ({
  // ── Agents metadata ──────────────────────────────────────────────────────
  agents: [],
  setAgents: (agents) => set({ agents }),

  // ── Workflow name ────────────────────────────────────────────────────────
  workflowName: "my-workflow",
  setWorkflowName: (name) => set({ workflowName: name }),

  // ── bpmn-js modeler reference (mutable, not tracked by Zustand) ──────────
  modeler: null,
  setModeler: (modeler) => set({ modeler }),

  // ── Per-element agent config keyed by BPMN element id ────────────────────
  // { [elementId]: { agentForgeType, agentName, inputs, requires_approval, ... } }
  elementProps: {},
  updateElementProps: (id, patch) =>
    set((s) => ({
      elementProps: { ...s.elementProps, [id]: { ...(s.elementProps[id] ?? {}), ...patch } },
    })),
  deleteElementProps: (id) =>
    set((s) => {
      const next = { ...s.elementProps };
      delete next[id];
      return { elementProps: next };
    }),

  // ── Temp slot used to associate data with the element just created ────────
  _pendingCreate: null,
  setPendingCreate: (data) => set({ _pendingCreate: data }),

  // ── Reactive list of executable elements — drives RunPanel + Run button ───
  executableElements: [], // [{ id, label, bpmnType, agentForgeType }]
  setExecutableElements: (arr) => set({ executableElements: arr }),

  // Called from BpmnCanvas event handlers (outside React) to keep the list fresh
  _syncExecutableElements: () => {
    const { modeler, elementProps } = get();
    if (!modeler) return;
    try {
      const reg = modeler.get("elementRegistry");
      const arr = reg
        .getAll()
        .filter((e) => EXEC_BPMN_TYPES.has(e.type))
        .map((e) => ({
          id: e.id,
          label: e.businessObject?.name || e.id,
          bpmnType: e.type,
          agentForgeType: (elementProps[e.id] ?? {}).agentForgeType ?? null,
        }));
      set({ executableElements: arr });
    } catch (_) {}
  },

  // ── Selection ────────────────────────────────────────────────────────────
  selectedElementId: null,
  setSelectedElementId: (id) => set({ selectedElementId: id }),

  // ── Canvas actions ────────────────────────────────────────────────────────
  clearCanvas: () => {
    const { modeler } = get();
    if (modeler) modeler.importXML(EMPTY_XML).catch(() => {});
    set({ elementProps: {}, executableElements: [], selectedElementId: null });
  },

  loadWorkflowToCanvas: async (wf) => {
    const { modeler } = get();
    if (!modeler) return;
    set({ workflowName: wf.name ?? "my-workflow" });
    if (wf.bpmnXml) {
      await modeler.importXML(wf.bpmnXml);
      set({ elementProps: wf.elementProps ?? {}, selectedElementId: null });
      get()._syncExecutableElements();
    }
  },

  // ── Serialize for save ────────────────────────────────────────────────────
  getWorkflowData: async () => {
    const { modeler, workflowName, elementProps } = get();
    if (!modeler) return null;
    const { xml } = await modeler.saveXML({ format: true });
    return { name: workflowName, bpmnXml: xml, elementProps };
  },

  // ── Build execution payload for backend ──────────────────────────────────
  buildWorkflowPayload: () => {
    const { modeler, elementProps } = get();
    if (!modeler) return { agents: [], edges: [] };

    let elements;
    try {
      elements = modeler.get("elementRegistry").getAll();
    } catch (_) {
      return { agents: [], edges: [] };
    }

    const execShapes = elements.filter((e) => EXEC_BPMN_TYPES.has(e.type));
    const flows = elements.filter((e) => e.type === "bpmn:SequenceFlow");
    const execIds = new Set(execShapes.map((e) => e.id));

    // Topological sort
    const adj = {};
    const inDeg = {};
    execShapes.forEach((s) => { adj[s.id] = []; inDeg[s.id] = 0; });
    flows.forEach((f) => {
      if (execIds.has(f.source?.id) && execIds.has(f.target?.id)) {
        adj[f.source.id].push(f.target.id);
        inDeg[f.target.id] = (inDeg[f.target.id] ?? 0) + 1;
      }
    });
    const queue = execShapes.filter((s) => inDeg[s.id] === 0).map((s) => s.id);
    const sorted = [];
    while (queue.length) {
      const cur = queue.shift();
      sorted.push(cur);
      (adj[cur] ?? []).forEach((nxt) => { if (--inDeg[nxt] === 0) queue.push(nxt); });
    }
    const order = sorted.length === execShapes.length ? sorted : execShapes.map((s) => s.id);
    const shapeById = Object.fromEntries(execShapes.map((s) => [s.id, s]));

    const agents = order.map((id) => {
      const shape = shapeById[id];
      const props = elementProps[id] ?? {};
      const { agentForgeType } = props;

      if (agentForgeType === "agent") {
        return {
          node_type: "agent", agent_name: props.agentName, node_id: id,
          inputs: props.inputs ?? {}, requires_approval: props.requires_approval ?? false,
        };
      }
      if (agentForgeType === "mcp") {
        return {
          node_type: "mcp", agent_name: "__mcp__", node_id: id,
          server_name: props.serverName ?? "", tool_name: props.toolName ?? "",
          arguments: props.arguments ?? "", output_key: props.outputKey ?? "mcp_result",
          inputs: {}, requires_approval: false,
        };
      }
      if (shape.type === "bpmn:IntermediateCatchEvent") {
        return {
          node_type: "timer", agent_name: "__timer__", node_id: id,
          timer_value: props.timerValue ?? "5", inputs: {}, requires_approval: false,
        };
      }
      if (shape.type === "bpmn:ExclusiveGateway") {
        return {
          node_type: "decision", agent_name: "__decision__", node_id: id,
          condition: props.condition ?? "False", inputs: {}, requires_approval: false,
        };
      }
      if (shape.type === "bpmn:ScriptTask") {
        return {
          node_type: "script", agent_name: "__script__", node_id: id,
          language: props.language ?? "python", script: props.script ?? "",
          inputs: {}, requires_approval: false,
        };
      }
      return {
        node_type: "service", agent_name: "__service__", node_id: id,
        method: props.method ?? "GET", url: props.url ?? "",
        inputs: {}, requires_approval: false,
      };
    }).filter(Boolean);

    const payloadEdges = flows
      .filter((f) => execIds.has(f.source?.id) && execIds.has(f.target?.id))
      .map((f) => ({
        source: f.source.id,
        target: f.target.id,
        sourceHandle: f.businessObject?.conditionExpression?.body ?? null,
      }));

    return { agents, edges: payloadEdges };
  },

  // ── Run state ─────────────────────────────────────────────────────────────
  activeRunId: null,
  runStatus:   {},
  runOutputs:  {},
  runCompleted: false,
  runError:    null,

  setActiveRun: (runId) =>
    set({ activeRunId: runId, runStatus: {}, runOutputs: {}, runCompleted: false, runError: null }),
  updateRunStatus: (agentStatus, agents, completed, error) =>
    set({
      runStatus:   agentStatus ?? {},
      runOutputs:  Object.fromEntries((agents ?? []).map((a) => [a.node_id, a.output])),
      runCompleted: completed,
      runError:    error,
    }),
  clearRun: () =>
    set({ activeRunId: null, runStatus: {}, runOutputs: {}, runCompleted: false, runError: null }),
}));

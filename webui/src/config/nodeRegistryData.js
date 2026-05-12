/**
 * WORKFLOW ELEMENT REGISTRY — sidebar entries + BPMN type mappings.
 * No React component imports — safe to use anywhere.
 *
 * To add a new workflow element:
 *   1. Add ONE entry here
 *   2. Add the matching backend handler in api/routes/workflows.py
 */

export const WORKFLOW_ELEMENT_REGISTRY = [
  // ── Events ────────────────────────────────────────────────────────────────
  {
    shapeKey:     "timerEvent",
    sidebarGroup: "Events",
    icon:         "⏱",
    label:        "Timer",
    title:        "Timer Event — wait / delay",
    bpmnType:     "bpmn:IntermediateCatchEvent",
    defaultProps: { agentForgeType: "timer", timerValue: "5", timerType: "duration" },
    executable:   true,
  },
  {
    shapeKey:     "messageEvent",
    sidebarGroup: "Events",
    icon:         "✉",
    label:        "Message",
    title:        "Message Event",
    bpmnType:     "bpmn:IntermediateCatchEvent",
    defaultProps: { agentForgeType: "message" },
    executable:   false,
  },

  // ── Gateways ──────────────────────────────────────────────────────────────
  {
    shapeKey:     "decision",
    sidebarGroup: "Gateways",
    icon:         "◆",
    label:        "XOR",
    title:        "Exclusive Gateway — one path (XOR)",
    bpmnType:     "bpmn:ExclusiveGateway",
    defaultProps: { agentForgeType: "decision", condition: "" },
    executable:   true,
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────
  {
    shapeKey:     "mcpTask",
    sidebarGroup: "Tasks",
    icon:         "🔌",
    label:        "MCP",
    title:        "MCP Client — call a tool from mcp.json",
    bpmnType:     "bpmn:ServiceTask",
    defaultProps: { agentForgeType: "mcp", serverName: "", toolName: "", arguments: "", outputKey: "mcp_result" },
    executable:   true,
  },
  {
    shapeKey:     "serviceTask",
    sidebarGroup: "Tasks",
    icon:         "⚙",
    label:        "Service",
    title:        "Service Task — automated HTTP/API call",
    bpmnType:     "bpmn:ServiceTask",
    defaultProps: { agentForgeType: "service", method: "GET", url: "", headers: "", body: "" },
    executable:   false,
  },
  {
    shapeKey:     "scriptTask",
    sidebarGroup: "Tasks",
    icon:         "📜",
    label:        "Script",
    title:        "Script Task — runs a script",
    bpmnType:     "bpmn:ScriptTask",
    defaultProps: { agentForgeType: "script", language: "python", script: "" },
    executable:   false,
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  {
    shapeKey:     "annotation",
    sidebarGroup: "Other",
    icon:         "📝",
    label:        "Note",
    title:        "Annotation — add a text note to the canvas",
    bpmnType:     "bpmn:TextAnnotation",
    defaultProps: { agentForgeType: "annotation" },
    executable:   false,
  },
];

export const WORKFLOW_ELEMENT_BY_KEY = Object.fromEntries(
  WORKFLOW_ELEMENT_REGISTRY.map((e) => [e.shapeKey, e])
);

export const SIDEBAR_GROUPS = WORKFLOW_ELEMENT_REGISTRY.reduce((acc, entry) => {
  (acc[entry.sidebarGroup] ??= []).push(entry);
  return acc;
}, {});

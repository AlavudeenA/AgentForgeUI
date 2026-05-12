/**
 * NODE REGISTRY DATA — pure data, no React component imports.
 * Safe to import from the Zustand store and any non-UI module.
 *
 * nodeRegistry.js extends this with React components for UI use.
 */

export const NODE_REGISTRY_DATA = [
  // ── Events ────────────────────────────────────────────────────────────────
  {
    type:         "timerEventNode",
    executable:   true,
    sidebarGroup: "Events",
    shapeKey:     "timerEvent",
    icon:         "⏱",
    label:        "Timer",
    title:        "Timer Event — wait / delay",
    minimapColor: "#06b6d4",
    defaultData:  { label: "Timer", timerType: "duration", timerValue: "5" },
    runLabel:     (data) => `⏱ ${data.label || "Timer"} (${data.timerValue || ""}s)`,
    toPayload:    (data, id) => ({
      node_type: "timer", agent_name: "__timer__", node_id: id,
      timer_value: data.timerValue || "5", inputs: {}, requires_approval: false,
    }),
  },
  {
    type:         "messageEventNode",
    executable:   false,
    sidebarGroup: "Events",
    shapeKey:     "messageEvent",
    icon:         "✉",
    label:        "Message",
    title:        "Message Event",
    minimapColor: "#8b5cf6",
    defaultData:  { label: "Message", messageName: "" },
    runLabel:     null,
    toPayload:    null,
  },

  // ── Gateways ──────────────────────────────────────────────────────────────
  {
    type:         "decisionNode",
    executable:   true,
    sidebarGroup: "Gateways",
    shapeKey:     "decision",
    icon:         "◆",
    label:        "XOR",
    title:        "Exclusive Gateway — one path (XOR)",
    minimapColor: "#f59e0b",
    defaultData:  { label: "Decision", condition: "", description: "Conditional branch" },
    runLabel:     (data) => `◆ ${data.label || "Decision"}`,
    toPayload:    (data, id) => ({
      node_type: "decision", agent_name: "__decision__", node_id: id,
      condition: data.condition || "False", inputs: {}, requires_approval: false,
    }),
  },

  // ── Tasks ─────────────────────────────────────────────────────────────────
  {
    type:         "mcpTaskNode",
    executable:   true,
    sidebarGroup: "Tasks",
    shapeKey:     "mcpTask",
    icon:         "🔌",
    label:        "MCP",
    title:        "MCP Client — call a tool from mcp.json",
    minimapColor: "#059669",
    defaultData:  { label: "MCP Client", serverName: "", toolName: "", arguments: "", outputKey: "mcp_result" },
    runLabel:     (data) => `🔌 ${data.label || "MCP"} (${data.toolName || ""})`,
    toPayload:    (data, id) => ({
      node_type: "mcp", agent_name: "__mcp__", node_id: id,
      server_name: data.serverName || "", tool_name: data.toolName || "",
      arguments: data.arguments || "", output_key: data.outputKey || "mcp_result",
      inputs: {}, requires_approval: false,
    }),
  },
  {
    type:         "serviceTaskNode",
    executable:   false,
    sidebarGroup: "Tasks",
    shapeKey:     "serviceTask",
    icon:         "⚙",
    label:        "Service",
    title:        "Service Task — automated HTTP/API call",
    minimapColor: "#6366f1",
    defaultData:  { label: "Service Task", method: "GET", url: "", headers: "", body: "" },
    runLabel:     null,
    toPayload:    null,
  },
  {
    type:         "scriptTaskNode",
    executable:   false,
    sidebarGroup: "Tasks",
    shapeKey:     "scriptTask",
    icon:         "📜",
    label:        "Script",
    title:        "Script Task — runs a script",
    minimapColor: "#8b5cf6",
    defaultData:  { label: "Script Task", language: "python", script: "" },
    runLabel:     null,
    toPayload:    null,
  },

  // ── Other ─────────────────────────────────────────────────────────────────
  {
    type:         "annotationNode",
    executable:   false,
    sidebarGroup: "Other",
    shapeKey:     "annotation",
    icon:         "📝",
    label:        "Note",
    title:        "Annotation — add a text note to the canvas",
    minimapColor: "#ca8a04",
    defaultData:  { text: "Add a note…" },
    runLabel:     null,
    toPayload:    null,
  },
];

// ── Derived lookups ──────────────────────────────────────────────────────────

export const REGISTRY_BY_TYPE = Object.fromEntries(
  NODE_REGISTRY_DATA.map((e) => [e.type, e])
);

export const EXECUTABLE_TYPES = new Set([
  "agentNode",
  ...NODE_REGISTRY_DATA.filter((e) => e.executable).map((e) => e.type),
]);

export const SIDEBAR_GROUPS = NODE_REGISTRY_DATA.reduce((acc, entry) => {
  (acc[entry.sidebarGroup] ??= []).push(entry);
  return acc;
}, {});

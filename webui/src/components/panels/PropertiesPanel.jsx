import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { useWorkflowStore } from "../../store/useWorkflowStore.js";

const EVENT_TYPES = ["startEventNode", "endEventNode", "timerEventNode", "messageEventNode"];
const GATEWAY_TYPES = ["decisionNode", "parallelGatewayNode"];
const TASK_TYPES = ["userTaskNode", "serviceTaskNode", "scriptTaskNode", "sendTaskNode"];

function useOutputOptions() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const options = [];
  nodes.forEach((n) => {
    const outFmt = n.data?.outputFormat || {};
    const agentName = n.data?.agentName || n.id;
    Object.keys(outFmt).forEach((field) => {
      options.push({
        label: `${n.data?.label || agentName}`,
        field,
        value: `{state['${agentName}_output']['${field}']}`,
      });
    });
  });
  return options;
}

function insertAtCursor(elRef, currentValue, text, onChange) {
  const el = elRef.current;
  if (!el) { onChange((currentValue || "") + text); return; }
  const start = el.selectionStart ?? (currentValue || "").length;
  const end = el.selectionEnd ?? start;
  const next = (currentValue || "").slice(0, start) + text + (currentValue || "").slice(end);
  onChange(next);
  requestAnimationFrame(() => {
    el.focus();
    el.selectionStart = el.selectionEnd = start + text.length;
  });
}

function OutputSuggestions({ elRef, value, onChange, visible }) {
  const options = useOutputOptions();
  if (!visible || options.length === 0) return null;

  return (
    <div className="field-suggestions">
      <div className="field-suggestions__header">Use output from</div>
      {options.map((o) => (
        <div
          key={o.value}
          className="field-suggestions__item"
          onMouseDown={(e) => {
            e.preventDefault();
            insertAtCursor(elRef, value, o.value, onChange);
          }}
        >
          <span className="field-suggestions__agent">{o.label}</span>
          <span className="field-suggestions__arrow">→</span>
          <span className="field-suggestions__field">{o.field}</span>
        </div>
      ))}
    </div>
  );
}

function FieldInput({ fieldName, fieldMeta, value, allValues, onChangeValue }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);
  const { ui_type, description, options, required, depends_on } = fieldMeta;

  if (depends_on && typeof depends_on === "object") {
    const [condField, condValue] = Object.entries(depends_on)[0];
    if ((allValues || {})[condField] !== condValue) return null;
  }

  const label = (
    <label className="prop-label">
      {fieldName.replace(/_/g, " ")}
      {required && <span className="prop-required">*</span>}
    </label>
  );

  if (ui_type === "hidden") return null;

  if (ui_type === "dropdown") {
    return (
      <div className="prop-field">
        {label}
        <select className="prop-select" value={value || ""} onChange={(e) => onChangeValue(fieldName, e.target.value)}>
          <option value="">— select —</option>
          {(options || []).map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
        {description && <span className="prop-hint">{description}</span>}
      </div>
    );
  }

  if (ui_type === "textarea") {
    return (
      <div className="prop-field">
        {label}
        <div style={{ position: "relative" }}>
          <textarea
            ref={inputRef}
            className="prop-textarea"
            value={value || ""}
            placeholder={description}
            rows={4}
            onChange={(e) => onChangeValue(fieldName, e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)}
          />
          <OutputSuggestions elRef={inputRef} value={value} onChange={(v) => onChangeValue(fieldName, v)} visible={focused} />
        </div>
        {description && <span className="prop-hint">{description}</span>}
      </div>
    );
  }

  if (ui_type === "file") {
    return (
      <div className="prop-field">
        {label}
        <input className="prop-input" type="text" value={value || ""} placeholder={description} onChange={(e) => onChangeValue(fieldName, e.target.value)} />
        <span className="prop-hint">Enter file path or upload via Files tab</span>
      </div>
    );
  }

  return (
    <div className="prop-field">
      {label}
      <div style={{ position: "relative" }}>
        <input
          ref={inputRef}
          className="prop-input"
          type="text"
          value={value || ""}
          placeholder={description}
          onChange={(e) => onChangeValue(fieldName, e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
        />
        <OutputSuggestions elRef={inputRef} value={value} onChange={(v) => onChangeValue(fieldName, v)} visible={focused} />
      </div>
      {description && <span className="prop-hint">{description}</span>}
    </div>
  );
}

function PropField({ label, hint, children }) {
  return (
    <div className="prop-field">
      <label className="prop-label">{label}</label>
      {children}
      {hint && <span className="prop-hint">{hint}</span>}
    </div>
  );
}

function EventPanel({ node }) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const { data, id, type } = node;

  const typeLabels = { startEventNode: "Start Event", endEventNode: "End Event", timerEventNode: "Timer Event", messageEventNode: "Message Event" };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{data.label || typeLabels[type]}</div>
          <div className="prop-panel__subtitle">{typeLabels[type]}</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={() => { deleteNode(id); clearSelection(); }}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Display Label">
          <input className="prop-input" value={data.label || ""} onChange={(e) => updateNodeData(id, { label: e.target.value })} />
        </PropField>
        {type === "timerEventNode" && (
          <>
            <PropField label="Timer Type" hint="duration = fixed delay, cycle = repeating, date = specific date/time">
              <select className="prop-select" value={data.timerType || "duration"} onChange={(e) => updateNodeData(id, { timerType: e.target.value })}>
                <option value="duration">Duration</option>
                <option value="cycle">Cycle</option>
                <option value="date">Date</option>
              </select>
            </PropField>
            <PropField label="Timer Value" hint="Seconds (e.g. 30) or ISO 8601 (e.g. PT1M30S, PT1H)">
              <input className="prop-input" value={data.timerValue || ""} placeholder="e.g. 30" onChange={(e) => updateNodeData(id, { timerValue: e.target.value })} />
            </PropField>
          </>
        )}
        {type === "messageEventNode" && (
          <PropField label="Message Name" hint="Identifier for the message this event waits for">
            <input className="prop-input" value={data.messageName || ""} placeholder="e.g. order.confirmed" onChange={(e) => updateNodeData(id, { messageName: e.target.value })} />
          </PropField>
        )}
      </div>
    </div>
  );
}

function GatewayPanel({ node }) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const { data, id, type } = node;
  const isDecision = type === "decisionNode";
  const title = isDecision ? "XOR Gateway" : "Parallel Gateway";

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{data.label || title}</div>
          <div className="prop-panel__subtitle">{title}</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={() => { deleteNode(id); clearSelection(); }}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Display Label">
          <input className="prop-input" value={data.label || ""} onChange={(e) => updateNodeData(id, { label: e.target.value })} />
        </PropField>
        {isDecision && (
          <PropField label="Condition" hint="True → Bottom (Yes path)  |  False → Right (No path)">
            <input
              className="prop-input"
              value={data.condition || ""}
              placeholder="e.g. state['addition_agent_output']['result'] > 100"
              onChange={(e) => updateNodeData(id, { condition: e.target.value })}
            />
          </PropField>
        )}
        {!isDecision && (
          <p className="prop-hint" style={{ padding: "0.5rem 0" }}>
            All outgoing paths execute simultaneously. Connect targets from left, bottom, and right handles.
          </p>
        )}
      </div>
    </div>
  );
}

function McpPanel({ node }) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const { data, id } = node;

  const [servers, setServers] = useState([]);
  const [fetchingTools, setFetchingTools] = useState(false);
  const [fetchedTools, setFetchedTools] = useState([]);
  const [fetchError, setFetchError] = useState("");

  useEffect(() => {
    api.getMcpServers().then((r) => setServers(r.servers || [])).catch(() => {});
  }, []);

  const handleFetchTools = async () => {
    if (!data.serverName) return;
    setFetchingTools(true);
    setFetchError("");
    setFetchedTools([]);
    try {
      const res = await api.listMcpTools(data.serverName);
      if (res.error) setFetchError(res.error);
      else setFetchedTools(res.tools || []);
    } catch (e) {
      setFetchError(String(e));
    } finally {
      setFetchingTools(false);
    }
  };

  const selectTool = (tool) => {
    const argKeys = Object.keys(tool.inputSchema?.properties || {});
    updateNodeData(id, {
      toolName: tool.name,
      arguments: argKeys.length
        ? JSON.stringify(Object.fromEntries(argKeys.map((k) => [k, ""])), null, 2)
        : data.arguments || "",
    });
    setFetchedTools([]);
  };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{data.label || "MCP Client"}</div>
          <div className="prop-panel__subtitle">MCP Task</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={() => { deleteNode(id); clearSelection(); }}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">

        <PropField label="Display Label">
          <input className="prop-input" value={data.label || ""} onChange={(e) => updateNodeData(id, { label: e.target.value })} />
        </PropField>

        <PropField label="MCP Server" hint="Servers are read from .vscode/mcp.json or mcp.json">
          <select
            className="prop-select"
            value={data.serverName || ""}
            onChange={(e) => updateNodeData(id, { serverName: e.target.value, toolName: "", arguments: "" })}
          >
            <option value="">— select server —</option>
            {servers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
          {servers.length === 0 && (
            <span style={{ fontSize: "0.73rem", color: "var(--text-muted)", marginTop: 4, display: "block" }}>
              No servers found — add them to <code>.vscode/mcp.json</code>
            </span>
          )}
        </PropField>

        <PropField label="Tool Name" hint="Tool to call on the selected server">
          <div style={{ display: "flex", gap: 6 }}>
            <input
              className="prop-input"
              value={data.toolName || ""}
              placeholder="e.g. add, search"
              onChange={(e) => updateNodeData(id, { toolName: e.target.value })}
              style={{ flex: 1 }}
            />
            <button
              className="btn btn--ghost btn--xs"
              onClick={handleFetchTools}
              disabled={fetchingTools || !data.serverName}
              title="Fetch available tools from the selected server"
              style={{ whiteSpace: "nowrap" }}
            >
              {fetchingTools ? "…" : "⟳ Fetch"}
            </button>
          </div>
          {fetchError && (
            <span style={{ color: "var(--error, #ef4444)", fontSize: "0.73rem", marginTop: 4, display: "block" }}>
              {fetchError}
            </span>
          )}
          {fetchedTools.length > 0 && (
            <div className="field-suggestions">
              <div className="field-suggestions__header">Available tools — click to select</div>
              {fetchedTools.map((t) => (
                <div key={t.name} className="field-suggestions__item" onMouseDown={(e) => { e.preventDefault(); selectTool(t); }}>
                  <span className="field-suggestions__agent">{t.name}</span>
                  {t.description && <span className="field-suggestions__field" style={{ fontSize: "0.72rem" }}>{t.description}</span>}
                </div>
              ))}
            </div>
          )}
        </PropField>

        <PropField label="Arguments (JSON)" hint="Tool inputs — supports {state['...']} placeholders">
          <textarea
            className="prop-textarea"
            rows={4}
            value={data.arguments || ""}
            placeholder={'{"a": "10", "b": "5"}'}
            onChange={(e) => updateNodeData(id, { arguments: e.target.value })}
            style={{ fontFamily: "var(--font-mono, monospace)", fontSize: "0.8rem" }}
          />
        </PropField>

        <PropField label="Output Key" hint="State key for the tool result — reference as {state['key']}">
          <input
            className="prop-input"
            value={data.outputKey || ""}
            placeholder="mcp_result"
            onChange={(e) => updateNodeData(id, { outputKey: e.target.value })}
          />
        </PropField>

      </div>
    </div>
  );
}

function TaskPanel({ node }) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const { data, id, type } = node;

  const typeLabels = { userTaskNode: "User Task", serviceTaskNode: "Service Task", scriptTaskNode: "Script Task", sendTaskNode: "Send Task", mcpTaskNode: "MCP Server" };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{data.label || typeLabels[type]}</div>
          <div className="prop-panel__subtitle">{typeLabels[type]}</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={() => { deleteNode(id); clearSelection(); }}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Display Label">
          <input className="prop-input" value={data.label || ""} onChange={(e) => updateNodeData(id, { label: e.target.value })} />
        </PropField>

        {type === "userTaskNode" && (
          <>
            <PropField label="Assignee" hint="Person or role responsible for this task">
              <input className="prop-input" value={data.assignee || ""} placeholder="e.g. john.doe or team:qa" onChange={(e) => updateNodeData(id, { assignee: e.target.value })} />
            </PropField>
            <PropField label="Instructions">
              <textarea className="prop-textarea" rows={4} value={data.instructions || ""} placeholder="Describe what the user should do…" onChange={(e) => updateNodeData(id, { instructions: e.target.value })} />
            </PropField>
            <PropField label="">
              <label className="prop-label" style={{ cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={data.requires_approval || false}
                  onChange={(e) => updateNodeData(id, { requires_approval: e.target.checked })}
                  style={{ marginRight: 6 }}
                />
                Require Human Approval (HITL)
              </label>
              <span className="prop-hint">Workflow pauses here and waits for approval</span>
            </PropField>
          </>
        )}

        {type === "serviceTaskNode" && (
          <>
            <PropField label="HTTP Method">
              <select className="prop-select" value={data.method || "GET"} onChange={(e) => updateNodeData(id, { method: e.target.value })}>
                {["GET", "POST", "PUT", "PATCH", "DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </PropField>
            <PropField label="URL" hint="Endpoint to call — supports {state[...]} placeholders">
              <input className="prop-input" value={data.url || ""} placeholder="https://api.example.com/resource" onChange={(e) => updateNodeData(id, { url: e.target.value })} />
            </PropField>
            <PropField label="Headers (JSON)" hint='e.g. {"Authorization": "Bearer token"}'>
              <textarea className="prop-textarea" rows={3} value={data.headers || ""} placeholder='{"Content-Type": "application/json"}' onChange={(e) => updateNodeData(id, { headers: e.target.value })} />
            </PropField>
            <PropField label="Request Body (JSON)" hint="Supports {state[...]} placeholders">
              <textarea className="prop-textarea" rows={4} value={data.body || ""} placeholder='{"key": "value"}' onChange={(e) => updateNodeData(id, { body: e.target.value })} />
            </PropField>
          </>
        )}

        {type === "scriptTaskNode" && (
          <>
            <PropField label="Language">
              <select className="prop-select" value={data.language || "python"} onChange={(e) => updateNodeData(id, { language: e.target.value })}>
                {["python", "javascript", "bash", "groovy"].map((l) => <option key={l} value={l}>{l}</option>)}
              </select>
            </PropField>
            <PropField label="Script" hint="Code to execute — use state dict for inputs/outputs">
              <textarea className="prop-textarea" rows={8} value={data.script || ""} placeholder={`# Python example\nresult = state.get('prev_output', {}).get('value', '')\nstate['script_result'] = result.upper()`} onChange={(e) => updateNodeData(id, { script: e.target.value })} style={{ fontFamily: "monospace", fontSize: "0.8rem" }} />
            </PropField>
          </>
        )}

        {type === "sendTaskNode" && (
          <>
            <PropField label="To (recipient)" hint="Email address or channel — supports {state[...]} placeholders">
              <input className="prop-input" value={data.to || ""} placeholder="user@example.com" onChange={(e) => updateNodeData(id, { to: e.target.value })} />
            </PropField>
            <PropField label="Subject">
              <input className="prop-input" value={data.subject || ""} placeholder="Workflow notification" onChange={(e) => updateNodeData(id, { subject: e.target.value })} />
            </PropField>
            <PropField label="Body" hint="Supports {state[...]} placeholders">
              <textarea className="prop-textarea" rows={5} value={data.body || ""} placeholder="Hi,&#10;&#10;Your workflow step has completed.&#10;&#10;Result: {state['agent_output']['summary']}" onChange={(e) => updateNodeData(id, { body: e.target.value })} />
            </PropField>
          </>
        )}
      </div>
    </div>
  );
}

function AnnotationPanel({ node }) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const { data, id } = node;

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">Annotation</div>
          <div className="prop-panel__subtitle">Text note</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={() => { deleteNode(id); clearSelection(); }}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Note Text">
          <textarea className="prop-textarea" rows={6} value={data.text || ""} placeholder="Add a note…" onChange={(e) => updateNodeData(id, { text: e.target.value })} />
        </PropField>
      </div>
    </div>
  );
}

function NodePanel({ node }) {
  const updateNodeData = useWorkflowStore((s) => s.updateNodeData);
  const updateNodeInput = useWorkflowStore((s) => s.updateNodeInput);
  const deleteNode = useWorkflowStore((s) => s.deleteNode);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);
  const [tab, setTab] = useState("inputs");

  const { type, data, id } = node;

  if (EVENT_TYPES.includes(type)) return <EventPanel node={node} />;
  if (GATEWAY_TYPES.includes(type)) return <GatewayPanel node={node} />;
  if (type === "mcpTaskNode") return <McpPanel node={node} />;
  if (TASK_TYPES.includes(type)) return <TaskPanel node={node} />;
  if (type === "annotationNode") return <AnnotationPanel node={node} />;

  // agentNode
  const handleInputChange = (fieldName, value) => updateNodeInput(id, fieldName, value);

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{data.label || "Node"}</div>
          <div className="prop-panel__subtitle">{data.agentName}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn--danger btn--xs" title="Delete node" onClick={() => { deleteNode(id); clearSelection(); }}>✕</button>
        </div>
      </div>

      <div className="prop-tabs">
        {["inputs", "general", "outputs"].map((t) => (
          <button key={t} className={`prop-tab ${tab === t ? "prop-tab--active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <div className="prop-panel__body">
        {tab === "general" && (
          <div className="prop-section">
            <div className="prop-field">
              <label className="prop-label">Display Label</label>
              <input className="prop-input" value={data.label || ""} onChange={(e) => updateNodeData(id, { label: e.target.value })} />
            </div>
            <div className="prop-field">
              <label className="prop-label">
                <input
                  type="checkbox"
                  checked={data.requires_approval || false}
                  onChange={(e) => updateNodeData(id, { requires_approval: e.target.checked })}
                  style={{ marginRight: 6 }}
                />
                Require Human Approval (HITL)
              </label>
              <span className="prop-hint">Workflow will pause after this agent runs and wait for approval</span>
            </div>
          </div>
        )}

        {tab === "inputs" && (
          <div className="prop-section">
            {(data.inputOrder || []).length === 0 && (
              <p className="prop-hint" style={{ color: "var(--text-muted)", textAlign: "center", padding: "1rem 0" }}>
                No inputs defined for this agent.
              </p>
            )}
            {(data.inputOrder || []).map((fieldName) => {
              const fieldMeta = (data.inputFormat || {})[fieldName];
              if (!fieldMeta) return null;
              return (
                <FieldInput
                  key={fieldName}
                  fieldName={fieldName}
                  fieldMeta={fieldMeta}
                  value={(data.inputs || {})[fieldName]}
                  allValues={data.inputs || {}}
                  onChangeValue={handleInputChange}
                />
              );
            })}
          </div>
        )}

        {tab === "outputs" && (
          <div className="prop-section">
            <p className="prop-hint" style={{ marginBottom: "0.75rem" }}>Available output fields from this agent:</p>
            {Object.entries(data.outputFormat || {}).map(([field, type]) => (
              <div key={field} className="output-field-row">
                <span className="output-field-name">{field}</span>
                <span className="output-field-type">{String(type).replace(/<class '(.+)'>/, "$1")}</span>
                <button
                  className="btn btn--ghost btn--xs"
                  title="Copy placeholder"
                  onClick={() => {
                    const placeholder = `{state['${data.agentName}_output']['${field}']}`;
                    navigator.clipboard.writeText(placeholder);
                  }}
                >
                  ⎘
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function EdgePanel({ edge }) {
  const updateEdgeData = useWorkflowStore((s) => s.updateEdgeData);
  const deleteEdge = useWorkflowStore((s) => s.deleteEdge);
  const clearSelection = useWorkflowStore((s) => s.clearSelection);

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">Connector</div>
          <div className="prop-panel__subtitle">{edge.source} → {edge.target}</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={() => { deleteEdge(edge.id); clearSelection(); }}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <div className="prop-field">
          <label className="prop-label">Edge Label</label>
          <input className="prop-input" value={edge.data?.label || ""} placeholder="e.g. On success" onChange={(e) => updateEdgeData(edge.id, { label: e.target.value })} />
        </div>
        <div className="prop-field">
          <label className="prop-label">Condition (for XOR gateways)</label>
          <input className="prop-input" value={edge.data?.condition || ""} placeholder="true | false" onChange={(e) => updateEdgeData(edge.id, { condition: e.target.value })} />
          <span className="prop-hint">Set to "true" or "false" for XOR gateway branches</span>
        </div>
      </div>
    </div>
  );
}

export default function PropertiesPanel() {
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const selectedEdgeId = useWorkflowStore((s) => s.selectedEdgeId);

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);
  const selectedEdge = edges.find((e) => e.id === selectedEdgeId);

  if (!selectedNode && !selectedEdge) {
    return (
      <div className="prop-panel prop-panel--empty">
        <div className="prop-panel__empty-state">
          <div className="prop-panel__empty-icon">⟡</div>
          <p>Select a node or connector to edit its properties</p>
        </div>
      </div>
    );
  }

  if (selectedNode) return <NodePanel node={selectedNode} />;
  if (selectedEdge) return <EdgePanel edge={selectedEdge} />;
  return null;
}

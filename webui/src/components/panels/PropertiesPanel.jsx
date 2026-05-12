import { Component, useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { useWorkflowStore } from "../../store/useWorkflowStore.js";

class PanelErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(err, info) { console.error("[PropertiesPanel]", err, info); }
  render() {
    if (this.state.error) {
      return (
        <div className="prop-panel">
          <div className="prop-panel__body prop-section" style={{ padding: "1rem" }}>
            <p style={{ color: "var(--error)", fontSize: "0.82rem", marginBottom: "0.75rem" }}>
              Panel error: {this.state.error.message}
            </p>
            <button className="btn btn--ghost btn--xs" onClick={() => this.setState({ error: null })}>
              Dismiss
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Helper: update bpmn-js element label ─────────────────────────────────────
function updateBpmnLabel(modeler, elementId, name) {
  try {
    const reg      = modeler.get("elementRegistry");
    const modeling = modeler.get("modeling");
    const el = reg.get(elementId);
    if (el) modeling.updateLabel(el, name);
  } catch (_) {}
}

// ── Helper: delete bpmn-js element ──────────────────────────────────────────
function deleteBpmnElement(modeler, elementId, clearSelection) {
  try {
    const reg      = modeler.get("elementRegistry");
    const modeling = modeler.get("modeling");
    const el = reg.get(elementId);
    if (el) modeling.removeElements([el]);
  } catch (_) {}
  clearSelection();
}

// ── Shared PropField shell ────────────────────────────────────────────────────
function PropField({ label, hint, children }) {
  return (
    <div className="prop-field">
      <label className="prop-label">{label}</label>
      {children}
      {hint && <span className="prop-hint">{hint}</span>}
    </div>
  );
}

// ── Output suggestions on focus ──────────────────────────────────────────────
function useOutputOptions() {
  const elementProps = useWorkflowStore((s) => s.elementProps);
  const options = [];
  Object.entries(elementProps).forEach(([, props]) => {
    const fmt       = props.outputFormat ?? {};
    const agentName = props.agentName;
    if (!agentName) return;
    Object.keys(fmt).forEach((field) => {
      options.push({
        label: agentName.replace(/_/g, " "),
        field,
        value: `{state['${agentName}_output']['${field}']}`,
      });
    });
  });
  return options;
}

function OutputSuggestions({ elRef, value, onChange, visible }) {
  const options = useOutputOptions();
  if (!visible || options.length === 0) return null;

  const insert = (text) => {
    const el = elRef.current;
    if (!el) { onChange((value ?? "") + text); return; }
    const s = el.selectionStart ?? (value ?? "").length;
    const e2 = el.selectionEnd ?? s;
    const next = (value ?? "").slice(0, s) + text + (value ?? "").slice(e2);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = s + text.length; });
  };

  return (
    <div className="field-suggestions">
      <div className="field-suggestions__header">Use output from</div>
      {options.map((o) => (
        <div key={o.value} className="field-suggestions__item"
          onMouseDown={(ev) => { ev.preventDefault(); insert(o.value); }}>
          <span className="field-suggestions__agent">{o.label}</span>
          <span className="field-suggestions__arrow">→</span>
          <span className="field-suggestions__field">{o.field}</span>
        </div>
      ))}
    </div>
  );
}

// ── Per-field input row (must be a component — useState cannot live in .map()) ─
function FieldInputRow({ fieldName, meta, value, onChange }) {
  const [focused, setFocused] = useState(false);
  const inputRef = useRef(null);

  if (!meta) return null;
  return (
    <div className="prop-field">
      <label className="prop-label">{fieldName.replace(/_/g, " ")}</label>
      <div style={{ position: "relative" }}>
        {meta.ui_type === "textarea" ? (
          <textarea ref={inputRef} className="prop-textarea" rows={4}
            value={value} placeholder={meta.description}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)} />
        ) : (
          <input ref={inputRef} className="prop-input" type="text"
            value={value} placeholder={meta.description}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 150)} />
        )}
        <OutputSuggestions elRef={inputRef} value={value} onChange={onChange} visible={focused} />
      </div>
      {meta.description && <span className="prop-hint">{meta.description}</span>}
    </div>
  );
}

// ── Agent node panel ──────────────────────────────────────────────────────────
function AgentPanel({ elementId }) {
  const modeler          = useWorkflowStore((s) => s.modeler);
  const props            = useWorkflowStore((s) => s.elementProps[elementId] ?? {});
  const updateProps      = useWorkflowStore((s) => s.updateElementProps);
  const deleteProps      = useWorkflowStore((s) => s.deleteElementProps);
  const setSelectedId    = useWorkflowStore((s) => s.setSelectedElementId);
  const [tab, setTab]    = useState("inputs");

  const patch = (p) => updateProps(elementId, p);

  const handleLabelChange = (val) => {
    patch({ label: val });
    updateBpmnLabel(modeler, elementId, val);
  };

  const handleDelete = () => {
    deleteProps(elementId);
    deleteBpmnElement(modeler, elementId, () => setSelectedId(null));
  };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{props.label || props.agentName}</div>
          <div className="prop-panel__subtitle">{props.agentName}</div>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button className="btn btn--danger btn--xs" onClick={handleDelete}>✕</button>
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
            <PropField label="Display Label">
              <input className="prop-input" value={props.label ?? ""} onChange={(e) => handleLabelChange(e.target.value)} />
            </PropField>
            <PropField label="">
              <label className="prop-label" style={{ cursor: "pointer" }}>
                <input type="checkbox" checked={props.requires_approval ?? false}
                  onChange={(e) => patch({ requires_approval: e.target.checked })}
                  style={{ marginRight: 6 }} />
                Require Human Approval (HITL)
              </label>
              <span className="prop-hint">Workflow pauses here and waits for approval</span>
            </PropField>
          </div>
        )}

        {tab === "inputs" && (
          <div className="prop-section">
            {(props.inputOrder ?? []).length === 0 && (
              <p className="prop-hint" style={{ textAlign: "center", padding: "1rem 0" }}>No inputs defined for this agent.</p>
            )}
            {(props.inputOrder ?? []).map((fieldName) => (
              <FieldInputRow
                key={fieldName}
                fieldName={fieldName}
                meta={(props.inputFormat ?? {})[fieldName]}
                value={(props.inputs ?? {})[fieldName] ?? ""}
                onChange={(v) => patch({ inputs: { ...(props.inputs ?? {}), [fieldName]: v } })}
              />
            ))}
          </div>
        )}

        {tab === "outputs" && (
          <div className="prop-section">
            <p className="prop-hint" style={{ marginBottom: "0.75rem" }}>Available output fields:</p>
            {Object.entries(props.outputFormat ?? {}).map(([field, type]) => (
              <div key={field} className="output-field-row">
                <span className="output-field-name">{field}</span>
                <span className="output-field-type">{String(type).replace(/<class '(.+)'>/, "$1")}</span>
                <button className="btn btn--ghost btn--xs" title="Copy placeholder"
                  onClick={() => navigator.clipboard.writeText(`{state['${props.agentName}_output']['${field}']}`)}>⎘</button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── MCP node panel ────────────────────────────────────────────────────────────
function McpPanel({ elementId }) {
  const modeler       = useWorkflowStore((s) => s.modeler);
  const props         = useWorkflowStore((s) => s.elementProps[elementId] ?? {});
  const updateProps   = useWorkflowStore((s) => s.updateElementProps);
  const deleteProps   = useWorkflowStore((s) => s.deleteElementProps);
  const setSelectedId = useWorkflowStore((s) => s.setSelectedElementId);

  const [servers, setServers]           = useState([]);
  const [fetchingTools, setFetchingTools] = useState(false);
  const [fetchedTools, setFetchedTools]   = useState([]);
  const [fetchError, setFetchError]       = useState("");

  useEffect(() => {
    api.getMcpServers().then((r) => setServers(r.servers ?? [])).catch(() => {});
  }, []);

  const patch = (p) => updateProps(elementId, p);

  const handleLabelChange = (val) => {
    patch({ label: val });
    updateBpmnLabel(modeler, elementId, val);
  };

  const handleDelete = () => {
    deleteProps(elementId);
    deleteBpmnElement(modeler, elementId, () => setSelectedId(null));
  };

  const fetchTools = async () => {
    if (!props.serverName) return;
    setFetchingTools(true); setFetchError(""); setFetchedTools([]);
    try {
      const res = await api.listMcpTools(props.serverName);
      if (res.error) setFetchError(res.error);
      else setFetchedTools(res.tools ?? []);
    } catch (e) { setFetchError(String(e)); }
    finally { setFetchingTools(false); }
  };

  const selectTool = (tool) => {
    const keys = Object.keys(tool.inputSchema?.properties ?? {});
    patch({
      toolName: tool.name,
      arguments: keys.length
        ? JSON.stringify(Object.fromEntries(keys.map((k) => [k, ""])), null, 2)
        : props.arguments ?? "",
    });
    setFetchedTools([]);
  };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{props.label || "MCP Client"}</div>
          <div className="prop-panel__subtitle">MCP Task</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={handleDelete}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Display Label">
          <input className="prop-input" value={props.label ?? ""} onChange={(e) => handleLabelChange(e.target.value)} />
        </PropField>
        <PropField label="MCP Server" hint="Servers from .vscode/mcp.json or mcp.json">
          <select className="prop-select" value={props.serverName ?? ""}
            onChange={(e) => patch({ serverName: e.target.value, toolName: "", arguments: "" })}>
            <option value="">— select server —</option>
            {servers.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </PropField>
        <PropField label="Tool Name">
          <div style={{ display: "flex", gap: 6 }}>
            <input className="prop-input" value={props.toolName ?? ""} placeholder="e.g. add, search"
              onChange={(e) => patch({ toolName: e.target.value })} style={{ flex: 1 }} />
            <button className="btn btn--ghost btn--xs" onClick={fetchTools}
              disabled={fetchingTools || !props.serverName}>{fetchingTools ? "…" : "⟳ Fetch"}</button>
          </div>
          {fetchError && <span style={{ color: "var(--error)", fontSize: "0.73rem", marginTop: 4, display: "block" }}>{fetchError}</span>}
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
        <PropField label="Arguments (JSON)" hint="Supports {state['...']} placeholders">
          <textarea className="prop-textarea" rows={4} value={props.arguments ?? ""}
            placeholder={'{"a": "10", "b": "5"}'}
            onChange={(e) => patch({ arguments: e.target.value })}
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }} />
        </PropField>
        <PropField label="Output Key" hint="State key for the tool result">
          <input className="prop-input" value={props.outputKey ?? ""}
            placeholder="mcp_result" onChange={(e) => patch({ outputKey: e.target.value })} />
        </PropField>
      </div>
    </div>
  );
}

// ── Timer event panel ─────────────────────────────────────────────────────────
function TimerPanel({ elementId }) {
  const modeler       = useWorkflowStore((s) => s.modeler);
  const props         = useWorkflowStore((s) => s.elementProps[elementId] ?? {});
  const updateProps   = useWorkflowStore((s) => s.updateElementProps);
  const deleteProps   = useWorkflowStore((s) => s.deleteElementProps);
  const setSelectedId = useWorkflowStore((s) => s.setSelectedElementId);

  const patch = (p) => updateProps(elementId, p);
  const handleLabelChange = (val) => { patch({ label: val }); updateBpmnLabel(modeler, elementId, val); };
  const handleDelete = () => { deleteProps(elementId); deleteBpmnElement(modeler, elementId, () => setSelectedId(null)); };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{props.label || "Timer Event"}</div>
          <div className="prop-panel__subtitle">Timer Event</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={handleDelete}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Display Label">
          <input className="prop-input" value={props.label ?? ""} onChange={(e) => handleLabelChange(e.target.value)} />
        </PropField>
        <PropField label="Timer Type" hint="duration = fixed delay">
          <select className="prop-select" value={props.timerType ?? "duration"}
            onChange={(e) => patch({ timerType: e.target.value })}>
            <option value="duration">Duration</option>
            <option value="cycle">Cycle</option>
            <option value="date">Date</option>
          </select>
        </PropField>
        <PropField label="Timer Value" hint="Seconds (e.g. 30) or ISO 8601">
          <input className="prop-input" value={props.timerValue ?? ""} placeholder="e.g. 30"
            onChange={(e) => patch({ timerValue: e.target.value })} />
        </PropField>
      </div>
    </div>
  );
}

// ── Gateway (XOR) panel ───────────────────────────────────────────────────────
function GatewayPanel({ elementId }) {
  const modeler       = useWorkflowStore((s) => s.modeler);
  const props         = useWorkflowStore((s) => s.elementProps[elementId] ?? {});
  const updateProps   = useWorkflowStore((s) => s.updateElementProps);
  const deleteProps   = useWorkflowStore((s) => s.deleteElementProps);
  const setSelectedId = useWorkflowStore((s) => s.setSelectedElementId);

  const patch = (p) => updateProps(elementId, p);
  const handleLabelChange = (val) => { patch({ label: val }); updateBpmnLabel(modeler, elementId, val); };
  const handleDelete = () => { deleteProps(elementId); deleteBpmnElement(modeler, elementId, () => setSelectedId(null)); };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{props.label || "XOR Gateway"}</div>
          <div className="prop-panel__subtitle">Exclusive Gateway</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={handleDelete}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Display Label">
          <input className="prop-input" value={props.label ?? ""} onChange={(e) => handleLabelChange(e.target.value)} />
        </PropField>
        <PropField label="Condition" hint="True → Yes path  |  False → No path">
          <input className="prop-input" value={props.condition ?? ""}
            placeholder="e.g. state['addition_agent_output']['result'] > 100"
            onChange={(e) => patch({ condition: e.target.value })} />
        </PropField>
      </div>
    </div>
  );
}

// ── Generic element panel (service task, script task, annotations, etc.) ──────
function GenericPanel({ elementId }) {
  const modeler       = useWorkflowStore((s) => s.modeler);
  const props         = useWorkflowStore((s) => s.elementProps[elementId] ?? {});
  const updateProps   = useWorkflowStore((s) => s.updateElementProps);
  const deleteProps   = useWorkflowStore((s) => s.deleteElementProps);
  const setSelectedId = useWorkflowStore((s) => s.setSelectedElementId);

  const patch = (p) => updateProps(elementId, p);
  const handleLabelChange = (val) => { patch({ label: val }); updateBpmnLabel(modeler, elementId, val); };
  const handleDelete = () => { deleteProps(elementId); deleteBpmnElement(modeler, elementId, () => setSelectedId(null)); };

  const aft = props.agentForgeType;
  const title = aft === "service" ? "Service Task"
              : aft === "script"  ? "Script Task"
              : aft === "annotation" ? "Annotation"
              : aft === "message" ? "Message Event"
              : "Element";

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">{props.label || title}</div>
          <div className="prop-panel__subtitle">{title}</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={handleDelete}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        {aft === "annotation" ? (
          <PropField label="Note Text">
            <textarea className="prop-textarea" rows={6} value={props.text ?? ""}
              placeholder="Add a note…" onChange={(e) => patch({ text: e.target.value })} />
          </PropField>
        ) : (
          <>
            <PropField label="Display Label">
              <input className="prop-input" value={props.label ?? ""} onChange={(e) => handleLabelChange(e.target.value)} />
            </PropField>
            {aft === "service" && (
              <>
                <PropField label="HTTP Method">
                  <select className="prop-select" value={props.method ?? "GET"}
                    onChange={(e) => patch({ method: e.target.value })}>
                    {["GET","POST","PUT","PATCH","DELETE"].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </PropField>
                <PropField label="URL">
                  <input className="prop-input" value={props.url ?? ""} placeholder="https://..."
                    onChange={(e) => patch({ url: e.target.value })} />
                </PropField>
              </>
            )}
            {aft === "script" && (
              <>
                <PropField label="Language">
                  <select className="prop-select" value={props.language ?? "python"}
                    onChange={(e) => patch({ language: e.target.value })}>
                    {["python","javascript","bash","groovy"].map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </PropField>
                <PropField label="Script">
                  <textarea className="prop-textarea" rows={8} value={props.script ?? ""}
                    onChange={(e) => patch({ script: e.target.value })}
                    style={{ fontFamily: "monospace", fontSize: "0.8rem" }} />
                </PropField>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Connection (sequence flow) panel ─────────────────────────────────────────
function ConnectionPanel({ elementId }) {
  const modeler       = useWorkflowStore((s) => s.modeler);
  const setSelectedId = useWorkflowStore((s) => s.setSelectedElementId);

  const [label, setLabel]       = useState("");
  const [condition, setCondition] = useState("");

  useEffect(() => {
    if (!modeler) return;
    try {
      const el = modeler.get("elementRegistry").get(elementId);
      const bo = el?.businessObject;
      setLabel(bo?.name ?? "");
      setCondition(bo?.conditionExpression?.body ?? "");
    } catch (_) {}
  }, [elementId, modeler]);

  const handleLabelChange = (val) => {
    setLabel(val);
    updateBpmnLabel(modeler, elementId, val);
  };

  const handleConditionChange = (val) => {
    setCondition(val);
    try {
      const reg      = modeler.get("elementRegistry");
      const modeling = modeler.get("modeling");
      const bpmnFact = modeler.get("bpmnFactory");
      const el = reg.get(elementId);
      if (!el) return;
      const expr = bpmnFact.create("bpmn:FormalExpression", { body: val });
      modeling.updateProperties(el, { conditionExpression: expr });
    } catch (_) {}
  };

  const handleDelete = () => {
    try {
      const reg      = modeler.get("elementRegistry");
      const modeling = modeler.get("modeling");
      const el = reg.get(elementId);
      if (el) modeling.removeElements([el]);
    } catch (_) {}
    setSelectedId(null);
  };

  return (
    <div className="prop-panel">
      <div className="prop-panel__header">
        <div>
          <div className="prop-panel__title">Sequence Flow</div>
          <div className="prop-panel__subtitle">Connection</div>
        </div>
        <button className="btn btn--danger btn--xs" onClick={handleDelete}>✕</button>
      </div>
      <div className="prop-panel__body prop-section">
        <PropField label="Label">
          <input className="prop-input" value={label} placeholder="e.g. On success"
            onChange={(e) => handleLabelChange(e.target.value)} />
        </PropField>
        <PropField label="Condition" hint="For XOR gateways — e.g. true or false">
          <input className="prop-input" value={condition} placeholder="true | false"
            onChange={(e) => handleConditionChange(e.target.value)} />
        </PropField>
      </div>
    </div>
  );
}

// ── Root (wrapped in error boundary) ─────────────────────────────────────────
function PropertiesPanelInner() {
  const modeler           = useWorkflowStore((s) => s.modeler);
  const selectedElementId = useWorkflowStore((s) => s.selectedElementId);
  const elementProps      = useWorkflowStore((s) => s.elementProps);

  if (!selectedElementId) {
    return (
      <div className="prop-panel prop-panel--empty">
        <div className="prop-panel__empty-state">
          <div className="prop-panel__empty-icon">⟡</div>
          <p>Select an element to edit its properties</p>
        </div>
      </div>
    );
  }

  // Get element type from bpmn-js
  let bpmnType = null;
  try {
    const el = modeler?.get("elementRegistry").get(selectedElementId);
    bpmnType = el?.type ?? null;
  } catch (_) {}

  const props = elementProps[selectedElementId] ?? {};
  const aft   = props.agentForgeType;

  if (bpmnType === "bpmn:SequenceFlow") return <ConnectionPanel elementId={selectedElementId} />;
  if (aft === "agent")   return <AgentPanel   elementId={selectedElementId} />;
  if (aft === "mcp")     return <McpPanel     elementId={selectedElementId} />;
  if (aft === "timer")   return <TimerPanel   elementId={selectedElementId} />;
  if (aft === "decision") return <GatewayPanel elementId={selectedElementId} />;
  return <GenericPanel elementId={selectedElementId} />;
}

export default function PropertiesPanel() {
  return (
    <PanelErrorBoundary>
      <PropertiesPanelInner />
    </PanelErrorBoundary>
  );
}

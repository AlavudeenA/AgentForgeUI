import { useState } from "react";
import { api } from "../api/client.js";
import { useWorkflowStore } from "../store/useWorkflowStore.js";
import { SIDEBAR_GROUPS } from "../config/nodeRegistryData.js";

// ── Agent card — drag onto canvas to create a ServiceTask ───────────────────
function AgentCard({ agent, modeler, setPendingCreate }) {
  const handleMouseDown = (e) => {
    if (!modeler) return;
    e.preventDefault();

    const create         = modeler.get("create");
    const elementFactory = modeler.get("elementFactory");
    const bpmnFactory    = modeler.get("bpmnFactory");

    const bo = bpmnFactory.create("bpmn:ServiceTask", {
      name: agent.name.replace(/_/g, " "),
    });
    const shape = elementFactory.createShape({ type: "bpmn:ServiceTask", businessObject: bo });

    setPendingCreate({
      agentForgeType:  "agent",
      agentName:       agent.name,
      label:           agent.name.replace(/_/g, " "),
      description:     agent.description,
      inputFormat:     agent.input_format,
      inputOrder:      agent.input_order,
      outputFormat:    agent.output_format,
      inputs:          Object.fromEntries(
        (agent.input_order ?? []).map((k) => [k, agent.input_format?.[k]?.default ?? ""])
      ),
      requires_approval: false,
    });

    create.start(e.nativeEvent, shape);
  };

  return (
    <div className="agent-card" onMouseDown={handleMouseDown} title={agent.description}>
      <div className="agent-card__info">
        <div className="agent-card__name">{agent.name.replace(/_/g, " ")}</div>
        <div className="agent-card__desc">{agent.description}</div>
      </div>
    </div>
  );
}

// ── Workflow shape button — drag to create a BPMN element ───────────────────
function ShapeButton({ entry, modeler, setPendingCreate }) {
  const handleMouseDown = (e) => {
    if (!modeler) return;
    e.preventDefault();

    const create         = modeler.get("create");
    const elementFactory = modeler.get("elementFactory");
    const bpmnFactory    = modeler.get("bpmnFactory");

    let businessObject;
    const { shapeKey, bpmnType, label, defaultProps } = entry;

    if (shapeKey === "timerEvent") {
      const timerDef = bpmnFactory.create("bpmn:TimerEventDefinition");
      businessObject = bpmnFactory.create("bpmn:IntermediateCatchEvent", {
        name: label, eventDefinitions: [timerDef],
      });
    } else if (shapeKey === "messageEvent") {
      const msgDef = bpmnFactory.create("bpmn:MessageEventDefinition");
      businessObject = bpmnFactory.create("bpmn:IntermediateCatchEvent", {
        name: label, eventDefinitions: [msgDef],
      });
    } else if (shapeKey === "annotation") {
      businessObject = bpmnFactory.create("bpmn:TextAnnotation", { text: "Add a note…" });
    } else {
      businessObject = bpmnFactory.create(bpmnType, { name: label });
    }

    const shapeOpts = { type: bpmnType, businessObject };
    if (shapeKey === "annotation") {
      shapeOpts.width  = 150;
      shapeOpts.height = 60;
    }

    setPendingCreate({ ...defaultProps });
    create.start(e.nativeEvent, elementFactory.createShape(shapeOpts));
  };

  return (
    <button className="shape-btn" onMouseDown={handleMouseDown} title={entry.title}>
      <span className="shape-btn__icon">{entry.icon}</span>
      <span>{entry.label}</span>
    </button>
  );
}

// ── Main sidebar ─────────────────────────────────────────────────────────────
export default function AgentSidebar() {
  const agents          = useWorkflowStore((s) => s.agents);
  const setAgents       = useWorkflowStore((s) => s.setAgents);
  const modeler         = useWorkflowStore((s) => s.modeler);
  const setPendingCreate = useWorkflowStore((s) => s.setPendingCreate);

  const [search, setSearch]           = useState("");
  const [refreshing, setRefreshing]   = useState(false);
  const [elementsOpen, setElementsOpen] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshAgentsMetadata();
      setAgents(await api.getAgents());
    } catch (e) {
      console.error("Failed to refresh agents:", e);
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = agents.filter(
    (a) =>
      a.name.toLowerCase().includes(search.toLowerCase()) ||
      (a.description ?? "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <aside className="agent-sidebar">
      <div className="agent-sidebar__header">
        <span className="agent-sidebar__title">Agents</span>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <span className="agent-sidebar__count">{agents.length}</span>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            title="Reload agents from server"
            style={{
              background: "none", border: "none",
              cursor: refreshing ? "not-allowed" : "pointer",
              color: "var(--text-muted)", fontSize: "0.85rem",
              padding: "2px 4px", borderRadius: "4px", lineHeight: 1,
              opacity: refreshing ? 0.5 : 1,
            }}
          >
            {refreshing ? "…" : "↻"}
          </button>
        </div>
      </div>

      <div className="agent-sidebar__search">
        <input
          className="agent-sidebar__search-input"
          type="text"
          placeholder="Search agents…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="agent-sidebar__hint">Drag an agent onto the canvas</div>

      <div className="agent-sidebar__list">
        {filtered.map((a) => (
          <AgentCard
            key={a.name}
            agent={a}
            modeler={modeler}
            setPendingCreate={setPendingCreate}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ color: "var(--text-muted)", padding: "1rem", textAlign: "center", fontSize: "0.8rem" }}>
            No agents found
          </div>
        )}
      </div>

      <button
        className="agent-sidebar__elements-toggle"
        onClick={() => setElementsOpen((o) => !o)}
      >
        <span>Workflow Elements</span>
        <span className={`agent-sidebar__elements-chevron${elementsOpen ? " open" : ""}`}>›</span>
      </button>

      {elementsOpen && (
        <div className="agent-sidebar__shapes">
          {Object.entries(SIDEBAR_GROUPS).map(([group, entries]) => (
            <div key={group}>
              <div className="bpmn-group-label">{group}</div>
              <div className="bpmn-shape-grid">
                {entries.map((entry) => (
                  <ShapeButton
                    key={entry.shapeKey}
                    entry={entry}
                    modeler={modeler}
                    setPendingCreate={setPendingCreate}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </aside>
  );
}

import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";
import { useWorkflowStore } from "../../store/useWorkflowStore.js";

const STATUS_META = {
  "not-started":     { icon: "○", cls: "status--pending",  label: "Pending" },
  "in-progress":     { icon: "⟳", cls: "status--running",  label: "Running" },
  completed:         { icon: "✓", cls: "status--success",  label: "Done" },
  approved:          { icon: "✓", cls: "status--success",  label: "Approved" },
  "pending-approval":{ icon: "⏸", cls: "status--hitl",    label: "Awaiting Approval" },
  rejected:          { icon: "✗", cls: "status--rejected", label: "Rejected" },
  error:             { icon: "⚠", cls: "status--error",    label: "Error" },
};

function AgentStatusRow({ nodeId, agentName, status, output, error, runId }) {
  const [expanded, setExpanded] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectFeedback, setRejectFeedback] = useState("");
  const [actioning, setActioning] = useState(false);

  const meta = STATUS_META[status] || STATUS_META["not-started"];
  const isHITL = status === "pending-approval";

  const doApprove = async () => {
    setActioning(true);
    await api.approveNode(runId, nodeId);
    setActioning(false);
  };

  const doReject = async () => {
    setActioning(true);
    await api.rejectNode(runId, nodeId, rejectFeedback);
    setActioning(false);
    setRejecting(false);
  };

  return (
    <div className={`run-row ${meta.cls}`}>
      <div className="run-row__header" onClick={() => setExpanded((e) => !e)}>
        <span className={`run-row__icon ${meta.cls}`}>{meta.icon}</span>
        <div className="run-row__info">
          <span className="run-row__name">{agentName}</span>
          <span className={`run-row__status ${meta.cls}`}>{meta.label}</span>
        </div>
        {(output || error) && (
          <button className="btn btn--ghost btn--xs">{expanded ? "▲" : "▼"}</button>
        )}
      </div>

      {isHITL && (
        <div className="run-row__hitl">
          <p className="run-row__hitl-msg">⏸ Agent paused — review output and approve or reject</p>
          <div className="run-row__hitl-actions">
            <button className="btn btn--success" onClick={doApprove} disabled={actioning}>
              ✓ Approve
            </button>
            <button className="btn btn--danger" onClick={() => setRejecting((r) => !r)}>
              ✗ Reject
            </button>
          </div>
          {rejecting && (
            <div className="run-row__reject-form">
              <textarea
                className="prop-textarea"
                rows={3}
                placeholder="Reason for rejection / feedback for the agent…"
                value={rejectFeedback}
                onChange={(e) => setRejectFeedback(e.target.value)}
              />
              <button className="btn btn--danger" onClick={doReject} disabled={actioning}>
                Confirm Rejection
              </button>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="run-row__body">
          {error && <pre className="run-row__error">{error}</pre>}
          {output && (
            <pre className="run-row__output">{JSON.stringify(output, null, 2)}</pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunStatusOverlay() {
  const activeRunId = useWorkflowStore((s) => s.activeRunId);
  const runStatus = useWorkflowStore((s) => s.runStatus);
  const runOutputs = useWorkflowStore((s) => s.runOutputs);
  const runCompleted = useWorkflowStore((s) => s.runCompleted);
  const runError = useWorkflowStore((s) => s.runError);
  const clearRun = useWorkflowStore((s) => s.clearRun);
  const nodes = useWorkflowStore((s) => s.nodes);

  // Drag state
  const [pos, setPos] = useState(null); // null = default CSS position
  const drag = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 });
  const overlayRef = useRef(null);

  const onMouseDown = (e) => {
    // Only drag on left button; ignore clicks on buttons inside header
    if (e.button !== 0 || e.target.closest("button")) return;
    e.preventDefault();

    const rect = overlayRef.current.getBoundingClientRect();
    drag.current = {
      active: true,
      startX: e.clientX,
      startY: e.clientY,
      originX: rect.left,
      originY: rect.top,
    };
  };

  useEffect(() => {
    const onMove = (e) => {
      if (!drag.current.active) return;
      const dx = e.clientX - drag.current.startX;
      const dy = e.clientY - drag.current.startY;
      setPos({ x: drag.current.originX + dx, y: drag.current.originY + dy });
    };
    const onUp = () => { drag.current.active = false; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, []);

  // Reset position when a new run starts
  useEffect(() => {
    if (activeRunId) setPos(null);
  }, [activeRunId]);

  if (!activeRunId) return null;

  const EXEC_TYPES = new Set(["agentNode", "timerEventNode", "decisionNode", "mcpTaskNode"]);
  const execNodes = nodes.filter((n) => EXEC_TYPES.has(n.type));

  const displayNode = execNodes.find((n) => n.data?.agentName === "display_output_agent");
  const displayOutput = displayNode ? runOutputs[displayNode.id] : null;
  const showFinalResult = runCompleted && displayOutput?.result !== undefined;

  const nodeLabel = (n) => {
    if (n.type === "timerEventNode") return `⏱ ${n.data?.label || "Timer"} (${n.data?.timerValue || ""}s)`;
    if (n.type === "decisionNode") return `◆ ${n.data?.label || "Decision"}`;
    if (n.type === "mcpTaskNode") return `🔌 ${n.data?.label || "MCP"} (${n.data?.toolName || ""})`;
    return n.data?.agentName || n.id;
  };

  const posStyle = pos
    ? { position: "fixed", left: pos.x, top: pos.y, bottom: "auto", right: "auto" }
    : {};

  return (
    <div className="run-overlay" ref={overlayRef} style={posStyle}>
      <div
        className="run-overlay__header"
        onMouseDown={onMouseDown}
        style={{ cursor: "grab", userSelect: "none" }}
      >
        <span className="run-overlay__title">
          {runCompleted ? "✓ Workflow complete" : runError ? "⚠ Workflow error" : "⟳ Running workflow…"}
        </span>
        <div style={{ display: "flex", gap: 8 }}>
          {(runCompleted || runError) && (
            <button className="btn btn--ghost btn--xs" onClick={clearRun}>✕ Dismiss</button>
          )}
        </div>
      </div>

      {runError && <div className="run-overlay__error">{runError}</div>}

      {showFinalResult && (
        <div style={{
          margin: "0.75rem 0.75rem 0",
          padding: "0.875rem 1rem",
          background: "rgba(16,185,129,0.08)",
          border: "1px solid rgba(16,185,129,0.35)",
          borderRadius: "8px",
        }}>
          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#059669", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "0.4rem" }}>
            Final Output
          </div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--text-primary)", wordBreak: "break-all" }}>
            {displayOutput.result}
          </div>
        </div>
      )}

      <div className="run-overlay__rows">
        {execNodes.map((n) => {
          const status = runStatus[n.id] || "not-started";
          const output = runOutputs[n.id];
          return (
            <AgentStatusRow
              key={n.id}
              nodeId={n.id}
              agentName={nodeLabel(n)}
              status={status}
              output={output}
              error={null}
              runId={activeRunId}
            />
          );
        })}
      </div>
    </div>
  );
}

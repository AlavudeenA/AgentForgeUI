import { useState } from "react";
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

  if (!activeRunId) return null;

  const agentNodes = nodes.filter((n) => n.type === "agentNode");

  return (
    <div className="run-overlay">
      <div className="run-overlay__header">
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

      <div className="run-overlay__rows">
        {agentNodes.map((n) => {
          const nodeId = n.id;
          const status = runStatus[nodeId] || "not-started";
          const output = runOutputs[nodeId];
          return (
            <AgentStatusRow
              key={nodeId}
              nodeId={nodeId}
              agentName={n.data?.agentName || nodeId}
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

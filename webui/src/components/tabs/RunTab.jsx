import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client.js";

const STATUS_META = {
  "not-started":     { icon: "○", cls: "status--pending",  label: "Pending" },
  "in-progress":     { icon: "⟳", cls: "status--running",  label: "Running" },
  completed:         { icon: "✓", cls: "status--success",  label: "Done" },
  approved:          { icon: "✓", cls: "status--success",  label: "Approved" },
  "pending-approval":{ icon: "⏸", cls: "status--hitl",    label: "Awaiting Approval" },
  rejected:          { icon: "✗", cls: "status--rejected", label: "Rejected" },
  error:             { icon: "⚠", cls: "status--error",    label: "Error" },
};

function AgentRow({ node, runId }) {
  const [expanded, setExpanded] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);

  const { nodeId, agentName, status, output, error } = node;
  const meta = STATUS_META[status] || STATUS_META["not-started"];
  const isHITL = status === "pending-approval";

  const approve = async () => { setBusy(true); await api.approveNode(runId, nodeId); setBusy(false); };
  const reject  = async () => { setBusy(true); await api.rejectNode(runId, nodeId, feedback); setBusy(false); setRejectOpen(false); };

  return (
    <div className={`run-row ${meta.cls}`}>
      <div className="run-row__header" onClick={() => (output || error) && setExpanded((e) => !e)}>
        <span className={`run-row__icon ${meta.cls}`}>{meta.icon}</span>
        <div className="run-row__info">
          <span className="run-row__name">{agentName}</span>
          <span className={`run-row__status ${meta.cls}`}>{meta.label}</span>
        </div>
        {(output || error) && (
          <button className="btn btn--ghost btn--xs" style={{ pointerEvents: "none" }}>{expanded ? "▲" : "▼"}</button>
        )}
      </div>

      {isHITL && (
        <div className="run-row__hitl">
          <p className="run-row__hitl-msg">Agent output is ready — approve to continue or reject</p>
          <div className="run-row__hitl-actions">
            <button className="btn btn--success" onClick={approve} disabled={busy}>✓ Approve</button>
            <button className="btn btn--danger" onClick={() => setRejectOpen((o) => !o)}>✗ Reject</button>
          </div>
          {rejectOpen && (
            <div className="run-row__reject-form">
              <textarea className="prop-textarea" rows={3} placeholder="Rejection reason / feedback…" value={feedback} onChange={(e) => setFeedback(e.target.value)} />
              <button className="btn btn--danger" onClick={reject} disabled={busy}>Confirm</button>
            </div>
          )}
        </div>
      )}

      {expanded && (
        <div className="run-row__body">
          {error && <pre className="run-row__error">{error}</pre>}
          {output && <pre className="run-row__output">{JSON.stringify(output, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}

export default function RunTab() {
  const [workflows, setWorkflows] = useState([]);
  const [selected, setSelected] = useState("");
  const [workflowData, setWorkflowData] = useState(null);
  const [running, setRunning] = useState(false);
  const [runId, setRunId] = useState(null);
  const [agentRows, setAgentRows] = useState([]);
  const [completed, setCompleted] = useState(false);
  const [runError, setRunError] = useState(null);
  const pollRef = useRef(null);

  useEffect(() => {
    api.listWorkflows().then(setWorkflows).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selected) { setWorkflowData(null); return; }
    api.getWorkflow(selected).then(setWorkflowData).catch(() => {});
  }, [selected]);

  const startRun = async () => {
    if (!workflowData) return;
    const agents = workflowData.agents || buildAgentsFromNodes(workflowData.nodes, workflowData.edges);
    if (!agents?.length) return alert("No agents found in this workflow.");

    setRunning(true);
    setCompleted(false);
    setRunError(null);
    setAgentRows([]);

    const { run_id } = await api.runWorkflow(agents);
    setRunId(run_id);

    pollRef.current = setInterval(async () => {
      try {
        const st = await api.getRunStatus(run_id);
        const rows = (st.agents || []).map((a) => ({
          nodeId: a.node_id,
          agentName: a.agent_name,
          status: (st.agent_status || {})[a.node_id] || "not-started",
          output: a.output,
          error: a.error,
        }));
        setAgentRows(rows);
        if (st.completed || st.error) {
          clearInterval(pollRef.current);
          setRunning(false);
          setCompleted(st.completed);
          setRunError(st.error);
        }
      } catch {
        clearInterval(pollRef.current);
        setRunning(false);
      }
    }, 1500);
  };

  const resetRun = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setRunId(null);
    setAgentRows([]);
    setRunning(false);
    setCompleted(false);
    setRunError(null);
  };

  return (
    <div className="run-tab">
      <div className="run-tab__controls">
        <h2 className="run-tab__heading">Run Workflow</h2>
        <div className="run-tab__selector-row">
          <select className="prop-select" value={selected} onChange={(e) => { setSelected(e.target.value); resetRun(); }} style={{ flex: 1 }}>
            <option value="">— Select a workflow —</option>
            {workflows.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <button
            className="btn btn--success"
            onClick={startRun}
            disabled={!selected || running}
            style={{ whiteSpace: "nowrap" }}
          >
            {running ? "⟳ Running…" : "▶ Run Workflow"}
          </button>
          {runId && (
            <button className="btn btn--ghost" onClick={resetRun}>✕ Reset</button>
          )}
        </div>

        {workflowData && !runId && (
          <div className="run-tab__preview">
            <h4>Agents in this workflow:</h4>
            {(workflowData.agents || buildAgentsFromNodes(workflowData.nodes, workflowData.edges) || []).map((a, i) => (
              <div key={i} className="run-tab__agent-preview">
                <span className="run-tab__agent-num">{i + 1}</span>
                <span>{a.agent_name}</span>
                {a.requires_approval && <span className="agent-node__badge">HITL</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {runId && (
        <div className="run-tab__status">
          <div className="run-overlay__header">
            <span>
              {completed ? "✓ Completed" : runError ? "⚠ Error" : "⟳ Running…"}
            </span>
            <span style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>run: {runId.slice(0, 8)}</span>
          </div>
          {runError && <div className="run-overlay__error">{runError}</div>}
          {agentRows.map((row) => (
            <AgentRow key={row.nodeId} node={row} runId={runId} />
          ))}
        </div>
      )}
    </div>
  );
}

function buildAgentsFromNodes(nodes = [], edges = []) {
  if (!nodes.length) return [];
  const agentNodes = nodes.filter((n) => n.type === "agentNode");
  return agentNodes.map((n) => ({
    agent_name: n.data?.agentName,
    node_id: n.id,
    inputs: n.data?.inputs || {},
    requires_approval: n.data?.requires_approval || false,
  }));
}

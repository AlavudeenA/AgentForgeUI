import { useState } from "react";
import { api } from "../api/client.js";
import { useWorkflowStore } from "../store/useWorkflowStore.js";

export default function Toolbar({ onShowLogs }) {
  const workflowName = useWorkflowStore((s) => s.workflowName);
  const setWorkflowName = useWorkflowStore((s) => s.setWorkflowName);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const clearCanvas = useWorkflowStore((s) => s.clearCanvas);
  const loadWorkflowToCanvas = useWorkflowStore((s) => s.loadWorkflowToCanvas);
  const buildAgentsPayload = useWorkflowStore((s) => s.buildAgentsPayload);
  const setActiveRun = useWorkflowStore((s) => s.setActiveRun);
  const updateRunStatus = useWorkflowStore((s) => s.updateRunStatus);

  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const [loadOpen, setLoadOpen] = useState(false);
  const [workflows, setWorkflows] = useState([]);

  const handleSave = async () => {
    if (!workflowName.trim()) return;
    setSaving(true);
    try {
      await api.saveWorkflow(workflowName, { name: workflowName, nodes, edges });
      setSavedMsg("Saved!");
      setTimeout(() => setSavedMsg(""), 2000);
    } catch (e) {
      setSavedMsg("Error saving");
    } finally {
      setSaving(false);
    }
  };

  const handleLoad = async () => {
    const list = await api.listWorkflows();
    setWorkflows(list);
    setLoadOpen(true);
  };

  const loadSelected = async (name) => {
    const wf = await api.getWorkflow(name);
    loadWorkflowToCanvas(wf);
    setLoadOpen(false);
  };

  const handleRun = async () => {
    const agents = buildAgentsPayload();
    if (!agents.length) return alert("Add at least one agent to run.");
    setRunning(true);
    try {
      const { run_id } = await api.runWorkflow(agents);
      setActiveRun(run_id);

      const poll = setInterval(async () => {
        try {
          const status = await api.getRunStatus(run_id);
          updateRunStatus(status.agent_status, status.agents, status.completed, status.error);
          if (status.completed || status.error) {
            clearInterval(poll);
            setRunning(false);
          }
        } catch {
          clearInterval(poll);
          setRunning(false);
        }
      }, 1500);
    } catch (e) {
      alert("Failed to start workflow: " + e.message);
      setRunning(false);
    }
  };

  return (
    <>
      <div className="toolbar">
        <div className="toolbar__brand">
          <span className="toolbar__logo">⚒</span>
          <span className="toolbar__name">Agentic Forge</span>
        </div>

        <div className="toolbar__workflow-name">
          <input
            className="toolbar__name-input"
            value={workflowName}
            onChange={(e) => setWorkflowName(e.target.value)}
            placeholder="workflow-name"
          />
        </div>

        <div className="toolbar__actions">
          <button className="btn btn--ghost" onClick={handleLoad}>⬆ Load</button>
          <button className="btn btn--primary" onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "💾 Save"}
          </button>
          {savedMsg && <span className="toolbar__saved-msg">{savedMsg}</span>}
          <div className="toolbar__divider" />
          <button className="btn btn--success" onClick={handleRun} disabled={running || nodes.length === 0}>
            {running ? "⟳ Running…" : "▶ Run"}
          </button>
          <button className="btn btn--ghost" onClick={clearCanvas} title="Clear canvas">✕ Clear</button>
          <button className="btn btn--ghost" onClick={onShowLogs} title="View logs">📋 Logs</button>
        </div>
      </div>

      {/* Load modal */}
      {loadOpen && (
        <div className="modal-overlay" onClick={() => setLoadOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal__header">
              <span>Load Workflow</span>
              <button className="btn btn--ghost btn--xs" onClick={() => setLoadOpen(false)}>✕</button>
            </div>
            <div className="modal__body">
              {workflows.length === 0 && <p style={{ color: "var(--text-muted)" }}>No saved workflows yet.</p>}
              {workflows.map((name) => (
                <div key={name} className="workflow-list-item" onClick={() => loadSelected(name)}>
                  <span>📄 {name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}

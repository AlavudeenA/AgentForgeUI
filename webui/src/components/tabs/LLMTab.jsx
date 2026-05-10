import { useState } from "react";
import { api } from "../../api/client.js";
import { useWorkflowStore } from "../../store/useWorkflowStore.js";

export default function LLMTab({ onSwitchToCreate }) {
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState("");
  const loadWorkflowToCanvas = useWorkflowStore((s) => s.loadWorkflowToCanvas);

  const generate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    setError("");
    setResult(null);
    try {
      const data = await api.generateViaLLM(prompt);
      setResult(data.workflow_json);
      setSaveName(data.workflow_json?.name || "llm-workflow");
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const saveWorkflow = async () => {
    if (!result || !saveName.trim()) return;
    setSaving(true);
    try {
      await api.saveWorkflow(saveName, { ...result, name: saveName });
      setSavedMsg("Saved!");
      setTimeout(() => setSavedMsg(""), 2500);
    } catch (e) {
      setSavedMsg("Error: " + e.message);
    } finally {
      setSaving(false);
    }
  };

  const loadToCanvas = () => {
    if (!result) return;
    loadWorkflowToCanvas({
      name: saveName || result.name || "llm-workflow",
      nodes: result.nodes || [],
      edges: result.edges || [],
    });
    onSwitchToCreate?.();
  };

  const refreshMeta = async () => {
    await api.refreshAgentsMetadata();
    alert("Agent metadata refreshed — LLM context updated.");
  };

  return (
    <div className="llm-tab">
      <div className="llm-tab__left">
        <div className="llm-tab__header">
          <h2>🤖 LLM Workflow Generator</h2>
          <p>Describe what you want to automate in plain English and let the LLM generate a workflow JSON for you.</p>
        </div>

        <div className="llm-tab__prompt-area">
          <label className="prop-label">Natural Language Description</label>
          <textarea
            className="prop-textarea"
            rows={8}
            placeholder="e.g. Fetch JIRA story PROJ-123, generate implementation code with Copilot, then open a GitHub pull request with the code on branch feature/PROJ-123"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
          />
        </div>

        <div className="llm-tab__actions">
          <button className="btn btn--primary" onClick={generate} disabled={generating || !prompt.trim()}>
            {generating ? "⟳ Generating…" : "✨ Generate Workflow"}
          </button>
          <button className="btn btn--ghost" onClick={refreshMeta} title="Re-scan agents and update LLM context">
            ↻ Refresh Agent Context
          </button>
        </div>

        {error && <div className="llm-tab__error">⚠ {error}</div>}
      </div>

      <div className="llm-tab__right">
        {!result && !generating && (
          <div className="llm-tab__placeholder">
            <div style={{ fontSize: "2.5rem", marginBottom: "1rem" }}>✨</div>
            <p>Your generated workflow will appear here</p>
          </div>
        )}

        {generating && (
          <div className="llm-tab__placeholder">
            <div className="llm-tab__spinner" />
            <p>Generating workflow…</p>
          </div>
        )}

        {result && (
          <div className="llm-tab__result">
            <div className="llm-tab__result-header">
              <span>Generated Workflow</span>
              <div style={{ display: "flex", gap: 8 }}>
                <input
                  className="prop-input"
                  style={{ width: 200 }}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder="workflow-name"
                />
                <button className="btn btn--primary" onClick={saveWorkflow} disabled={saving}>
                  {saving ? "Saving…" : "💾 Save"}
                </button>
                <button className="btn btn--success" onClick={loadToCanvas}>
                  ⟵ Load to Canvas
                </button>
              </div>
              {savedMsg && <span style={{ color: "var(--success)", fontSize: "0.8rem" }}>{savedMsg}</span>}
            </div>

            {result.agents && (
              <div className="llm-tab__agents-preview">
                <h4>Agents ({result.agents.length})</h4>
                {result.agents.map((a, i) => (
                  <div key={i} className="run-tab__agent-preview">
                    <span className="run-tab__agent-num">{i + 1}</span>
                    <span>{a.agent_name}</span>
                    {a.requires_approval && <span className="agent-node__badge">HITL</span>}
                  </div>
                ))}
              </div>
            )}

            <pre className="llm-tab__json-viewer">{JSON.stringify(result, null, 2)}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

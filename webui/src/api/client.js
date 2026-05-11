// In VS Code webview mode the extension injects window.__FLASK_PORT__
// so API calls go to the Flask server as absolute URLs.
// In browser/dev mode it's undefined and relative paths are used.
const BASE = window.__FLASK_PORT__ ? `http://localhost:${window.__FLASK_PORT__}` : "";

async function fetchJSON(url, options = {}) {
  const res = await fetch(BASE + url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  getAgents: () => fetchJSON("/get_agents"),
  refreshAgentsMetadata: () => fetchJSON("/refresh_agents_metadata", { method: "POST" }),

  listWorkflows: () => fetchJSON("/list_workflows"),
  getWorkflow: (name) => fetchJSON(`/get_workflow?name=${encodeURIComponent(name)}`),
  saveWorkflow: (name, data) =>
    fetchJSON(`/save_workflow/${encodeURIComponent(name)}`, { method: "POST", body: JSON.stringify(data) }),
  deleteWorkflow: (name) => fetchJSON(`/delete_workflow/${encodeURIComponent(name)}`, { method: "DELETE" }),
  generateWorkflow: (data) => fetchJSON("/generate_workflow", { method: "POST", body: JSON.stringify(data) }),

  generateViaLLM: (prompt) =>
    fetchJSON("/generate_workflow_via_copilot", { method: "POST", body: JSON.stringify({ prompt }) }),

  runWorkflow: (agents, edges = []) =>
    fetchJSON("/run_workflow_langgraph", { method: "POST", body: JSON.stringify({ agents, edges }) }),
  getRunStatus: (runId) => fetchJSON(`/workflow/status/${runId}`),
  approveNode: (runId, nodeId) =>
    fetchJSON("/workflow/approve_lg", { method: "POST", body: JSON.stringify({ run_id: runId, node_id: nodeId }) }),
  rejectNode: (runId, nodeId, feedback) =>
    fetchJSON("/workflow/reject_lg", {
      method: "POST",
      body: JSON.stringify({ run_id: runId, node_id: nodeId, feedback }),
    }),

  tailLogs: (lines = 200) => fetchJSON(`/logs/tail?lines=${lines}`),

  uploadFile: (file) => {
    const fd = new FormData();
    fd.append("file", file);
    return fetch(BASE + "/upload", { method: "POST", body: fd }).then((r) => r.json());
  },
};

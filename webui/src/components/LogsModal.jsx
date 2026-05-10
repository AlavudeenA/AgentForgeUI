import { useEffect, useRef, useState } from "react";
import { api } from "../api/client.js";

export default function LogsModal({ onClose }) {
  const [lines, setLines] = useState([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const [filter, setFilter] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    const load = async () => {
      try {
        const { lines: l } = await api.tailLogs(300);
        setLines(l);
      } catch {}
    };
    load();
    const iv = setInterval(load, 3000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    if (autoScroll && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [lines, autoScroll]);

  const filtered = filter
    ? lines.filter((l) => l.toLowerCase().includes(filter.toLowerCase()))
    : lines;

  const logClass = (line) => {
    if (line.includes("[ERROR]")) return "log-line log-line--error";
    if (line.includes("[WARNING]")) return "log-line log-line--warning";
    if (line.includes("AGENT_STATUS")) return "log-line log-line--status";
    if (line.includes("[INFO]")) return "log-line log-line--info";
    return "log-line";
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal--large" onClick={(e) => e.stopPropagation()}>
        <div className="modal__header">
          <span>📋 Application Logs</span>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input
              className="prop-input"
              style={{ width: 200, padding: "4px 8px", fontSize: "0.8rem" }}
              placeholder="Filter logs…"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            />
            <label style={{ fontSize: "0.75rem", color: "var(--text-secondary)", display: "flex", gap: 4, alignItems: "center" }}>
              <input type="checkbox" checked={autoScroll} onChange={(e) => setAutoScroll(e.target.checked)} />
              Auto-scroll
            </label>
            <button className="btn btn--ghost btn--xs" onClick={onClose}>✕</button>
          </div>
        </div>
        <div className="logs-container">
          {filtered.map((line, i) => (
            <div key={i} className={logClass(line)}>
              <code>{line}</code>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  );
}

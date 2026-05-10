import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const FLASK_URL = "http://localhost:3456";
const proxyRoutes = [
  "/get_agents",
  "/refresh_agents_metadata",
  "/list_workflows",
  "/get_workflow",
  "/generate_workflow",
  "/generate_workflow_via_copilot",
  "/save_workflow",
  "/delete_workflow",
  "/run_workflow_langgraph",
  "/workflow",
  "/github",
  "/upload",
  "/uploaded_files",
  "/logs",
  "/get_logs",
  "/tachyon",
];

const proxy = Object.fromEntries(proxyRoutes.map((r) => [r, { target: FLASK_URL, changeOrigin: true }]));

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy,
  },
  build: {
    outDir: "dist",
    sourcemap: false,
  },
});

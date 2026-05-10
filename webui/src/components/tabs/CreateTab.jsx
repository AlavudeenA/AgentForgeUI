import AgentSidebar from "../AgentSidebar.jsx";
import PropertiesPanel from "../panels/PropertiesPanel.jsx";
import WorkflowCanvas from "../WorkflowCanvas.jsx";
import RunStatusOverlay from "../panels/RunPanel.jsx";

export default function CreateTab() {
  return (
    <div className="create-tab">
      <AgentSidebar />
      <div className="create-tab__canvas">
        <WorkflowCanvas />
        <RunStatusOverlay />
      </div>
      <PropertiesPanel />
    </div>
  );
}

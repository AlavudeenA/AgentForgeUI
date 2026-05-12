import { useEffect, useRef } from "react";
import BpmnModeler from "bpmn-js/lib/Modeler";
import { useWorkflowStore, EMPTY_XML } from "../store/useWorkflowStore.js";

function defaultPropsForBpmnType(type, label) {
  switch (type) {
    case "bpmn:ServiceTask":
    case "bpmn:Task":
      return { agentForgeType: "service", label };
    case "bpmn:ScriptTask":
      return { agentForgeType: "script", label };
    case "bpmn:IntermediateCatchEvent":
      return { agentForgeType: "timer", timerValue: "5", timerType: "duration", label };
    case "bpmn:ExclusiveGateway":
    case "bpmn:ParallelGateway":
      return { agentForgeType: "decision", condition: "", label };
    case "bpmn:TextAnnotation":
      return { agentForgeType: "annotation", text: "", label };
    default:
      return { label };
  }
}

import "bpmn-js/dist/assets/diagram-js.css";
import "bpmn-js/dist/assets/bpmn-js.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn.css";
import "bpmn-js/dist/assets/bpmn-font/css/bpmn-embedded.css";

export default function BpmnCanvas() {
  const containerRef = useRef(null);

  const setModeler           = useWorkflowStore((s) => s.setModeler);
  const updateElementProps   = useWorkflowStore((s) => s.updateElementProps);
  const deleteElementProps   = useWorkflowStore((s) => s.deleteElementProps);
  const setSelectedElementId = useWorkflowStore((s) => s.setSelectedElementId);

  useEffect(() => {
    const modeler = new BpmnModeler({
      container: containerRef.current,
      keyboard: { bindTo: document },
    });

    modeler.importXML(EMPTY_XML).catch(() => {});
    setModeler(modeler);

    const bus = modeler.get("eventBus");

    // Associate pending create data with the new element
    bus.on("shape.added", ({ element }) => {
      if (element.type === "label") return;
      const store = useWorkflowStore.getState();
      const pending = store._pendingCreate;
      if (pending) {
        updateElementProps(element.id, pending);
        store.setPendingCreate(null);
      } else {
        // Appended via context pad — set type-based defaults so PropertiesPanel never
        // renders an element with no props at all.
        const label = element.businessObject?.name || "";
        updateElementProps(element.id, defaultPropsForBpmnType(element.type, label));
      }
      store._syncExecutableElements();
    });

    // Clean up props when an element is removed
    bus.on("shape.remove", ({ element }) => {
      if (element.type !== "label") deleteElementProps(element.id);
    });

    bus.on("shape.removed",    () => useWorkflowStore.getState()._syncExecutableElements());
    bus.on("element.changed",  () => useWorkflowStore.getState()._syncExecutableElements());
    bus.on("connection.added", () => useWorkflowStore.getState()._syncExecutableElements());

    bus.on("selection.changed", ({ newSelection }) => {
      const el = newSelection?.[0];
      setSelectedElementId(el?.type === "label" ? null : (el?.id ?? null));
    });

    return () => {
      modeler.destroy();
      setModeler(null);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <div ref={containerRef} className="bpmn-canvas-container" />;
}

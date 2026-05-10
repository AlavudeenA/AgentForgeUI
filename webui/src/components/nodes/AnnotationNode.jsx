export default function AnnotationNode({ data, selected }) {
  return (
    <div className={`annotation-node ${selected ? "annotation-node--selected" : ""}`}>
      <div className="annotation-node__icon">📝</div>
      <div className="annotation-node__text">{data.text || "Add a note…"}</div>
    </div>
  );
}

import { workflowSteps } from '../../mockData.js';

export default function WorkflowTabs({ activeStep, onChange }) {
  return (
    <div className="workflow-tabs" role="tablist" aria-label="创作主链">
      {workflowSteps.map((step) => (
        <button
          key={step.id}
          type="button"
          className={`workflow-tab${step.id === activeStep ? ' is-active' : ''}`}
          onClick={() => onChange(step.id)}
          role="tab"
          aria-selected={step.id === activeStep}
        >
          <span className="workflow-tab-index">{step.index}</span>
          <span className="workflow-tab-title">{step.title}</span>
          <span className="workflow-tab-note">{step.note}</span>
        </button>
      ))}
    </div>
  );
}

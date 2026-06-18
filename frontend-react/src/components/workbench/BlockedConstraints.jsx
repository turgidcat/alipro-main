export default function BlockedConstraints({ generationConstraints, constraintOverrides, setConstraintOverride }) {
  const blocked = Array.isArray(generationConstraints?.blocked) ? generationConstraints.blocked : [];
  if (blocked.length === 0) return null;

  return (
    <div className="chapter-constraint-inline">
      <div className="chapter-constraint-head">
        <span>禁止项</span>
        <p>例如突然冒出没铺垫的新亲属、直接改写主线走向的新真相，或临时接管剧情的新势力/新规则。</p>
      </div>
      <div className="chapter-constraint-group">
        {blocked.map((group, groupIndex) => (
          <div key={`${group.label}-${groupIndex}`} className="chapter-constraint-row">
            <div className="chapter-constraint-copy">
              <span>{group.label}</span>
              <p>{group.rule}</p>
            </div>
            <div className="chapter-constraint-actions">
              {[
                { value: 'ban', label: '禁止' },
                { value: 'allow', label: '放开' }
              ].map((option) => {
                const key = `blocked-${group.label}-${groupIndex}`;
                const active = (constraintOverrides[key] || 'ban') === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`constraint-toggle-btn${active ? ' is-active' : ''}`}
                    onClick={() => setConstraintOverride(key, option.value)}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

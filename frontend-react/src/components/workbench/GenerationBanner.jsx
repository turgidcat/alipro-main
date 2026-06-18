import BlockedConstraints from './BlockedConstraints.jsx';
import { hasText } from '../../lib/chapterPlan.js';

export default function GenerationBanner(props) {
  const {
    chapterContext,
    constraintOverrides,
    generationRiskReview,
    generationReadiness,
    generationRequiredItems,
    generationRecommendedItems,
    generationRiskConfirmed,
    isGenerating,
    onSetConstraintOverride,
    onGenerationRiskConfirm
  } = props;

  return (
    <>
      <section className={'inline-status-banner is-' + generationReadiness.kind}>
        <strong>{generationReadiness.title}</strong>
        <span>{generationReadiness.text}</span>
      </section>
      <BlockedConstraints
        generationConstraints={chapterContext.generationConstraints}
        constraintOverrides={constraintOverrides}
        setConstraintOverride={onSetConstraintOverride}
      />
      {generationRiskReview.items.length > 0 ? (
        <div className="generation-risk-review">
          <div className="generation-risk-review-head">
            <span>关键控制端点</span>
            <p>这些地方一旦放松，最容易让章节失控、空降大设定或把人物推得过头。</p>
          </div>
          <div className="generation-risk-review-list">
            {generationRiskReview.items.map((item, index) => (
              <article key={`${item.title}-${index}`} className={`generation-risk-item is-${item.level}`}>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
                <p className="generation-risk-action">{item.action}</p>
              </article>
            ))}
          </div>
          {generationRiskReview.hasCritical ? (
            <label className="generation-risk-confirm">
              <input
                type="checkbox"
                checked={generationRiskConfirmed}
                onChange={(event) => onGenerationRiskConfirm(event.target.checked)}
                disabled={isGenerating}
              />
              <span>我确认：本章已主动放开高风险禁止项，接受剧情掌控度会明显下降。</span>
            </label>
          ) : null}
        </div>
      ) : null}
      <div className="generation-brief">
        <div className="summary-group">
          <p className="summary-group-title">计划引用</p>
          <p className="excerpt-text">本次会直接按左栏已保存的章节计划生成；如需改目标、场景、角色或钩子，请先回左栏调整。</p>
        </div>
        <div className="summary-group">
          <p className="summary-group-title">必填信息</p>
          <div className="brief-check-list">
            {generationRequiredItems.map((item) => (
              <span key={item.key} className={'brief-check-item' + (hasText(item.value) ? ' is-ready' : ' is-missing')}>
                {item.label}：{hasText(item.value) ? '已填写' : '未填写'}
              </span>
            ))}
          </div>
        </div>
        <div className="summary-group">
          <p className="summary-group-title">建议补充</p>
          <div className="brief-check-list">
            {generationRecommendedItems.map((item) => (
              <span key={item.key} className={'brief-check-item' + (hasText(item.value) ? ' is-ready' : ' is-missing')}>
                {item.label}：{hasText(item.value) ? '已填写' : '可补充'}
              </span>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

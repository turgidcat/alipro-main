import PanelCard from './PanelCard.jsx';
import BlockedConstraints from './BlockedConstraints.jsx';
import { getPlanWordCount, hasText } from '../../lib/chapterPlan.js';

export default function ContentWorkspace(props) {
  const {
    chapterNumber,
    draftChapterPlan,
    chapterContext,
    constraintOverrides,
    generationRiskReview,
    generationReadiness,
    generationRequiredItems,
    generationRecommendedItems,
    generationState,
    generationRiskConfirmed,
    isGenerating,
    loadingChapter,
    onGenerateChapter,
    onOpenRevisionEditor,
    onSetPromptPreview,
    onPrevChapter,
    onNextChapter,
    onChapterNumberChange,
    onSetConstraintOverride,
    onGenerationRiskConfirm,
    onUpdateGenerationSetting
  } = props;

  return (
    <>
      <PanelCard
        eyebrow="生成前"
        title={'开始第 ' + chapterNumber + ' 章'}
        description="按左栏的章节计划生成正文，这里只处理生成控制与生成前检查。"
        actions={
          <>
            <button type="button" className="ghost-btn" onClick={onSetPromptPreview}>查看生成摘要</button>
            <button
              type="button"
              className="solid-btn"
              onClick={onGenerateChapter}
              disabled={isGenerating || (generationRiskReview.hasCritical && !generationRiskConfirmed)}
            >
              {isGenerating ? '正在生成...' : '生成章节'}
            </button>
          </>
        }
      >
        <div className="generation-chapter-switcher">
          <button type="button" className="ghost-btn" onClick={onPrevChapter} disabled={chapterNumber <= 1 || loadingChapter || isGenerating}>
            上一章
          </button>
          <label className="editor-field generation-chapter-number-field">
            <span>当前章号</span>
            <input
              className="chapter-number-input"
              type="number"
              min="1"
              value={chapterNumber}
              onChange={(event) => onChapterNumberChange(Math.max(1, Number(event.target.value) || 1))}
              disabled={loadingChapter || isGenerating}
            />
          </label>
          <button type="button" className="ghost-btn" onClick={onNextChapter} disabled={loadingChapter || isGenerating}>
            下一章
          </button>
        </div>
        <section className={'inline-status-banner is-' + generationReadiness.kind}>
          <strong>{generationReadiness.title}</strong>
          <span>{generationReadiness.text}</span>
        </section>
        <div className="generation-settings-row">
          <label className="editor-field generation-word-count-field">
            <span>目标字数</span>
            <input
              className="chapter-number-input"
              type="number"
              min="500"
              max="10000"
              step="500"
              value={getPlanWordCount(draftChapterPlan)}
              onChange={(event) => onUpdateGenerationSetting('word_count', Math.min(10000, Math.max(500, Number(event.target.value) || 3000)))}
              disabled={loadingChapter || isGenerating}
            />
          </label>
        </div>
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
      </PanelCard>

      <PanelCard
        eyebrow="生成后"
        title={generationState.hasContent ? '正文与下一章衔接' : '生成结果'}
        description="这里集中查看正文结果和下一章承接。"
        actions={<button type="button" className="solid-btn" onClick={onOpenRevisionEditor} disabled={!generationState.hasContent}>查看/校改正文</button>}
      >
        <p className="summary-state">{generationState.metaText}</p>
        <p className="summary-substate">{generationState.wordCountLabel}</p>
        <p className="excerpt-text preview-excerpt-text">{generationState.previewText}</p>
        <span className="info-chip info-chip-optional">反馈来源：本地整理</span>
        <p className="excerpt-text">{generationState.feedbackSummary}</p>
        <p className="excerpt-text">{generationState.feedbackFocus}</p>
      </PanelCard>
    </>
  );
}

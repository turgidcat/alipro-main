import PanelCard from './PanelCard.jsx';
import GenerationBanner from './GenerationBanner.jsx';
import GenerationSettingsPopover from './GenerationSettingsPopover.jsx';

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
            <GenerationSettingsPopover
              draftChapterPlan={draftChapterPlan}
              loadingChapter={loadingChapter}
              isGenerating={isGenerating}
              onUpdateGenerationSetting={onUpdateGenerationSetting}
            />
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
        <GenerationBanner
          chapterContext={chapterContext}
          constraintOverrides={constraintOverrides}
          generationRiskReview={generationRiskReview}
          generationReadiness={generationReadiness}
          generationRequiredItems={generationRequiredItems}
          generationRecommendedItems={generationRecommendedItems}
          generationRiskConfirmed={generationRiskConfirmed}
          isGenerating={isGenerating}
          onSetConstraintOverride={onSetConstraintOverride}
          onGenerationRiskConfirm={onGenerationRiskConfirm}
        />
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

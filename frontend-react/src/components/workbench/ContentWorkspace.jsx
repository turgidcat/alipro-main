import PanelCard from './PanelCard.jsx';
import GenerationBanner from './GenerationBanner.jsx';
import GenerationSettingsPopover from './GenerationSettingsPopover.jsx';
import IndentedTextBlock from '../IndentedTextBlock.jsx';

const fieldLabelClass = 'mb-2 block text-[11px] font-bold tracking-[0.12em] text-[color:var(--muted)]';
const inputClass = 'min-h-11 w-full rounded-[14px] border border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--panel-note-bg)_64%,white)] px-4 text-[15px] text-[color:var(--text)] shadow-none outline-none transition focus:border-[color:var(--brand-soft-strong)] focus:bg-[var(--panel)]';
const insetTitleClass = 'font-serif text-[13px] font-semibold tracking-[0.04em] text-[color:var(--brand-deep)]';

export default function ContentWorkspace(props) {
  const {
    chapterNumber,
    draftChapterPlan,
    chapterContext,
    constraintOverrides,
    canGenerate,
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
        variant="flat"
        eyebrow="生成前"
        title={`开始第 ${chapterNumber} 章`}
        bodyClassName="space-y-7"
        actionsClassName="justify-between"
        actions={
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="ghost-btn" onClick={onSetPromptPreview}>查看生成摘要</button>
              <GenerationSettingsPopover
                draftChapterPlan={draftChapterPlan}
                loadingChapter={loadingChapter}
                isGenerating={isGenerating}
                onUpdateGenerationSetting={onUpdateGenerationSetting}
              />
            </div>
            <button
              type="button"
              className="solid-btn"
              onClick={onGenerateChapter}
              disabled={!canGenerate || isGenerating || (generationRiskReview.hasCritical && !generationRiskConfirmed)}
            >
              {isGenerating ? '正在生成...' : '生成章节'}
            </button>
          </>
        }
      >
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
        variant="flat"
        className="workbench-result-card"
        eyebrow="生成后"
        title={generationState.hasContent ? '正文与下一章衔接' : '生成结果'}
        bodyClassName="space-y-5"
        headerActions={<button type="button" className="solid-btn" onClick={onOpenRevisionEditor} disabled={!generationState.hasContent}>查看/校改正文</button>}
      >
        <div className="flex flex-wrap items-center gap-3 text-[13px]">
          <span className="text-[color:var(--muted)]">{generationState.wordCountLabel}</span>
        </div>

        <div className="py-2">
          <div className="rounded-[20px] border border-[color:color-mix(in_srgb,var(--line)_82%,white)] bg-[linear-gradient(180deg,rgba(255,253,248,0.94),rgba(250,245,236,0.88))] px-5 py-5">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] pb-3">
              <span className={insetTitleClass}>正文摘读</span>
              <span className="text-[12px] font-semibold text-[color:var(--muted)]">当前生成内容预览</span>
            </div>
            <div className="border-l-2 border-[color:color-mix(in_srgb,var(--brand-soft-strong)_52%,transparent)] pl-4">
              <IndentedTextBlock
                text={generationState.previewText}
                paragraphClassName="cn-text-paragraph text-[15px] leading-9 text-[color:var(--text)]"
              />
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-[16px] bg-[color:rgba(255,252,246,0.52)] px-4 py-4">
            <div className="border-l-2 border-[color:color-mix(in_srgb,var(--line-strong)_76%,transparent)] pl-4">
            <p className={insetTitleClass}>本章反馈</p>
            <IndentedTextBlock
              text={generationState.feedbackSummary}
              className="mt-2"
              paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]"
            />
            </div>
          </div>
          <div className="rounded-[16px] bg-[color:rgba(255,252,246,0.52)] px-4 py-4">
            <div className="border-l-2 border-[color:color-mix(in_srgb,var(--line-strong)_76%,transparent)] pl-4">
            <p className={insetTitleClass}>下一步关注</p>
            <IndentedTextBlock
              text={generationState.feedbackFocus}
              className="mt-2"
              paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]"
            />
            </div>
          </div>
        </div>
      </PanelCard>
    </>
  );
}

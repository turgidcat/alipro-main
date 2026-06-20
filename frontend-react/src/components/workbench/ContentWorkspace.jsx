import GenerationBanner from './GenerationBanner.jsx';
import GenerationSettingsPopover from './GenerationSettingsPopover.jsx';
import IndentedTextBlock from '../IndentedTextBlock.jsx';
import WorkbenchSection from './WorkbenchSection.jsx';
import MetaCode from './MetaCode.jsx';

const ghostButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_84%,transparent)] px-3.5 text-[13px] font-medium text-[color:var(--text)] transition hover:border-[color:color-mix(in_srgb,var(--brand-soft-strong)_45%,var(--line))] hover:text-[color:var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-60';

const primaryButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--brand-soft-strong)_72%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand)_10%,var(--surface))] px-4 text-[13px] font-semibold text-[color:var(--brand-deep)] transition hover:bg-[color:color-mix(in_srgb,var(--brand)_16%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-60';

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
    <div className="grid min-w-0 max-w-full gap-8 overflow-x-hidden px-5 py-6 lg:px-8">
      <WorkbenchSection
        code="PREP"
        title={`开始第 ${chapterNumber} 章`}
        description="生成前检查当前计划引用、必要信息和风险控制点。"
        className="bg-transparent"
        contentClassName="gap-5"
        actions={
          <div className="flex flex-wrap items-center justify-end gap-3">
            <button type="button" className={ghostButtonClass} onClick={onSetPromptPreview}>
              查看生成摘要
            </button>
            <GenerationSettingsPopover
              draftChapterPlan={draftChapterPlan}
              loadingChapter={loadingChapter}
              isGenerating={isGenerating}
              onUpdateGenerationSetting={onUpdateGenerationSetting}
            />
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onGenerateChapter}
              disabled={!canGenerate || isGenerating || (generationRiskReview.hasCritical && !generationRiskConfirmed)}
            >
              {isGenerating ? '正在生成...' : '生成章节'}
            </button>
          </div>
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
      </WorkbenchSection>

      <WorkbenchSection
        code="PROSE"
        title={generationState.hasContent ? '正文与下一章衔接' : '生成结果'}
        description={generationState.hasContent ? '正文预览优先展示，反馈和下一步关注压缩到侧下方。' : '当前还没有可预览的正文内容。'}
        contentClassName="gap-6"
        actions={
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onOpenRevisionEditor}
            disabled={!generationState.hasContent}
          >
            查看/校改正文
          </button>
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-x-hidden">
          <MetaCode>CH.{String(chapterNumber).padStart(2, '0')}</MetaCode>
          <span className="text-[13px] leading-6 text-[color:var(--muted)]">{generationState.wordCountLabel}</span>
        </div>

        <section className="min-w-0 max-w-full overflow-x-hidden border-t border-[color:color-mix(in_srgb,var(--line)_58%,transparent)] pt-5">
          <div className="mx-auto grid w-full max-w-[860px] min-w-0 gap-4 overflow-x-hidden">
            <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
              <MetaCode>PROSE PREVIEW</MetaCode>
              <span className="text-[13px] leading-6 text-[color:var(--muted)]">当前生成内容预览</span>
            </div>
            <div className="min-w-0 border-l border-[color:color-mix(in_srgb,var(--brand-soft-strong)_48%,var(--line))] bg-[color:color-mix(in_srgb,var(--surface)_88%,var(--background))] pl-5 pr-1">
              <IndentedTextBlock
                text={generationState.previewText}
                paragraphClassName="cn-text-paragraph font-serif text-[17px] leading-9 text-[color:var(--text)]"
              />
            </div>
          </div>
        </section>

        <div className="grid min-w-0 gap-6 overflow-x-hidden lg:grid-cols-2">
          <section className="min-w-0 border-t border-[color:color-mix(in_srgb,var(--line)_54%,transparent)] pt-4">
            <div className="border-l border-[color:color-mix(in_srgb,var(--line-strong)_72%,transparent)] pl-4">
              <MetaCode>FEEDBACK</MetaCode>
              <p className="mt-1 text-[14px] font-semibold leading-6 text-[color:var(--text)]">本章反馈</p>
              <IndentedTextBlock
                text={generationState.feedbackSummary}
                className="mt-3"
                paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]"
              />
            </div>
          </section>

          <section className="min-w-0 border-t border-[color:color-mix(in_srgb,var(--line)_54%,transparent)] pt-4">
            <div className="border-l border-[color:color-mix(in_srgb,var(--line-strong)_72%,transparent)] pl-4">
              <MetaCode>NEXT FOCUS</MetaCode>
              <p className="mt-1 text-[14px] font-semibold leading-6 text-[color:var(--text)]">下一步关注</p>
              <IndentedTextBlock
                text={generationState.feedbackFocus}
                className="mt-3"
                paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]"
              />
            </div>
          </section>
        </div>
      </WorkbenchSection>
    </div>
  );
}

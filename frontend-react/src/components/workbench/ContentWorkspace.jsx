import GenerationSettingsPopover from './GenerationSettingsPopover.jsx';
import IndentedTextBlock from '../IndentedTextBlock.jsx';
import WorkbenchSection from './WorkbenchSection.jsx';
import MetaCode from './MetaCode.jsx';
import StatusNotice from './StatusNotice.jsx';
import { formatChapterLabel } from '../../lib/chapterName.js';
import { DEFAULT_WORD_COUNT } from '../../lib/wordCountPolicy.js';
import BlindLabelPanel from './BlindLabelPanel.jsx';

function getGenerationWordTarget(plan) {
  return Number(
    plan?.structured_content?.generation_settings?.word_count
    || plan?.structuredContent?.generation_settings?.word_count
    || plan?.generation_settings?.word_count
    || DEFAULT_WORD_COUNT
  );
}

function getMainStorylineLabel(plan) {
  const storylines = Array.isArray(plan?.target_storylines) ? plan.target_storylines : [];
  const mainId = String(plan?.main_storyline_id || '').trim();
  const mainStoryline = storylines.find((item) => String(item?.id || item?.storyline_id || '') === mainId);
  const candidate = mainStoryline || storylines[0];
  return String(
    candidate?.name || candidate?.title || candidate?.storyline_title || candidate?.label || ''
  ).trim();
}

function joinMissingLabels(items) {
  return items.length > 0 ? `缺：${items.join('、')}` : '已就绪';
}

function qualityStatusLabel(status = '') {
  const map = {
    passed: '通过',
    stable: '稳定',
    warning: '需复核',
    needs_review: '需复核',
    review: '需复核',
    failed: '未通过',
    blocked: '未通过',
    not_run: '未运行',
    not_applicable: '不适用',
    degraded: '降级',
    advanced: '已推进'
  };
  return map[String(status || '').toLowerCase()] || String(status || '未知');
}

export default function ContentWorkspace(props) {
  const {
    chapterConfigPanel,
    chapterNumber,
    bookId,
    draftChapterPlan,
    canGenerate,
    generationState,
    isGenerating,
    loadingChapter,
    onGenerateChapter,
    onStopGeneration,
    onSaveGenerationSettings,
    onOpenRevisionEditor,
    onSetPromptPreview,
    onUpdateGenerationSetting,
    onOpenOutlineModal,
    onOpenCharacterModal,
    onOpenStorylinePicker,
    onConfirmReview,
    reviewConfirming = false
  } = props;
  const mountedStorylineCount = Array.isArray(draftChapterPlan.target_storylines)
    ? draftChapterPlan.target_storylines.length
    : 0;
  const hasMainStoryline = Boolean(String(draftChapterPlan.main_storyline_id || '').trim());
  const hasRoleConfig =
    Boolean(String(draftChapterPlan.character_notes || '').trim()) ||
    (Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0);
  const generationPreviewVisible = !generationState.hasContent && !isGenerating;
  const chapterTitle = formatChapterLabel(chapterNumber, draftChapterPlan.chapter_name);
  const generationWordTarget = getGenerationWordTarget(draftChapterPlan);
  const generationPreviewOutline = String(draftChapterPlan.outline_text || '').trim();
  const generationPreviewStoryline = getMainStorylineLabel(draftChapterPlan);
  const missingOutlineItems = generationPreviewOutline ? [] : ['章节细纲'];
  const missingStorylineItems = [hasMainStoryline ? '' : '当前卷主线'].filter(Boolean);
  const requiredMissingCount = missingOutlineItems.length + missingStorylineItems.length;
  const requiredMissingLabels = [...missingOutlineItems, ...missingStorylineItems];
  const roleConfigLabel = hasRoleConfig ? '已配置本章角色' : '建议补出场角色';
  const storylineStatusLabel = hasMainStoryline
    ? (generationPreviewStoryline || '当前卷主线已挂载')
    : mountedStorylineCount > 0
      ? `${mountedStorylineCount} 条已挂载，当前卷主线待补`
      : '未挂载叙事脉络';
  const proseDisplayText = String(generationState.content || generationState.previewText || '').trim();
  // 完整审校数据在章节规划的 structured_content.chapter_feedback.quality_check 里
  const qualityCheck = draftChapterPlan?.structured_content?.chapter_feedback?.quality_check
    || draftChapterPlan?.structuredContent?.chapter_feedback?.quality_check
    || null;
  const qualityConfirmed = Boolean(qualityCheck?.human_confirmed);
  const qualityStatusLower = String(qualityCheck?.status || '').toLowerCase();
  const qualityNeedsReview = Boolean(qualityCheck?.needs_human_review)
    || ['warning', 'failed', 'degraded', 'not_run', 'needs_review'].includes(qualityStatusLower);
  const qualityRisks = Array.isArray(qualityCheck?.risks) ? qualityCheck.risks : [];
  const planAnchorIssues = Array.isArray(qualityCheck?.plan_anchor_audit?.issues)
    ? qualityCheck.plan_anchor_audit.issues
    : [];

  return (
    <>
      <style>{`
        .workbench-review-report {
          border: 1px solid var(--paper-border);
          border-radius: var(--paper-radius-md);
          background: var(--paper-surface);
          overflow: hidden;
        }

        .workbench-review-report summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          padding: 10px 14px;
          cursor: pointer;
          color: var(--paper-text);
          font-size: 12.5px;
          font-weight: 700;
          list-style: none;
          user-select: none;
        }

        .workbench-review-report summary::-webkit-details-marker {
          display: none;
        }

        .workbench-review-report summary::after {
          content: '▾';
          color: var(--paper-text-tertiary);
          font-size: 11px;
          transition: transform 150ms ease;
        }

        .workbench-review-report[open] summary::after {
          transform: rotate(180deg);
        }

        .workbench-review-badge {
          padding: 2px 9px;
          border-radius: 999px;
          font-size: 10.5px;
          font-weight: 700;
        }

        .workbench-review-badge.is-warning {
          background: rgba(176, 138, 79, 0.18);
          color: #8b6914;
        }

        .workbench-review-badge.is-ok {
          background: rgba(74, 153, 96, 0.16);
          color: #2f6b3f;
        }

        .workbench-review-badge.is-confirmed {
          background: rgba(77, 129, 192, 0.16);
          color: #31598c;
        }

        .workbench-review-report-body {
          padding: 4px 14px 14px;
          border-top: 1px solid var(--paper-border);
        }

        .workbench-review-grid {
          display: grid;
          grid-template-columns: 84px 1fr;
          gap: 6px 12px;
          padding: 10px 0 4px;
          font-size: 12px;
          line-height: 1.6;
        }

        .workbench-review-label {
          color: var(--paper-text-tertiary);
          font-size: 11px;
          font-weight: 650;
        }

        .workbench-review-risks {
          margin: 8px 0 0;
          padding: 0 0 0 18px;
          color: var(--paper-text-soft);
          font-size: 11.5px;
          line-height: 1.7;
        }

        .workbench-review-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 12px;
        }

        .workbench-review-confirm {
          padding: 6px 14px;
          border: 1px solid rgba(77, 129, 192, 0.45);
          border-radius: var(--paper-radius-sm);
          background: rgba(77, 129, 192, 0.12);
          color: #31598c;
          font-family: var(--font-sans);
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: background 150ms ease, border-color 150ms ease;
        }

        .workbench-review-confirm:hover:not(:disabled) {
          background: rgba(77, 129, 192, 0.2);
          border-color: rgba(77, 129, 192, 0.65);
        }

        .workbench-review-confirm:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .workbench-review-confirmed {
          color: #31598c;
          font-size: 12px;
          font-weight: 650;
        }
      `}</style>
      <div className="workbench-content-split">
        <section className="workbench-prose-main" aria-label="正文工作区">
          <WorkbenchSection
            code="PROSE"
            title={generationPreviewVisible ? '生成预览' : (generationState.hasContent ? '正文' : '生成结果')}
            actions={
              <div className="workbench-prose-inline-actions">
                {isGenerating ? (
                  <button type="button" className="wpa-stop" onClick={onStopGeneration}>停止</button>
                ) : generationState.hasContent ? (
                  <button type="button" className="wpa-secondary" onClick={onOpenRevisionEditor}>校改</button>
                ) : null}
                {isGenerating ? null : (
                  <GenerationSettingsPopover
                    settings={draftChapterPlan.generation_settings}
                    onUpdate={(field, value) => onUpdateGenerationSetting?.(field, value)}
                    onSave={onSaveGenerationSettings}
                    saveDisabled={loadingChapter || isGenerating}
                    saveLabel={loadingChapter ? '读取中...' : isGenerating ? '生成中...' : '保存生成控制'}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v2m0 18v2M4.22 4.22l1.42 1.42m12.73 12.73l1.42 1.42M1 12h2m18 0h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
                  </GenerationSettingsPopover>
                )}
                {isGenerating ? null : (
                  <button
                    type="button"
                    className="wpa-generate"
                    onClick={onGenerateChapter}
                    disabled={!canGenerate}
                  >
                    {isGenerating ? '生成中' : '生成'}
                  </button>
                )}
              </div>
            }
            contentClassName="gap-3"
          >
            {/* Status notice — compact, inside PROSE card */}
            {generationState.statusTitle ? (
              <StatusNotice
                kind={isGenerating ? 'warning' : generationState.statusKind}
                title={isGenerating ? (generationState.statusTitle || '正在生成这一章') : generationState.statusTitle}
                className="mb-0"
              />
            ) : null}

            {qualityCheck && Object.keys(qualityCheck).length > 0 ? (
              <details className="workbench-review-report">
                <summary>
                  <span>创作审校报告</span>
                  {qualityConfirmed ? (
                    <span className="workbench-review-badge is-confirmed">已确认放行</span>
                  ) : qualityNeedsReview ? (
                    <span className="workbench-review-badge is-warning">需复核</span>
                  ) : (
                    <span className="workbench-review-badge is-ok">已通过</span>
                  )}
                </summary>
                <div className="workbench-review-report-body">
                  <div className="workbench-review-grid">
                    <span className="workbench-review-label">质量结论</span>
                    <span>
                      {qualityStatusLabel(qualityCheck.status)}
                      {qualityCheck.verdict ? `（${qualityCheck.verdict}）` : ''}
                    </span>
                    {qualityCheck.plan_anchor_audit && Object.keys(qualityCheck.plan_anchor_audit).length > 0 ? (
                      <>
                        <span className="workbench-review-label">计划锚点</span>
                        <span>{qualityStatusLabel(qualityCheck.plan_anchor_audit.status)}</span>
                      </>
                    ) : null}
                    {qualityCheck.word_count_audit && Object.keys(qualityCheck.word_count_audit).length > 0 ? (
                      <>
                        <span className="workbench-review-label">字数检查</span>
                        <span>{qualityStatusLabel(qualityCheck.word_count_audit.status)}</span>
                      </>
                    ) : null}
                    {qualityCheck.storyline_audit && Object.keys(qualityCheck.storyline_audit).length > 0 ? (
                      <>
                        <span className="workbench-review-label">剧情线推进</span>
                        <span>{qualityStatusLabel(qualityCheck.storyline_audit.status)}</span>
                      </>
                    ) : null}
                  </div>
                  {qualityRisks.length > 0 ? (
                    <ul className="workbench-review-risks">
                      {qualityRisks.map((risk, index) => <li key={`risk-${index}`}>{risk}</li>)}
                    </ul>
                  ) : null}
                  {planAnchorIssues.length > 0 ? (
                    <ul className="workbench-review-risks">
                      {planAnchorIssues.map((issue, index) => <li key={`anchor-${index}`}>{issue}</li>)}
                    </ul>
                  ) : null}
                  <div className="workbench-review-actions">
                    {qualityConfirmed ? (
                      <span className="workbench-review-confirmed">已确认放行，下一章不再受此门禁阻塞</span>
                    ) : qualityNeedsReview ? (
                      <button
                        type="button"
                        className="workbench-review-confirm"
                        onClick={onConfirmReview}
                        disabled={reviewConfirming}
                      >
                        {reviewConfirming ? '确认中…' : '人工确认放行'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </details>
            ) : null}

            {generationPreviewVisible ? (
              <section className="workbench-generation-preview">
                <div className="workbench-generation-preview-head">
                  <MetaCode>READY TO WRITE</MetaCode>
                  <span>目标约 {generationWordTarget} 字</span>
                </div>
                <div className="workbench-generation-preview-title-row">
                  <h3>{chapterTitle}</h3>
                  <span className={requiredMissingCount > 0 ? 'is-warning' : 'is-ready'}>
                    {requiredMissingCount > 0 ? `还差 ${requiredMissingCount} 个必填点` : '可以生成'}
                  </span>
                </div>
                {requiredMissingCount > 0 ? (
                  <div className="workbench-generation-blocking-tip">
                    <strong>缺：{requiredMissingLabels.join('、')}</strong>
                    <span>先补齐红色项，再生成正文。</span>
                  </div>
                ) : null}
                <div className="workbench-generation-prep-list">
                  <button
                    type="button"
                    className={`workbench-generation-prep-row${missingOutlineItems.length > 0 ? ' is-warning' : ' is-ready'}`}
                    onClick={() => onOpenOutlineModal?.()}
                  >
                    <span className="workbench-generation-prep-main">
                      <strong>章节细纲</strong>
                      <small>{joinMissingLabels(missingOutlineItems)}</small>
                    </span>
                    <em>补细纲</em>
                  </button>
                  <button
                    type="button"
                    className={`workbench-generation-prep-row is-storyline${missingStorylineItems.length > 0 ? ' is-warning' : ' is-ready'}`}
                    onClick={() => onOpenStorylinePicker?.()}
                  >
                    <span className="workbench-generation-prep-main">
                      <strong>叙事脉络</strong>
                      <small>{storylineStatusLabel}</small>
                    </span>
                    <em>选择脉络</em>
                  </button>
                  <button
                    type="button"
                    className={`workbench-generation-prep-row${hasRoleConfig ? ' is-ready' : ''}`}
                    onClick={() => onOpenCharacterModal?.()}
                  >
                    <span className="workbench-generation-prep-main">
                      <strong>角色配置</strong>
                      <small>{hasRoleConfig ? roleConfigLabel : `建议：${roleConfigLabel}`}</small>
                    </span>
                    <em>配角色</em>
                  </button>
                </div>
                {/* No duplicate generate button here — use the one in card header */}
              </section>
            ) : (
              <section className="workbench-prose-preview">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <MetaCode>PROSE PREVIEW</MetaCode>
                  <span className="text-[13px] leading-6 text-[color:var(--muted)]">
                    CH.{String(chapterNumber).padStart(2, '0')}　{generationState.wordCountLabel}
                  </span>
                </div>
                <div className="workbench-prose-paper">
                  <IndentedTextBlock
                    text={proseDisplayText}
                    paragraphClassName="cn-text-paragraph font-serif text-[15px] leading-8 text-[color:var(--text)]"
                  />
                </div>
              </section>
            )}
          </WorkbenchSection>
        </section>
      </div>
      <BlindLabelPanel bookId={bookId} chapterNumber={chapterNumber} />
    </>
  );
}

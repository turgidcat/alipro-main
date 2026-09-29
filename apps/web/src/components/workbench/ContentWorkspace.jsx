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
    onOpenVersionHistory,
    onSetPromptPreview,
    onUpdateGenerationSetting,
    onOpenReader,
    onOpenOutlineModal,
    onConfirmReview,
    onNextChapter,
    reviewConfirming = false
  } = props;
  const hasMainStoryline = Boolean(String(draftChapterPlan.main_storyline_id || '').trim());
  const generationPreviewVisible = !generationState.hasContent && !isGenerating;
  const chapterTitle = formatChapterLabel(chapterNumber, draftChapterPlan.chapter_name);
  const generationWordTarget = getGenerationWordTarget(draftChapterPlan);
  const generationPreviewOutline = String(draftChapterPlan.outline_text || '').trim();
  const missingOutlineItems = generationPreviewOutline ? [] : ['章节细纲'];
  // 生成硬门槛只认章节细纲；叙事脉络是强烈建议项，不能一边提示“必填”一边仍允许生成。
  const requiredMissingCount = missingOutlineItems.length;
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
  const hasQualityCheck = Boolean(qualityCheck && Object.keys(qualityCheck).length > 0);
  const qualityPassed = hasQualityCheck && (qualityConfirmed || !qualityNeedsReview);

  let workflowStep = 1;
  let nextStepState = {
    tone: 'warning',
    eyebrow: '先完成本章准备',
    title: '补齐章节细纲',
    text: '正文生成只剩这一项硬门槛。保存细纲后，这里会自动切换为“生成正文”。',
    primaryLabel: '完善章节细纲',
    onPrimary: onOpenOutlineModal,
  };

  if (loadingChapter) {
    nextStepState = {
      tone: 'info',
      eyebrow: '正在确认当前进度',
      title: '读取本章资料',
      text: '系统正在整理细纲、正文和审校状态，完成后会给出唯一的下一步。',
      primaryLabel: '',
      onPrimary: null,
    };
  } else if (isGenerating) {
    workflowStep = 2;
    nextStepState = {
      tone: 'info',
      eyebrow: '正文生成中',
      title: '留在当前页面等待完成',
      text: '生成完成后会自动保存正文、刷新审校，并告诉你是否可以进入下一章。',
      primaryLabel: '',
      onPrimary: null,
    };
  } else if (requiredMissingCount === 0 && !generationState.hasContent) {
    workflowStep = 2;
    nextStepState = {
      tone: hasMainStoryline ? 'ready' : 'warning',
      eyebrow: hasMainStoryline ? '本章准备完成' : '已经可以生成',
      title: '生成本章正文',
      text: hasMainStoryline
        ? '章节细纲和当前卷主线都已就位，可以开始生成。'
        : '章节细纲已经就位。当前卷主线尚未挂载，可先补脉络让长篇承接更稳，也可以直接生成。',
      primaryLabel: '生成正文',
      onPrimary: onGenerateChapter
    };
  } else if (generationState.hasContent && hasQualityCheck && qualityNeedsReview && !qualityConfirmed) {
    workflowStep = 3;
    nextStepState = {
      tone: 'warning',
      eyebrow: '正文已生成 · 审校待处理',
      title: '先处理审校风险',
      text: '审校发现需要复核的项目。查看报告后，可以校改正文，或确认风险可接受再继续。',
      primaryLabel: '查看审校报告',
      onPrimary: () => {
        const report = document.getElementById(`chapter-quality-review-${chapterNumber}`);
        if (!report) return;
        report.open = true;
        report.scrollIntoView({ behavior: 'smooth', block: 'center' });
      },
    };
  } else if (generationState.hasContent && qualityPassed) {
    workflowStep = 4;
    nextStepState = {
      tone: 'ready',
      eyebrow: qualityConfirmed ? '风险已人工确认' : '本章审校已通过',
      title: '进入下一章',
      text: '本章正文和审校已经闭环。下一章会自动承接本章摘要、人物状态和未解决线索。',
      primaryLabel: '开始下一章',
      onPrimary: onNextChapter
    };
  } else if (generationState.hasContent) {
    workflowStep = 3;
    nextStepState = {
      tone: 'info',
      eyebrow: '正文已保存',
      title: '校改或继续下一章',
      text: '当前没有可用的正式审校结论。建议先校改定稿，也可以保留当前正文继续创作。',
      primaryLabel: '校改正文',
      onPrimary: onOpenRevisionEditor
    };
  }

  const workflowSteps = [
    { number: 1, label: '准备' },
    { number: 2, label: '生成' },
    { number: 3, label: '审校' },
    { number: 4, label: '下一章' }
  ];

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
          <section className={`workbench-next-step is-${nextStepState.tone}`} aria-label="当前创作进度与下一步">
            <div className="workbench-next-step-track" aria-label={`当前第 ${workflowStep} 步，共 4 步`}>
              {workflowSteps.map((item) => (
                <div
                  className={`workbench-next-step-node${item.number < workflowStep ? ' is-done' : ''}${item.number === workflowStep ? ' is-current' : ''}`}
                  key={item.number}
                >
                  <span>{item.number < workflowStep ? '✓' : item.number}</span>
                  <strong>{item.label}</strong>
                </div>
              ))}
            </div>
            <div className="workbench-next-step-body">
              <div className="workbench-next-step-copy">
                <span>{nextStepState.eyebrow}</span>
                <strong>{nextStepState.title}</strong>
                <p>{nextStepState.text}</p>
              </div>
              {nextStepState.primaryLabel ? (
                <div className="workbench-next-step-actions">
                  <button
                    type="button"
                    className="workbench-next-step-primary"
                    onClick={nextStepState.onPrimary}
                    disabled={nextStepState.primaryLabel === '生成正文' && (!canGenerate || requiredMissingCount > 0)}
                  >
                    {nextStepState.primaryLabel}
                  </button>
                </div>
              ) : null}
            </div>
          </section>
          <WorkbenchSection
            code="PROSE"
            title={generationPreviewVisible ? '生成预览' : (generationState.hasContent ? '正文' : '生成结果')}
            className={generationPreviewVisible ? 'is-generation-empty' : ''}
            actions={
              <div className="workbench-prose-inline-actions">
                {isGenerating ? (
                  <button type="button" className="wpa-stop" onClick={onStopGeneration}>停止</button>
                ) : generationState.hasContent ? (
                  <button type="button" className="wpa-secondary" onClick={onOpenRevisionEditor}>校改</button>
                ) : null}
                {isGenerating ? null : (
                  <button type="button" className="wpa-secondary" onClick={onOpenVersionHistory}>历史版本</button>
                )}
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
                    disabled={!canGenerate || requiredMissingCount > 0}
                  >
                    {generationState.hasContent ? '重新生成' : '生成正文'}
                  </button>
                )}
              </div>
            }
            contentClassName={generationPreviewVisible ? 'workbench-empty-section-content' : 'gap-3'}
          >
            {/* Status notice — compact, inside PROSE card */}
            {generationState.statusTitle && !generationPreviewVisible ? (
              <StatusNotice
                kind={isGenerating ? 'warning' : generationState.statusKind}
                title={isGenerating ? (generationState.statusTitle || '正在生成这一章') : generationState.statusTitle}
                className="mb-0"
              />
            ) : null}

            {qualityCheck && Object.keys(qualityCheck).length > 0 ? (
              <details id={`chapter-quality-review-${chapterNumber}`} className="workbench-review-report">
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
              <section className="workbench-empty-canvas">
                <div className="workbench-empty-canvas-meta">
                  <span>CHAPTER {String(chapterNumber).padStart(2, '0')}</span>
                  <span>目标约 {generationWordTarget} 字</span>
                </div>
                <div className="workbench-empty-canvas-copy">
                  <span aria-hidden="true" />
                  <h3>{chapterTitle}</h3>
                  <p>一页留白，等细纲落笔。</p>
                </div>
                <div className="workbench-empty-canvas-lines" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <div className="workbench-empty-canvas-ornament" aria-hidden="true">
                  {String(chapterNumber).padStart(2, '0')}
                </div>
              </section>
            ) : (
              <section className="workbench-prose-preview">
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3">
                  <MetaCode>PROSE PREVIEW</MetaCode>
                  <span className="text-[13px] leading-6 text-[color:var(--muted)]">
                    CH.{String(chapterNumber).padStart(2, '0')}　{generationState.wordCountLabel}
                  </span>
                </div>
                {onOpenReader ? (
                  <button type="button" className="workbench-mobile-reader-entry" onClick={onOpenReader}>
                    <span className="workbench-mobile-reader-kicker">正文已保存 · CH.{String(chapterNumber).padStart(2, '0')}</span>
                    <strong>进入沉浸式阅读</strong>
                    <small>隐藏工作台面板，专注阅读本章正文</small>
                    <span className="workbench-mobile-reader-arrow" aria-hidden="true">→</span>
                  </button>
                ) : null}
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

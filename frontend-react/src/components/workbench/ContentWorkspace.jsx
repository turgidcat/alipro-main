import { useState } from 'react';
import GenerationSettingsPopover from './GenerationSettingsPopover.jsx';
import IndentedTextBlock from '../IndentedTextBlock.jsx';
import WorkbenchSection from './WorkbenchSection.jsx';
import MetaCode from './MetaCode.jsx';
import StatusNotice from './StatusNotice.jsx';
import ContextDrawer from './ContextDrawer.jsx';

const ghostButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_84%,transparent)] px-3.5 text-[13px] font-medium text-[color:var(--text)] transition hover:border-[color:color-mix(in_srgb,var(--brand-soft-strong)_45%,var(--line))] hover:text-[color:var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-60';

const primaryButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--brand-soft-strong)_72%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand)_10%,var(--surface))] px-4 text-[13px] font-semibold text-[color:var(--brand-deep)] transition hover:bg-[color:color-mix(in_srgb,var(--brand)_16%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-60';

function DrawerEntry({ code = '', title, text = '', onOpen, tone = 'default' }) {
  return (
    <button type="button" className={`workbench-drawer-entry is-${tone}`} onClick={onOpen}>
      <span className="workbench-drawer-entry-head">
        {code ? <MetaCode>{code}</MetaCode> : null}
        <strong>{title}</strong>
      </span>
      {text ? <span className="workbench-drawer-entry-text">{text}</span> : null}
      <span className="workbench-drawer-entry-action">查看详情</span>
    </button>
  );
}

function getQualityLabel(qualityCheck) {
  const kind = qualityCheck?.kind || '';
  if (kind === 'success') return '质量检查通过';
  if (kind === 'error') return '质量检查异常';
  if (kind === 'warning') return '质量需要复查';
  return '质量待检查';
}

function getStorylineProgressLabel(generationState) {
  if (generationState.storylineProgressError) return '剧情线写回失败';
  if (generationState.storylineProgressUpdated) return '剧情线已推进';
  if (generationState.storylineProgress || generationState.qualityCheck?.storylineAudit) return '剧情线有记录';
  return '剧情线待检查';
}

function getGenerationWordTarget(plan) {
  return Number(
    plan?.structured_content?.generation_settings?.word_count
    || plan?.structuredContent?.generation_settings?.word_count
    || plan?.generation_settings?.word_count
    || 3000
  );
}

function getMainStorylineLabel(plan) {
  const storylines = Array.isArray(plan?.target_storylines) ? plan.target_storylines : [];
  const mainId = String(plan?.main_storyline_id || '').trim();
  const mainStoryline = storylines.find((item) => String(item?.id || item?.storyline_id || '') === mainId);
  const candidate = mainStoryline || storylines[0];
  return String(
    candidate?.name
    || candidate?.title
    || candidate?.storyline_title
    || candidate?.label
    || ''
  ).trim();
}

function getPreviewLines(value, limit = 3) {
  return String(value || '')
    .split(/\n+/)
    .map((line) => line.replace(/^\s*\d+[.、)]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, limit);
}

function joinMissingLabels(items) {
  return items.length > 0 ? `缺：${items.join('、')}` : '已就绪';
}

export default function ContentWorkspace(props) {
  const {
    chapterConfigPanel,
    chapterNumber,
    draftChapterPlan,
    canGenerate,
    generationState,
    isGenerating,
    loadingChapter,
    onGenerateChapter,
    onStopGeneration,
    onOpenRevisionEditor,
    onSetPromptPreview,
    onUpdateGenerationSetting,
    onOpenOutlineModal,
    onOpenCharacterModal,
    onOpenStorylinePicker
  } = props;
  const [activeMetaDrawer, setActiveMetaDrawer] = useState(null);
  const chapterStructure = draftChapterPlan.chapter_structure || {};
  const mountedStorylineCount = Array.isArray(draftChapterPlan.target_storylines)
    ? draftChapterPlan.target_storylines.length
    : 0;
  const hasMainStoryline = Boolean(String(draftChapterPlan.main_storyline_id || '').trim());
  const hasRoleConfig =
    Boolean(String(draftChapterPlan.character_notes || '').trim()) ||
    (Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0);
  const hasResultMeta =
    generationState.hasContent ||
    Boolean(generationState.qualityCheck) ||
    Boolean(generationState.storylineProgress) ||
    Boolean(generationState.feedbackSummary) ||
    Boolean(generationState.feedbackFocus);
  const qualityLabel = getQualityLabel(generationState.qualityCheck);
  const storylineProgressLabel = getStorylineProgressLabel(generationState);
  const generationPreviewVisible = !generationState.hasContent && !isGenerating;
  const chapterTitle = draftChapterPlan.chapter_name
    ? `第 ${chapterNumber} 章 · ${draftChapterPlan.chapter_name}`
    : `第 ${chapterNumber} 章`;
  const generationWordTarget = getGenerationWordTarget(draftChapterPlan);
  const generationPreviewGoal = String(chapterStructure.chapter_goal || draftChapterPlan.chapter_mission || '').trim();
  const generationPreviewScenes = getPreviewLines(chapterStructure.key_scenes, 4);
  const generationPreviewStoryline = getMainStorylineLabel(draftChapterPlan);
  const generationPreviewConflict = String(chapterStructure.conflict_escalation || '').trim();
  const generationPreviewHook = String(chapterStructure.ending_hook || draftChapterPlan.ending_hook || '').trim();
  const missingOutlineItems = [
    generationPreviewGoal ? '' : '本章目标',
    generationPreviewScenes.length > 0 ? '' : '关键场景',
    generationPreviewConflict ? '' : '冲突升级',
    generationPreviewHook ? '' : '结尾钩子'
  ].filter(Boolean);
  const missingStorylineItems = [
    hasMainStoryline ? '' : '主推剧情线'
  ].filter(Boolean);
  const requiredMissingCount = missingOutlineItems.length + missingStorylineItems.length;
  const requiredMissingLabels = [...missingOutlineItems, ...missingStorylineItems];
  const roleConfigLabel = hasRoleConfig ? '已配置本章角色' : '建议补出场角色';
  const storylineStatusLabel = hasMainStoryline
    ? (generationPreviewStoryline || '已设置主推剧情线')
    : mountedStorylineCount > 0
      ? `${mountedStorylineCount} 条已挂载，未设主推`
      : '未挂载剧情线';
  const proseDisplayText = String(generationState.content || generationState.previewText || '').trim();

  return (
    <>
    <div className="workbench-content-split">
      <section className="workbench-prose-main" aria-label="正文工作区">
        <section className="workbench-prose-toolbar" aria-label="生成与正文操作">
          <StatusNotice
            kind={isGenerating ? 'warning' : generationState.statusKind}
            title={isGenerating ? (generationState.statusTitle || '正在生成这一章') : generationState.statusTitle}
            className="mb-0"
          />
          <div className="workbench-prose-actions">
            <button type="button" className={ghostButtonClass} onClick={onSetPromptPreview}>
              预览 Prompt
            </button>
            <GenerationSettingsPopover
              draftChapterPlan={draftChapterPlan}
              loadingChapter={loadingChapter}
              isGenerating={isGenerating}
              onUpdateGenerationSetting={onUpdateGenerationSetting}
            />
            {isGenerating ? (
              <button
                type="button"
                className={ghostButtonClass}
                onClick={onStopGeneration}
              >
                停止
              </button>
            ) : null}
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onGenerateChapter}
              disabled={!canGenerate || isGenerating}
            >
              {isGenerating ? '生成中' : '生成'}
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onOpenRevisionEditor}
              disabled={!generationState.hasContent}
            >
              查看/校改正文
            </button>
          </div>
        </section>
        <WorkbenchSection
          code="PROSE"
          title={generationPreviewVisible ? '生成预览' : (generationState.hasContent ? '正文' : '生成结果')}
          contentClassName="gap-6"
        >
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
                    <strong>剧情线</strong>
                    <small>{storylineStatusLabel}</small>
                  </span>
                  <em>选择剧情线</em>
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
              <button
                type="button"
                className={primaryButtonClass}
                onClick={onGenerateChapter}
                disabled={!canGenerate || isGenerating}
              >
                生成正文
              </button>
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
                  paragraphClassName="cn-text-paragraph font-serif text-[17px] leading-9 text-[color:var(--text)]"
                />
              </div>
            </section>
          )}
        </WorkbenchSection>
        {hasResultMeta ? (
          <section className="workbench-result-footer" aria-label="生成后检查">
            <div className="workbench-result-footer-head">
              <MetaCode>AFTER</MetaCode>
              <strong>生成后查</strong>
            </div>
            <div className="workbench-result-footer-list">
              <DrawerEntry
                title={qualityLabel}
                tone={generationState.storylineProgressError ? 'danger' : (generationState.qualityCheck?.kind || 'default')}
                onOpen={() => setActiveMetaDrawer('result-check')}
              />
              <DrawerEntry
                title={storylineProgressLabel}
                tone={generationState.storylineProgressError ? 'danger' : 'default'}
                onOpen={() => setActiveMetaDrawer('result-check')}
              />
              <DrawerEntry
                title="反馈与下一步"
                onOpen={() => setActiveMetaDrawer('feedback')}
              />
            </div>
          </section>
        ) : null}
      </section>
    </div>
    <ContextDrawer open={activeMetaDrawer === 'result-check'} title="结果检查" onClose={() => setActiveMetaDrawer(null)}>
      <div className="drawer-detail-stack">
        <section className="drawer-detail-card">
          <StatusNotice
            kind={generationState.qualityCheck?.kind || 'warning'}
            title={qualityLabel}
            text={generationState.qualityCheck?.summary || '生成完成后，这里会展示本章质检状态。'}
            className="mb-0"
          />
        </section>
        <section className="drawer-detail-card">
          <strong className="drawer-cn-heading">剧情线推进</strong>
          <p className="mt-2 text-[15px] leading-8 text-[color:var(--muted)]">
            {storylineProgressLabel}
            {generationState.storylineProgressUpdated ? ' · 已写回剧情线进度' : ''}
          </p>
          {generationState.storylineProgressError ? (
            <p className="mt-2 text-[13px] font-semibold leading-6 text-[color:#b34343]">写回失败：{generationState.storylineProgressError}</p>
          ) : null}
          <IndentedTextBlock text={generationState.storylineProgress?.summary || generationState.qualityCheck?.storylineAudit?.summary || '暂无剧情线推进摘要'} className="mt-3" paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]" />
        </section>
        <section className="drawer-detail-card">
          <strong className="drawer-cn-heading">通过点</strong>
          <IndentedTextBlock text={(generationState.qualityCheck?.signals || []).join('\n') || '当前没有额外通过信号。'} className="mt-3" paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]" />
        </section>
        <section className="drawer-detail-card">
          <strong className="drawer-cn-heading">风险提醒</strong>
          <IndentedTextBlock text={(generationState.qualityCheck?.risks || []).join('\n') || '当前没有额外风险提醒。'} className="mt-3" paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]" />
        </section>
        <section className="drawer-detail-card">
          <strong className="drawer-cn-heading">空降设定</strong>
          <IndentedTextBlock text={(generationState.qualityCheck?.airdropItems || []).join('\n') || '当前没有检测到明显空降设定。'} className="mt-3" paragraphClassName="cn-text-paragraph text-[14px] leading-7 text-[color:var(--muted)]" />
        </section>
      </div>
    </ContextDrawer>
    <ContextDrawer open={activeMetaDrawer === 'feedback'} title="本章反馈" onClose={() => setActiveMetaDrawer(null)}>
      <div className="drawer-detail-stack">
        <section className="drawer-detail-card">
          <strong className="drawer-cn-heading">本章反馈</strong>
          <IndentedTextBlock text={generationState.feedbackSummary} className="mt-3" paragraphClassName="cn-text-paragraph text-[15px] leading-8 text-[color:var(--muted)]" />
        </section>
        <section className="drawer-detail-card">
          <strong className="drawer-cn-heading">下一步关注</strong>
          <IndentedTextBlock text={generationState.feedbackFocus} className="mt-3" paragraphClassName="cn-text-paragraph text-[15px] leading-8 text-[color:var(--muted)]" />
        </section>
      </div>
    </ContextDrawer>
    </>
  );
}

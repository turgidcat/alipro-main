import { useEffect, useState } from 'react';
import WorkbenchSection from './WorkbenchSection.jsx';
import MetaCode from './MetaCode.jsx';
import StatusNotice from './StatusNotice.jsx';
import {
  buildOutlineExcerpt,
  describeRoleExecutionMeta,
  getLatestChapterOutline,
  getOutlineSourceLabel,
  hasUsableChapterOutline
} from '../../lib/chapterPlan.js';
import { formatStorylineTypeLabel } from '../../lib/storylineLabel.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

const ghostButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_84%,transparent)] px-3.5 text-[13px] font-medium text-[color:var(--text)] transition hover:border-[color:color-mix(in_srgb,var(--brand-soft-strong)_45%,var(--line))] hover:text-[color:var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-60';

const primaryButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--brand-soft-strong)_72%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand)_10%,var(--surface))] px-4 text-[13px] font-semibold text-[color:var(--brand-deep)] transition hover:bg-[color:color-mix(in_srgb,var(--brand)_16%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-60';

const statusChipClass =
  'inline-flex min-h-8 items-center rounded-md border border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_78%,transparent)] px-3 text-[13px] font-medium text-[color:var(--brand-deep)]';

function normalizeText(value) {
  return String(value || '').trim();
}

function splitParagraphs(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function ChapterConfigPanel(props) {
  const {
    draftChapterPlan,
    chapterView,
    storylineOptions,
    selectedTargetStorylines,
    storylineRhythmHints,
    hasOutlineAnchor,
    savingState,
    selectedBookId,
    onSaveChapterPlan,
    onOpenOutlineModal,
    onOpenCharacterModal,
    onOpenStorylineCreator,
    onOpenStorylineEditor,
    onClearStorylineSelection,
    onSelectMainStoryline,
    onToggleTargetStoryline,
    onAdjustStorylineRange,
    onContextChipClick,
    activeDrawer
  } = props;

  const rhythmHintById = new Map(
    Array.isArray(storylineRhythmHints)
      ? storylineRhythmHints.map((hint) => [hint.id, hint])
      : []
  );
  const hasMainStoryline = String(draftChapterPlan.main_storyline_id || '').trim().length > 0;
  const hasMountedStorylines = Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.length > 0;
  const earlyStartHints = Array.isArray(draftChapterPlan.target_storylines)
    ? draftChapterPlan.target_storylines
      .map((id) => rhythmHintById.get(id))
      .filter((hint) => hint?.actionField === 'start')
    : [];
  const effectiveOutlineAnchor = typeof hasOutlineAnchor === 'boolean'
    ? hasOutlineAnchor
    : hasUsableChapterOutline(draftChapterPlan);
  const latestOutline = getLatestChapterOutline(draftChapterPlan);
  const outlineSourceLabel = getOutlineSourceLabel(draftChapterPlan.source);
  const outlineSummaryText = buildOutlineExcerpt(latestOutline, '尚未建立章节细纲');
  const [outlineExpanded, setOutlineExpanded] = useState(false);
  const canExpandOutline = Boolean(latestOutline) && normalizeText(outlineSummaryText) !== normalizeText(latestOutline);
  const displayOutlineParagraphs = splitParagraphs(outlineExpanded ? latestOutline : outlineSummaryText);
  const storylineStatusNotice = !effectiveOutlineAnchor
    ? {
        kind: 'warning',
        title: '新章节还不能直接进入稳定生成状态',
        text: '先点“编辑细纲”，补齐本章目标、关键场景、结尾钩子并保存任务表；保存后生成按钮会自动亮起。'
      }
    : !hasMountedStorylines
      ? {
          kind: 'warning',
          title: '已经可以生成，但建议先挂 1 条剧情线',
          text: '剧情线不是硬性门槛，但先挂载再生成，更容易让第 2、3 章承接前文。'
        }
      : !hasMainStoryline
        ? {
            kind: 'warning',
            title: '剧情线已挂载，还差“本章主推”这一步',
            text: '点某条剧情线右侧的“本章主推”，能让系统更明确知道这一章主要推进哪条线。'
          }
        : {
            kind: 'success',
            title: '本章挂载路径已清楚',
            text: '任务表已具备，剧情线也已挂载并指定主推，可以继续生成或切换章节。'
          };

  useEffect(() => {
    setOutlineExpanded(false);
  }, [latestOutline, draftChapterPlan.source]);

  return (
    <div className="grid min-w-0 max-w-full gap-6 overflow-x-hidden px-4 py-4">
      <WorkbenchSection code="PROJECT" title="基础信息" contentClassName="gap-4">
        <div className="grid min-w-0 gap-4 overflow-x-hidden">
          <section className="min-w-0 border-l border-[color:color-mix(in_srgb,var(--brand-soft-strong)_52%,var(--line))] pl-4">
            <MetaCode>VOLUME</MetaCode>
            <p className="mt-1 text-[14px] font-semibold leading-6 text-[color:var(--text)]">所属卷</p>
            <p className="mt-1 break-words text-[15px] font-semibold leading-7 text-[color:var(--text)]">
              {chapterView.volumeLabel || '第 1 卷'}
            </p>
          </section>

          <section className="min-w-0 border-l border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] pl-4">
            <MetaCode>VOLUME TASK</MetaCode>
            <p className="mt-1 text-[14px] font-semibold leading-6 text-[color:var(--text)]">卷任务</p>
            <p className="mt-1 break-words text-[13px] leading-6 text-[color:var(--muted)]">
              {chapterView.volumeSummary || '当前卷任务暂未填写'}
            </p>
          </section>
        </div>
      </WorkbenchSection>

      <WorkbenchSection
        code="CHAPTER CONFIG"
        title="章节配置"
        contentClassName="gap-5"
        actions={
          <div className="flex min-w-0 flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              className={ghostButtonClass}
              onClick={onOpenStorylineCreator}
              disabled={!selectedBookId}
            >
              新建剧情线
            </button>
            <button
              type="button"
              className={ghostButtonClass}
              onClick={onClearStorylineSelection}
              disabled={!selectedBookId || selectedTargetStorylines.length === 0}
            >
              清空选择
            </button>
            <button
              type="button"
              className={primaryButtonClass}
              onClick={onSaveChapterPlan}
              disabled={!selectedBookId || savingState.loading}
            >
              保存本章挂载
            </button>
          </div>
        }
      >
        <StatusNotice
          kind={storylineStatusNotice.kind}
          title={storylineStatusNotice.title}
          text={storylineStatusNotice.text}
          className="mb-0"
        />

        <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-x-hidden">
          <span className={statusChipClass}>已挂载 {selectedTargetStorylines.length} 条剧情线</span>
          <span className={statusChipClass}>{hasMainStoryline ? '已指定本章主推' : '尚未指定本章主推'}</span>
          <span className={statusChipClass}>{effectiveOutlineAnchor ? '已有细纲锚点' : '缺少细纲锚点'}</span>
        </div>

        {(!hasMainStoryline && hasMountedStorylines) || (!effectiveOutlineAnchor && !hasMountedStorylines) || earlyStartHints.length > 0 ? (
          <section className="min-w-0 border-l border-[color:color-mix(in_srgb,#d86a6a_56%,transparent)] bg-[color:rgba(255,244,244,0.52)] pl-4 pr-3 py-3">
            <MetaCode className="text-[color:#b34343]">CAUTION</MetaCode>
            <div className="mt-2 grid gap-2">
              {!hasMainStoryline && hasMountedStorylines ? (
                <p className="text-[13px] font-semibold leading-6 text-[color:#b34343]">
                  已挂载剧情线，但还没有指定本章主推。
                </p>
              ) : null}
              {!effectiveOutlineAnchor && !hasMountedStorylines ? (
                <p className="text-[13px] font-semibold leading-6 text-[color:#b34343]">
                  当前没有章节细纲，也没有剧情线挂载，暂不建议生成。
                </p>
              ) : null}
              {earlyStartHints.map((hint) => (
                <p key={hint.id} className="text-[13px] font-semibold leading-6 text-[color:#b34343] break-words">
                  {hint.storyline?.name || '该剧情线'}未到开启章节，原定第 {hint.storyline?.startChapter || '?'} 章启动。
                </p>
              ))}
            </div>
          </section>
        ) : null}

        {storylineOptions.length > 0 ? (
          <div className="min-w-0 overflow-x-hidden border-t border-[color:color-mix(in_srgb,var(--line)_58%,transparent)]">
            {storylineOptions.map((storyline) => {
              const isSelected =
                Array.isArray(draftChapterPlan.target_storylines) &&
                draftChapterPlan.target_storylines.includes(storyline.id);
              const hint = rhythmHintById.get(storyline.id);

              return (
                <label
                  key={storyline.id}
                  className={
                    'grid min-w-0 gap-3 border-b py-4 last:border-b-0 ' +
                    (isSelected
                      ? 'border-[color:color-mix(in_srgb,var(--brand-soft-strong)_44%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand)_6%,transparent)]'
                      : 'border-[color:color-mix(in_srgb,var(--line)_48%,transparent)]')
                  }
                >
                  <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
                    <input
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleTargetStoryline(storyline.id)}
                    />

                    <div className="min-w-0">
                      <div className="flex min-w-0 flex-wrap items-start justify-between gap-2">
                        <span className="min-w-0 break-words text-[14px] font-semibold leading-6 text-[color:var(--text)]">
                          第 {storyline.volumeNumber} 卷 · {storyline.name}
                        </span>
                        {isSelected ? (
                          <span className="shrink-0 text-[13px] font-medium leading-6 text-[color:var(--brand-deep)]">
                            已挂载
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 break-words text-[13px] leading-6 text-[color:var(--muted)]">
                        {formatStorylineTypeLabel(storyline.type)} / 预计第 {storyline.startChapter}-{storyline.endChapter} 章
                      </p>

                      {isSelected && hint?.actionField && hint.actionField !== 'start' ? (
                        <p className="mt-1 break-words text-[13px] leading-6 text-[color:var(--brand-deep)]">
                          已超原定范围，原定第 {storyline.endChapter} 章收束
                        </p>
                      ) : null}

                      {isSelected ? (
                        <p className="mt-1 break-words text-[13px] leading-6 text-[color:var(--brand-deep)]">
                          {draftChapterPlan.main_storyline_id === storyline.id
                            ? '已挂载，且当前就是本章主推。'
                            : '已挂载；如果这章主要推进这条线，再点一次“本章主推”。'}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2 pl-7">
                    {isSelected && hint?.actionLabel && hint?.actionField !== 'start' ? (
                      <button
                        type="button"
                        className={ghostButtonClass}
                        onClick={(event) => {
                          event.preventDefault();
                          if (hint?.actionLabel) {
                            onAdjustStorylineRange(hint.storyline, hint.actionField);
                          }
                        }}
                        disabled={savingState.loading}
                      >
                        {hint.actionLabel}
                      </button>
                    ) : null}

                    <button
                      type="button"
                      className={
                        draftChapterPlan.main_storyline_id === storyline.id
                          ? primaryButtonClass
                          : ghostButtonClass
                      }
                      onClick={(event) => {
                        event.preventDefault();
                        onSelectMainStoryline(storyline.id);
                      }}
                    >
                      {draftChapterPlan.main_storyline_id === storyline.id ? '当前主推' : '本章主推'}
                    </button>

                    <button
                      type="button"
                      className={ghostButtonClass}
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenStorylineEditor(storyline);
                      }}
                    >
                      编辑
                    </button>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-[14px] leading-7 text-[color:var(--muted)]">当前还没有剧情线，可先用演示书测试。</p>
        )}
      </WorkbenchSection>

      <WorkbenchSection
        code="OUTLINE"
        title="章节细纲"
        actions={
          <button type="button" className={primaryButtonClass} onClick={onOpenOutlineModal}>
            编辑细纲
          </button>
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-x-hidden">
          <span className={statusChipClass}>{latestOutline ? `${latestOutline.length} 字` : '未填写'}</span>
          <span className={statusChipClass}>{outlineSourceLabel}</span>
        </div>

        <section className="min-w-0 border-l border-[color:color-mix(in_srgb,var(--brand-soft-strong)_48%,var(--line))] pl-4">
          <MetaCode>SUMMARY</MetaCode>
          <div className="cn-text-block mt-2 min-w-0">
            {displayOutlineParagraphs.map((paragraph, index) => {
              const isLastParagraph = index === displayOutlineParagraphs.length - 1;
              return (
                <p
                  key={`${index}-${paragraph.slice(0, 12)}`}
                  className="cn-text-paragraph break-words text-[14px] leading-7 text-[color:var(--text)]"
                >
                  {paragraph}
                  {canExpandOutline && isLastParagraph ? (
                    <button
                      type="button"
                      className="ml-2 inline border-0 bg-transparent p-0 text-[13px] font-medium text-[color:color-mix(in_srgb,var(--brand)_78%,white)] underline-offset-2 transition hover:text-[color:var(--brand-deep)] hover:underline"
                      onClick={() => setOutlineExpanded((current) => !current)}
                    >
                      {outlineExpanded ? '收起' : '展开'}
                    </button>
                  ) : null}
                </p>
              );
            })}
          </div>
        </section>
      </WorkbenchSection>

      <WorkbenchSection
        code="CAST"
        title="角色相关配置"
        actions={
          <button type="button" className={primaryButtonClass} onClick={onOpenCharacterModal}>
            编辑角色
          </button>
        }
      >
        <div className="flex min-w-0 flex-wrap items-center gap-3 overflow-x-hidden">
          <span className={statusChipClass}>章内要点</span>
          <span className="text-[13px] font-medium leading-6 text-[color:var(--brand-deep)]">
            {draftChapterPlan.character_notes ? '已补充' : '可留空'}
          </span>
        </div>

        <section className="min-w-0 border-l border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] pl-4">
          <MetaCode>NOTES</MetaCode>
          <p className="mt-2 break-words text-[14px] leading-7 text-[color:var(--muted)]">
            {draftChapterPlan.character_notes || '还没有角色说明。'}
          </p>
        </section>

        {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0 ? (
          <div className="min-w-0 overflow-x-hidden border-t border-[color:color-mix(in_srgb,var(--line)_58%,transparent)]">
            {draftChapterPlan.role_execution.slice(0, 3).map((item, index) => (
              <section
                key={`${item.role || 'role'}-${index}`}
                className="min-w-0 border-b border-[color:color-mix(in_srgb,var(--line)_48%,transparent)] py-4 last:border-b-0"
              >
                <MetaCode>ROLE {String(index + 1).padStart(2, '0')}</MetaCode>
                <p className="mt-2 break-words text-[13px] leading-6 text-[color:var(--text)]">
                  <strong>{item.role || '未命名角色'}：</strong>
                  {item.chapter_function || item.allowed_change || '本章角色执行要求待补充'}
                </p>
                <p className="mt-1 break-words text-[13px] leading-6 text-[color:var(--muted)]">
                  {describeRoleExecutionMeta(item)}
                </p>
              </section>
            ))}
          </div>
        ) : null}
      </WorkbenchSection>

      <WorkbenchSection code="TOOLS" title="资料入口">
        <div className="flex min-w-0 flex-wrap gap-3 overflow-x-hidden">
          {[
            ['book', '全书设定'],
            ['storyline', '剧情线'],
            ['character', '角色档案'],
            ['volume', '分卷规划']
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={joinClasses(
                'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border px-3.5 text-[13px] font-medium transition',
                activeDrawer === key
                  ? 'border-[color:color-mix(in_srgb,var(--brand-soft-strong)_72%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand)_12%,var(--surface))] text-[color:var(--brand-deep)]'
                  : 'border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_84%,transparent)] text-[color:var(--text)] hover:border-[color:color-mix(in_srgb,var(--brand-soft-strong)_45%,var(--line))] hover:text-[color:var(--brand-deep)]'
              )}
              onClick={() => onContextChipClick(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </WorkbenchSection>
    </div>
  );
}

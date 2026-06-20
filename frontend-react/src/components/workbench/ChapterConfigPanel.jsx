import { useEffect, useState } from 'react';
import PanelCard from './PanelCard.jsx';
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

const fieldLabelClass = 'mb-1.5 block font-serif text-[13px] font-semibold tracking-[0.04em] text-[color:var(--brand-deep)]';
const inputClass = 'min-h-10 w-full rounded-[14px] border border-[color:var(--line)] bg-[color:color-mix(in_srgb,var(--panel-note-bg)_64%,white)] px-4 text-[14px] text-[color:var(--text)] shadow-none outline-none transition focus:border-[color:var(--brand-soft-strong)] focus:bg-[var(--panel)]';
const insetSurfaceClass = 'rounded-[16px] border border-[color:color-mix(in_srgb,var(--line)_68%,transparent)] bg-[color:rgba(255,252,246,0.42)] px-3 py-3';
const insetTitleClass = 'font-serif text-[13px] font-semibold tracking-[0.04em] text-[color:var(--brand-deep)]';

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

  useEffect(() => {
    setOutlineExpanded(false);
  }, [latestOutline, draftChapterPlan.source]);

  return (
    <>
      <PanelCard
        variant="flat"
        eyebrow="剧情线挂载"
        title="本章挂载哪些推进线"
        bodyClassName="space-y-3.5"
        actionsClassName="justify-between"
        actions={
          <>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="ghost-btn" onClick={onOpenStorylineCreator} disabled={!selectedBookId}>
                新建剧情线
              </button>
              <button type="button" className="ghost-btn" onClick={onClearStorylineSelection} disabled={!selectedBookId || selectedTargetStorylines.length === 0}>
                清空选择
              </button>
            </div>
            <button type="button" className="solid-btn" onClick={onSaveChapterPlan} disabled={!selectedBookId || savingState.loading}>
              保存本章挂载
            </button>
          </>
        }
      >
        <div className="grid gap-3 xl:grid-cols-[180px_minmax(0,1fr)]">
          <div className={insetSurfaceClass}>
            <p className={insetTitleClass}>所属卷</p>
            <p className="mt-1.5 text-[14px] font-semibold text-[color:var(--text)]">{chapterView.volumeLabel || '第 1 卷'}</p>
          </div>
          <div className={insetSurfaceClass}>
            <p className={insetTitleClass}>卷任务</p>
            <p className="mt-1.5 text-[13px] leading-6 text-[color:var(--text)]">{chapterView.volumeSummary || '当前卷任务暂未填写'}</p>
          </div>
        </div>

        <div className="space-y-2.5">
          <span className={fieldLabelClass}>挂载剧情线</span>
          {(!hasMainStoryline && hasMountedStorylines) || (!effectiveOutlineAnchor && !hasMountedStorylines) || earlyStartHints.length > 0 ? (
            <div className="rounded-[16px] border border-[color:color-mix(in_srgb,#d86a6a_48%,transparent)] bg-[color:rgba(255,244,244,0.78)] px-3 py-2.5">
              <div className="space-y-1">
                {!hasMainStoryline && hasMountedStorylines ? (
                  <p className="text-[12px] font-semibold leading-5 text-[color:#b34343]">
                    已挂载剧情线，但还没有指定本章主推。
                  </p>
                ) : null}
                {!effectiveOutlineAnchor && !hasMountedStorylines ? (
                  <p className="text-[12px] font-semibold leading-5 text-[color:#b34343]">
                    当前没有章节细纲，也没有剧情线挂载，暂不建议生成。
                  </p>
                ) : null}
                {earlyStartHints.map((hint) => (
                  <p key={hint.id} className="text-[12px] font-semibold leading-5 text-[color:#b34343]">
                    {hint.storyline?.name || '该剧情线'}未到开启章节，原定第 {hint.storyline?.startChapter || '?'} 章启动。
                  </p>
                ))}
              </div>
            </div>
          ) : null}
          {storylineOptions.length > 0 ? (
            <div className="divide-y divide-[color:color-mix(in_srgb,var(--line)_68%,transparent)] rounded-[18px] border border-[color:color-mix(in_srgb,var(--line)_82%,transparent)] bg-[color:rgba(255,252,246,0.28)] px-3.5">
              {storylineOptions.map((storyline) => (
                <label
                  key={storyline.id}
                  className="grid gap-2 py-3 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
                >
                  <input
                    className="mt-1 h-4 w-4 accent-[var(--brand)]"
                    type="checkbox"
                    checked={Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.includes(storyline.id)}
                    onChange={() => onToggleTargetStoryline(storyline.id)}
                  />
                  <span className="space-y-1">
                    <span className="block text-[14px] font-semibold text-[color:var(--text)]">
                      第 {storyline.volumeNumber} 卷 · {storyline.name}
                    </span>
                    <span className="block text-[12px] leading-5 text-[color:var(--muted)]">
                      {formatStorylineTypeLabel(storyline.type)} / 预计第 {storyline.startChapter}-{storyline.endChapter} 章
                    </span>
                    {Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.includes(storyline.id) ? (
                      (() => {
                        const hint = rhythmHintById.get(storyline.id);
                        if (!hint || hint.actionField === 'start' || !hint.actionField) return null;
                        return (
                          <span className="block text-[12px] leading-5 text-[color:var(--brand-deep)]">
                            已超原定范围，原定第 {storyline.endChapter} 章收束
                          </span>
                        );
                      })()
                    ) : null}
                  </span>
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    {Array.isArray(draftChapterPlan.target_storylines) &&
                    draftChapterPlan.target_storylines.includes(storyline.id) &&
                    rhythmHintById.get(storyline.id)?.actionLabel &&
                    rhythmHintById.get(storyline.id)?.actionField !== 'start' ? (
                      <button
                        type="button"
                        className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--line)] px-3 text-[12px] font-semibold text-[color:var(--brand)] transition hover:border-[color:var(--brand-soft-strong)] hover:bg-[var(--brand-soft)]"
                        onClick={(event) => {
                          event.preventDefault();
                          const hint = rhythmHintById.get(storyline.id);
                          if (hint?.actionLabel) {
                            onAdjustStorylineRange(hint.storyline, hint.actionField);
                          }
                        }}
                        disabled={savingState.loading}
                      >
                        {rhythmHintById.get(storyline.id)?.actionLabel}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className={
                        'inline-flex min-h-9 items-center justify-center rounded-full border px-3 text-[12px] font-semibold transition ' +
                        (draftChapterPlan.main_storyline_id === storyline.id
                          ? 'border-[color:transparent] bg-[var(--brand)] text-[var(--btn-solid-text)] shadow-[var(--btn-nav-primary-shadow)]'
                          : 'border-[color:var(--line)] text-[color:var(--brand)] hover:border-[color:var(--brand-soft-strong)] hover:bg-[var(--brand-soft)]')
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
                      className="inline-flex min-h-9 items-center justify-center rounded-full border border-[color:var(--line)] px-3 text-[12px] font-semibold text-[color:var(--brand)] transition hover:border-[color:var(--brand-soft-strong)] hover:bg-[var(--brand-soft)]"
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenStorylineEditor(storyline);
                      }}
                    >
                      编辑
                    </button>
                  </div>
                </label>
              ))}
            </div>
          ) : (
            <p className="text-[14px] leading-7 text-[color:var(--muted)]">当前还没有剧情线，可先用演示书测试。</p>
          )}
        </div>
      </PanelCard>

      <PanelCard
        variant="flat"
        eyebrow="章节细纲"
        title="当前最新细纲"
        bodyClassName="space-y-3"
        headerActions={<button type="button" className="solid-btn" onClick={onOpenOutlineModal}>编辑细纲</button>}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:rgba(255,252,246,0.52)] px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-deep)]">
            {latestOutline ? `${latestOutline.length} 字` : '未填写'}
          </span>
          <span className="inline-flex rounded-full border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:rgba(255,252,246,0.52)] px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-deep)]">
            {outlineSourceLabel}
          </span>
        </div>
        <div className={insetSurfaceClass}>
          <p className={insetTitleClass}>摘要</p>
          <div className="cn-text-block mt-1.5">
            {displayOutlineParagraphs.map((paragraph, index) => {
              const isLastParagraph = index === displayOutlineParagraphs.length - 1;
              return (
                <p key={`${index}-${paragraph.slice(0, 12)}`} className="cn-text-paragraph text-[14px] leading-6 text-[color:var(--text)]">
                  {paragraph}
                  {canExpandOutline && isLastParagraph ? (
                    <>
                      <button
                        type="button"
                        className="ml-2 inline border-0 bg-transparent p-0 text-[13px] font-medium text-[color:color-mix(in_srgb,var(--brand)_78%,white)] underline-offset-2 transition hover:text-[color:var(--brand-deep)] hover:underline"
                        onClick={() => setOutlineExpanded((current) => !current)}
                      >
                        {outlineExpanded ? '收起' : '展开'}
                      </button>
                    </>
                  ) : null}
                </p>
              );
            })}
          </div>
        </div>
      </PanelCard>

      <PanelCard
        variant="flat"
        eyebrow="章节角色"
        title="本章出场角色"
        bodyClassName="space-y-3.5"
        headerActions={<button type="button" className="solid-btn" onClick={onOpenCharacterModal}>编辑角色</button>}
      >
        <div className="flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full bg-[color:color-mix(in_srgb,var(--brand-soft)_72%,var(--panel))] px-3 py-1 text-[12px] font-semibold text-[color:var(--brand-deep)]">
            建议信息
          </span>
          <p className="text-[14px] font-semibold text-[color:var(--brand)]">{draftChapterPlan.character_notes ? '已补充' : '可留空'}</p>
        </div>
        <p className="text-[14px] leading-7 text-[color:var(--muted)]">{draftChapterPlan.character_notes || '还没有角色说明。'}</p>
        {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0 ? (
          <div className="divide-y divide-[color:color-mix(in_srgb,var(--line)_68%,transparent)]">
            {draftChapterPlan.role_execution.slice(0, 3).map((item, index) => (
              <div key={`${item.role || 'role'}-${index}`} className="py-3 first:pt-0 last:pb-0">
                <p className="text-[13px] leading-6 text-[color:var(--text)]">
                  <strong>{item.role || '未命名角色'}：</strong>
                  {item.chapter_function || item.allowed_change || '本章角色执行要求待补充'}
                </p>
                <p className="mt-1 text-[12px] leading-5 text-[color:var(--muted)]">{describeRoleExecutionMeta(item)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </PanelCard>

      <div className="flex flex-wrap gap-3 border-t border-[color:var(--line)] pt-5">
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
              'rounded-full border px-4 py-2 text-[12px] font-bold transition',
              activeDrawer === key
                ? 'border-[color:transparent] bg-[var(--brand)] text-[var(--btn-solid-text)] shadow-[var(--btn-nav-primary-shadow)]'
                : 'border-[color:var(--line)] bg-transparent text-[color:var(--brand-deep)] hover:border-[color:var(--brand-soft-strong)] hover:bg-[var(--brand-soft)] hover:text-[color:var(--brand)]'
            )}
            onClick={() => onContextChipClick(key)}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  );
}

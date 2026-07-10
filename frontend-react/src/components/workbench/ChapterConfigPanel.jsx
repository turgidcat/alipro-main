import MetaCode from './MetaCode.jsx';
import { formatStorylineTypeLabel } from '../../lib/storylineLabel.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

const ghostButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--line)_72%,transparent)] bg-[color:color-mix(in_srgb,var(--surface)_84%,transparent)] px-3.5 text-[13px] font-medium text-[color:var(--text)] transition hover:border-[color:color-mix(in_srgb,var(--brand-soft-strong)_45%,var(--line))] hover:text-[color:var(--brand-deep)] disabled:cursor-not-allowed disabled:opacity-60';

const primaryButtonClass =
  'appearance-none inline-flex min-h-9 items-center justify-center rounded-md border border-[color:color-mix(in_srgb,var(--brand-soft-strong)_72%,var(--line))] bg-[color:color-mix(in_srgb,var(--brand)_10%,var(--surface))] px-4 text-[13px] font-semibold text-[color:var(--brand-deep)] transition hover:bg-[color:color-mix(in_srgb,var(--brand)_16%,var(--surface))] disabled:cursor-not-allowed disabled:opacity-60';

function SidebarSection({
  code,
  title,
  badge,
  children,
  className = ''
}) {
  return (
    <section className={joinClasses('workbench-sidebar-section', className)}>
      <div className="workbench-sidebar-section-heading">
        <span className="workbench-sidebar-group-title">
          {code ? <MetaCode>{code}</MetaCode> : null}
          <strong>{title}</strong>
        </span>
        {badge ? <span className="workbench-sidebar-group-badge">{badge}</span> : null}
      </div>
      <div className="workbench-sidebar-group-body">
        {children}
      </div>
    </section>
  );
}

export default function ChapterConfigPanel(props) {
  const {
    sectionMode = 'all',
    draftChapterPlan,
    storylineOptions,
    selectedTargetStorylines,
    storylineRhythmHints,
    savingState,
    selectedBookId,
    onSaveChapterPlan,
    onClearStorylineSelection,
    onToggleTargetStoryline,
    onAdjustStorylineRange,
    onContextChipClick,
    activeDrawer,
    showActionRow = true
  } = props;

  const rhythmHintById = new Map(
    Array.isArray(storylineRhythmHints)
      ? storylineRhythmHints.map((hint) => [hint.id, hint])
      : []
  );
  const hasMainStoryline = String(draftChapterPlan.main_storyline_id || '').trim().length > 0;
  const hasMountedStorylines = Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.length > 0;
  const supportItems = [
    ['outline', '章节细纲'],
    ['character-config', '角色相关配置'],
    ['book', '作品设定'],
    ['storyline', '叙事脉络'],
    ['character', '角色档案'],
    ['volume', '分卷规划']
  ];

  if (sectionMode === 'support') {
    return (
      <div className="workbench-sidebar-title-list">
        {supportItems.map(([key, label]) => (
          <button
            key={key}
            type="button"
            className={joinClasses(
              'workbench-sidebar-title-button',
              activeDrawer === key ? 'is-active' : ''
            )}
            onClick={() => onContextChipClick(key)}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className="workbench-sidebar-groups">
      {(sectionMode === 'all' || sectionMode === 'config') ? (
        <SidebarSection
          code=""
          title="本章叙事脉络"
          badge={hasMainStoryline ? '主线已挂载' : `${selectedTargetStorylines.length} 条`}
        >
        {showActionRow ? (
        <div className="workbench-sidebar-action-row">
          <button
            type="button"
            className={ghostButtonClass}
            onClick={onClearStorylineSelection}
            disabled={!selectedBookId || selectedTargetStorylines.length === 0}
          >
            清空支线
          </button>
          <button
            type="button"
            className={primaryButtonClass}
            onClick={onSaveChapterPlan}
            disabled={!selectedBookId || savingState.loading}
          >
            保存
          </button>
        </div>
        ) : null}

        {storylineOptions.length > 0 ? (
          <div className="workbench-sidebar-storyline-list">
            {storylineOptions.map((storyline) => {
              const isSelected =
                Array.isArray(draftChapterPlan.target_storylines) &&
                draftChapterPlan.target_storylines.includes(storyline.id);
              const hint = rhythmHintById.get(storyline.id);

              return (
                <label
                  key={storyline.id}
                  className={
                    'workbench-sidebar-storyline-item ' +
                    (isSelected
                      ? 'is-selected'
                      : '')
                  }
                >
                  <div className="workbench-sidebar-storyline-row">
                    <input
                      className="mt-1 h-4 w-4 shrink-0 accent-[var(--brand)]"
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleTargetStoryline(storyline.id)}
                    />

                    <div className="min-w-0">
                      <div className="workbench-sidebar-storyline-title-row">
                        <span className="min-w-0 break-words text-[14px] font-semibold leading-6 text-[color:var(--text)]">
                          第 {storyline.volumeNumber} 卷 · {storyline.name}
                        </span>
                        <div className="workbench-sidebar-storyline-actions">
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

                        </div>
                      </div>

                      <p className="break-words text-[12px] leading-5 text-[color:var(--muted)]">
                        {formatStorylineTypeLabel(storyline.type)} / 预计第 {storyline.startChapter}-{storyline.endChapter} 章{isSelected ? ' / 已挂载' : ''}
                      </p>

                      {isSelected && hint?.actionField && hint.actionField !== 'start' ? (
                        <p className="break-words text-[12px] leading-5 text-[color:var(--brand-deep)]">
                          已超原定范围，原定第 {storyline.endChapter} 章收束
                        </p>
                      ) : null}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        ) : (
          <p className="text-[14px] leading-7 text-[color:var(--muted)]">当前还没有叙事脉络，可先从资料库创建主线或支线。</p>
        )}
        </SidebarSection>
      ) : null}

      {sectionMode === 'all' ? (
        <div className="workbench-sidebar-title-list">
          {supportItems.map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={joinClasses(
                'workbench-sidebar-title-button',
                activeDrawer === key ? 'is-active' : ''
              )}
              onClick={() => onContextChipClick(key)}
            >
              {label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

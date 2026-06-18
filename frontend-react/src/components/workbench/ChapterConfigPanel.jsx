import PanelCard from './PanelCard.jsx';
import { describeRoleExecutionMeta } from '../../lib/chapterPlan.js';

export default function ChapterConfigPanel(props) {
  const {
    chapterNumber,
    draftChapterPlan,
    chapterContext,
    chapterView,
    storylineOptions,
    selectedMainStorylineLabel,
    selectedTargetStorylineLabel,
    selectedTargetStorylines,
    storylineRhythmHints,
    savingState,
    loadingChapter,
    selectedBookId,
    onChapterNumberChange,
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

  return (
    <>
      <PanelCard
        eyebrow="章节入口"
        title={'第 ' + chapterNumber + ' 章 · ' + (draftChapterPlan.chapter_name || '未命名章节')}
        description="这一层只处理本章要写什么。"
      >
        <div className="chapter-control-row">
          <label className="editor-field chapter-number-field">
            <span>当前章号</span>
            <input
              className="chapter-number-input"
              type="number"
              min="1"
              value={chapterNumber}
              onChange={(event) => onChapterNumberChange(Math.max(1, Number(event.target.value) || 1))}
            />
          </label>
          <div className="chapter-context-note">{loadingChapter ? '正在读取本章计划...' : chapterContext.latestChapterLabel}</div>
        </div>
        <ul className="meta-list">
          <li>当前卷：{chapterView.volumeLabel || '第 1 卷'}</li>
          <li>主剧情线：{selectedMainStorylineLabel}</li>
          <li>章节任务：{draftChapterPlan.chapter_mission || '建议补充本章推进目标'}</li>
          <li>情绪目标：{draftChapterPlan.emotion_target || '建议补充本章情绪方向'}</li>
        </ul>
        {(chapterContext.previousFeedbackLabel || chapterContext.previousFeedbackFocus) ? (
          <div className="chapter-feedback-carryover">
            <span>上一章反馈</span>
            {chapterContext.previousFeedbackLabel ? <p>{chapterContext.previousFeedbackLabel}</p> : null}
            {chapterContext.previousFeedbackFocus ? <p>{chapterContext.previousFeedbackFocus}</p> : null}
          </div>
        ) : null}
      </PanelCard>

      <PanelCard
        eyebrow="卷与剧情线"
        title="本章承接哪一层推进"
        description="主线像本章主任务，关联线像顺手推进的支线。"
        actions={
          <>
            <button type="button" className="ghost-btn" onClick={onOpenStorylineCreator} disabled={!selectedBookId}>
              新建剧情线
            </button>
            <button type="button" className="ghost-btn" onClick={onClearStorylineSelection} disabled={!selectedBookId || selectedTargetStorylines.length === 0}>
              清空选择
            </button>
            <button type="button" className="solid-btn" onClick={onSaveChapterPlan} disabled={!selectedBookId || savingState.loading}>
              保存剧情线选择
            </button>
          </>
        }
      >
        <ul className="meta-list">
          <li>卷级定位：{chapterView.volumeLabel || '第 1 卷'}</li>
          <li>卷内目标：{chapterView.volumeSummary || '暂无卷级说明'}</li>
          <li>主剧情线：{selectedMainStorylineLabel}</li>
          <li>关联剧情线：{selectedTargetStorylineLabel}</li>
        </ul>
        <div className="storyline-picker">
          <label className="editor-field">
            <span>主推进剧情线</span>
            <select
              className="book-select storyline-select"
              value={draftChapterPlan.main_storyline_id}
              onChange={(event) => onSelectMainStoryline(event.target.value)}
              disabled={storylineOptions.length === 0}
            >
              <option value="">暂不指定</option>
              {storylineOptions.map((storyline) => (
                <option key={storyline.id} value={storyline.id}>
                  第 {storyline.volumeNumber} 卷 · {storyline.name}
                </option>
              ))}
            </select>
          </label>
          <div className="editor-field">
            <span>关联剧情线</span>
            {storylineOptions.length > 0 ? (
              <div className="storyline-checkbox-list">
                {storylineOptions.map((storyline) => (
                  <label key={storyline.id} className="storyline-checkbox-item">
                    <input
                      type="checkbox"
                      checked={Array.isArray(draftChapterPlan.target_storylines) && draftChapterPlan.target_storylines.includes(storyline.id)}
                      onChange={() => onToggleTargetStoryline(storyline.id)}
                    />
                    <span>
                      第 {storyline.volumeNumber} 卷 · {storyline.name}
                      <em>{storyline.type} · 预计第 {storyline.startChapter}-{storyline.endChapter} 章</em>
                    </span>
                    <button
                      type="button"
                      className="inline-link-btn storyline-edit-btn"
                      onClick={(event) => {
                        event.preventDefault();
                        onOpenStorylineEditor(storyline);
                      }}
                    >
                      编辑
                    </button>
                  </label>
                ))}
              </div>
            ) : (
              <p className="excerpt-text">当前书籍还没有剧情线。可以先用演示书籍测试，再继续接剧情线创建入口。</p>
            )}
          </div>
          {storylineRhythmHints.length > 0 ? (
            <div className="storyline-rhythm-hints">
              <span>节奏提示</span>
              {storylineRhythmHints.map((hint) => (
                <div key={hint.id} className="storyline-rhythm-hint-row">
                  <p>{hint.text}</p>
                  {hint.actionLabel ? (
                    <button
                      type="button"
                      className="inline-link-btn storyline-rhythm-action"
                      onClick={() => onAdjustStorylineRange(hint.storyline, hint.actionField)}
                      disabled={savingState.loading}
                    >
                      {hint.actionLabel}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </PanelCard>

      <PanelCard
        eyebrow="章节大纲"
        title="本章计划说明"
        description="正文生成前最重要的信息。"
        actions={<button type="button" className="solid-btn" onClick={onOpenOutlineModal}>编辑大纲</button>}
      >
        <span className="info-chip info-chip-required">必要信息</span>
        <p className="summary-state">{draftChapterPlan.outline_text ? '已填写' : '未填写'}</p>
        {draftChapterPlan.outline_text ? (
          <div className="structured-outline-summary">
            <p><strong>本章目标：</strong>{draftChapterPlan.chapter_structure?.chapter_goal || draftChapterPlan.chapter_mission || '未填写'}</p>
            <p><strong>关键场景：</strong>{draftChapterPlan.chapter_structure?.key_scenes || '未填写'}</p>
            <p><strong>冲突升级：</strong>{draftChapterPlan.chapter_structure?.conflict_escalation || '未填写'}</p>
            <p><strong>结尾钩子：</strong>{draftChapterPlan.chapter_structure?.ending_hook || draftChapterPlan.ending_hook || '未填写'}</p>
          </div>
        ) : (
          <p className="excerpt-text">还没有章节任务表。建议先写本章目标、关键场景、冲突升级和结尾钩子。</p>
        )}
      </PanelCard>

      <PanelCard
        eyebrow="章节角色"
        title="本章出场角色"
        description="有人物变化或新角色登场时再补。"
        actions={<button type="button" className="solid-btn" onClick={onOpenCharacterModal}>编辑角色</button>}
      >
        <span className="info-chip info-chip-optional">建议信息</span>
        <p className="summary-state">{draftChapterPlan.character_notes ? '已补充' : '可留空'}</p>
        <p className="excerpt-text">{draftChapterPlan.character_notes || '还没有本章角色说明。'}</p>
        {Array.isArray(draftChapterPlan.role_execution) && draftChapterPlan.role_execution.length > 0 ? (
          <div className="structured-outline-summary">
            {draftChapterPlan.role_execution.slice(0, 3).map((item, index) => (
              <div key={`${item.role || 'role'}-${index}`} className="role-execution-summary-item">
                <p>
                  <strong>{item.role || '未命名角色'}：</strong>
                  {item.chapter_function || item.allowed_change || '本章角色执行要求待补充'}
                </p>
                <p className="summary-meta-text">{describeRoleExecutionMeta(item)}</p>
              </div>
            ))}
          </div>
        ) : null}
      </PanelCard>

      <div className="context-chips">
        <span
          className={`context-chip${activeDrawer === 'book' ? ' is-active' : ''}`}
          onClick={() => onContextChipClick('book')}
        >📖 全书设定</span>
        <span
          className={`context-chip${activeDrawer === 'storyline' ? ' is-active' : ''}`}
          onClick={() => onContextChipClick('storyline')}
        >🗺 剧情线</span>
        <span
          className={`context-chip${activeDrawer === 'character' ? ' is-active' : ''}`}
          onClick={() => onContextChipClick('character')}
        >👤 角色档案</span>
        <span
          className={`context-chip${activeDrawer === 'volume' ? ' is-active' : ''}`}
          onClick={() => onContextChipClick('volume')}
        >📚 分卷</span>
      </div>
    </>
  );
}

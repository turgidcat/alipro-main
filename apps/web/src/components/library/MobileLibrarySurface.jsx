import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { formatExactWordCount } from '../../lib/textMetrics.js';
import { getRoleTierShortLabel, getRoleTierTone, roleTierOptions } from '../../lib/roleTiers.js';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function getChapterTitle(entry) {
  return String(entry?.chapter?.title || entry?.plan?.chapter_name || '').trim() || `第 ${entry?.chapterNumber || '?'} 章`;
}

function formatVolumeNotes(value) {
  return String(value || '')
    .replace(/\\r\\n/g, '\n')
    .replace(/\\n/g, '\n')
    .replace(/\s+(?=\d+[.、)）])/g, '\n')
    .replace(/([。！？；])\s*(?=\d+[.、)）])/g, '$1\n')
    .replace(/；\s*/g, '；\n')
    .replace(/([。！？；])\s*(?=(关键节点|时间跨度|卷末钩子|下一卷因果入口)[:：])/g, '$1\n')
    .replace(/\s+(?=(关键节点|时间跨度|卷末钩子|下一卷因果入口)[:：])/g, '\n')
    .trim();
}

function exportOutlineBundle({ detailOutline, detailVolumePlans = [], detailStorylines = [], chapterEntries = [], detailChapters = [], detailChapterPlans = [] }) {
  const section = (title, value) => `\n\n===== ${title} =====\n${value || '暂无'}`;
  const volumes = detailVolumePlans.map((item) => [
    `第 ${item.volume_number || 1} 卷：${item.volume_name || '未命名'}`,
    `主题：${item.volume_theme || ''}`,
    `阶段目标：${item.stage_goal || ''}`,
    `核心冲突：${item.core_conflict || ''}`,
    `备注：${formatVolumeNotes(item.notes)}`
  ].join('\n')).join('\n\n');
  const storylines = detailStorylines.map((item) => `${item.name || '未命名剧情线'}：${item.description || item.core_conflict || ''}`).join('\n');
  const chapters = chapterEntries.map((item) => `第 ${item.chapterNumber || item.chapter_number || 1} 章《${getChapterTitle(item)}》\n${item.plan?.outline_text || item.outline_text || ''}`).join('\n\n');
  const text = `作品结构资料${section('全书大纲', detailOutline?.main_outline)}${section('分卷规划', volumes)}${section('剧情线', storylines)}${section('章节细纲', chapters)}`;
  navigator.clipboard?.writeText(text).catch(() => {});
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a');
  link.href = url; link.download = '作品结构资料-临时导出.txt'; link.click(); URL.revokeObjectURL(url);
}

export function MobileBottomSheet({ title, subtitle = '', onClose, children }) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panelRef = useRef(null);
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panelRef.current?.focus();
    const onKeyDown = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current?.(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus?.();
    };
  }, []);
  return createPortal(
    <div className="mobile-library-sheet-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose?.(); }}>
      <section ref={panelRef} tabIndex={-1} className="mobile-library-sheet mobile-library-bottom-sheet" role="dialog" aria-modal="true" aria-label={title}>
        <div className="mobile-library-sheet-grabber" />
        <div className="mobile-library-sheet-head"><div><strong>{title}</strong>{subtitle ? <p>{subtitle}</p> : null}</div><button type="button" onClick={onClose} aria-label="关闭">×</button></div>
        <div className="mobile-library-sheet-body">{children}</div>
      </section>
    </div>, document.body
  );
}

export function MobileLibraryHeader({ title, subtitle, active, books, currentBookId, onSwitchBook, onNavigate }) {
  return (
    <header className="mobile-library-header">
      <div className="mobile-library-header-main">
        <div><span className="mobile-library-kicker">LIBRARY / LONGFORM STUDIO</span><h1>{title}</h1><p>{subtitle}</p></div>
      </div>
      {books.length > 1 ? <label className="mobile-library-book-switcher"><span>当前作品</span><select value={currentBookId} onChange={(event) => onSwitchBook?.(event.target.value)} aria-label="切换当前作品">{books.map((book) => <option key={book.id} value={book.id}>{book.title || '未命名作品'}</option>)}</select></label> : null}
    </header>
  );
}

function MobileActionButton({ children, onClick, primary = false, danger = false, disabled = false }) {
  return <button type="button" className={joinClasses('mobile-library-action', primary && 'is-primary', danger && 'is-danger')} onClick={onClick} disabled={disabled}>{children}</button>;
}

function MobileModuleCard({ label, description, meta, onClick }) {
  return <button type="button" className="mobile-library-module-card" onClick={onClick}><span>{label}</span><strong>{description}</strong><small>{meta}</small><b>→</b></button>;
}

function MobileBookList({ books, filteredBooks, loading, searchText, setSearchText, statusFilter, setStatusFilter, genreFilter, setGenreFilter, statusOptions, genreOptions, currentBookId, onSwitchBook, openCreateEditor, loadLibrary, openBookDetail, setCurrentBook, downloadBookExport, deleteBook }) {
  const currentBook = books.find((book) => book.id === currentBookId) || filteredBooks[0] || null;
  return <div className="mobile-library-content mobile-library-home">
    {currentBook ? <section className="mobile-library-continue"><div><span>继续创作</span>{books.length > 1 ? <select className="mobile-library-current-select" value={currentBookId} onChange={(event) => onSwitchBook?.(event.target.value)} aria-label="切换当前作品">{books.map((book) => <option key={book.id} value={book.id}>{book.title || '未命名作品'}</option>)}</select> : <strong>{currentBook.title || '未命名作品'}</strong>}</div><button type="button" onClick={() => openBookDetail(currentBook.id)} aria-label="打开当前作品">→</button></section> : null}
    <div className="mobile-library-search-row"><label><span aria-hidden="true">⌕</span><input value={searchText} onChange={(event) => setSearchText(event.target.value)} placeholder="搜索作品" aria-label="搜索作品" /></label><button type="button" onClick={loadLibrary} aria-label="刷新作品">↻</button></div>
    <div className="mobile-library-filter-row"><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} aria-label="作品状态"><option value="all">全部状态</option>{statusOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><select value={genreFilter} onChange={(event) => setGenreFilter(event.target.value)} aria-label="作品题材"><option value="all">全部题材</option>{genreOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></div>
    <div className="mobile-library-section-title mobile-library-list-title"><div><h2>作品 <em>{filteredBooks.length}</em></h2></div><MobileActionButton onClick={openCreateEditor} primary>新建</MobileActionButton></div>
    <div className="mobile-library-book-list">{loading ? <div className="mobile-library-empty">正在读取作品资料…</div> : null}{!loading && filteredBooks.length === 0 ? <div className="mobile-library-empty"><strong>{books.length ? '没有符合条件的作品' : '还没有作品'}</strong><span>{books.length ? '换个筛选条件试试。' : '先新建一本作品。'}</span></div> : null}{!loading ? filteredBooks.map((book) => <article className={joinClasses('mobile-library-book-card', book.id === currentBookId && 'is-current')} key={book.id}><button type="button" className="mobile-library-book-main" onClick={() => openBookDetail(book.id)}><span className="mobile-library-book-mark">{String(book.title || '未').slice(0, 1)}</span><span><strong>{book.title || '未命名作品'}</strong><small>{book.author || '未设置作者'} · {book.chapter_count || 0} 章 · {formatExactWordCount(book.word_count || 0)}</small></span>{book.id === currentBookId ? <em>当前</em> : null}</button><div className="mobile-library-quick-actions"><MobileActionButton onClick={() => setCurrentBook(book.id)} disabled={book.id === currentBookId}>{book.id === currentBookId ? '当前作品' : '设为当前'}</MobileActionButton><MobileActionButton onClick={() => downloadBookExport(book.id)}>导出</MobileActionButton><MobileActionButton onClick={() => deleteBook(book.id)} danger>删除</MobileActionButton></div></article>) : null}</div>
  </div>;
}

function MobileSummary({ book, detailChapters, detailCharacters, detailVolumePlans, detailStorylines, onOpenWorkbench, onNavigate }) {
  if (!book) return <div className="mobile-library-empty">请先选择一本作品。</div>;
  return <div className="mobile-library-content"><section className="mobile-library-book-hero"><span>当前作品</span><h2>{book.title || '未命名作品'}</h2><p>{book.author || '未设置作者'} · {book.genre || '未设置题材'}</p><MobileActionButton onClick={onOpenWorkbench} primary>继续创作</MobileActionButton></section><div className="mobile-library-metrics is-large"><span><b>{detailChapters.length}</b>章节</span><span><b>{formatExactWordCount(book.word_count || book.total_word_count || 0)}</b>字数</span><span><b>{detailCharacters.length}</b>角色</span></div><section><div className="mobile-library-section-title"><div><span>WORKSPACE</span><h2>作品资料</h2></div></div><div className="mobile-library-module-grid mobile-library-module-grid-compact"><MobileModuleCard label="01" description="章节细纲与正文" meta={`${detailChapters.length} 章 · 进入写作现场`} onClick={() => onNavigate('chapters')} /><MobileModuleCard label="02" description="角色资料" meta={`${detailCharacters.length} 个角色 · 人物关系`} onClick={() => onNavigate('characters')} /><MobileModuleCard label="03" description="大纲链" meta={`${detailVolumePlans.length} 卷 · 故事结构`} onClick={() => onNavigate('outline')} /><MobileModuleCard label="04" description="叙事脉络" meta={`${detailStorylines.length} 条 · 剧情推进`} onClick={() => onNavigate('storyline')} /></div></section>{book.description ? <div className="mobile-library-long-text-preview"><p>{book.description}</p></div> : null}</div>;
}

function CharacterForm({ draft, onChange, onCancel, onSave, saving }) {
  return <div className="mobile-library-sheet-form"><label>角色名<input value={draft.name || ''} onChange={(event) => onChange('name', event.target.value)} /></label><label>角色定位<select value={draft.role_tier || 'supporting_major'} onChange={(event) => onChange('role_tier', event.target.value)}>{roleTierOptions.map((option) => <option key={option.value} value={option.value}>{option.shortLabel}</option>)}</select></label><label>核心性格<textarea rows={3} value={draft.personality || ''} onChange={(event) => onChange('personality', event.target.value)} /></label><label>身份背景<textarea rows={3} value={draft.background || ''} onChange={(event) => onChange('background', event.target.value)} /></label><label>外形标记<textarea rows={2} value={draft.appearance || ''} onChange={(event) => onChange('appearance', event.target.value)} /></label><div className="mobile-library-sheet-actions"><MobileActionButton onClick={onCancel}>取消</MobileActionButton><MobileActionButton onClick={onSave} primary disabled={saving}>{saving ? '保存中…' : '保存角色'}</MobileActionButton></div></div>;
}

function FlipCard({ character, onEdit, onDelete, deleting }) {
  const [flipped, setFlipped] = useState(false);
  function toggle(event) {
    if (event.target.closest('button')) return;
    setFlipped((current) => !current);
  }
  const roleTier = character.role_tier || 'supporting_major';
  return <article className={joinClasses('mobile-library-flip-card', flipped && 'is-flipped')} onClick={toggle} role="button" tabIndex={0} aria-pressed={flipped} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setFlipped((current) => !current); } }}><div className="mobile-library-flip-inner"><div className="mobile-library-flip-face mobile-library-flip-front"><div className="mobile-library-info-head"><div><span className="mobile-library-avatar">{String(character.name || '角').slice(0, 1)}</span><span className="mobile-library-character-identity"><strong>{character.name || '未命名角色'}</strong><em className={joinClasses('mobile-library-role-tier', getRoleTierTone(roleTier))}>{getRoleTierShortLabel(roleTier)}</em></span></div><div><button type="button" onClick={onEdit}>编辑</button><button type="button" onClick={onDelete} disabled={deleting}>删除</button></div></div><span className="mobile-library-flip-hint">点击卡片查看完整资料</span></div><div className="mobile-library-flip-face mobile-library-flip-back"><div className="mobile-library-character-back"><div className="mobile-library-character-back-title"><strong>{character.name || '未命名角色'} · 人物卡</strong><em className={joinClasses('mobile-library-role-tier', getRoleTierTone(roleTier))}>{getRoleTierShortLabel(roleTier)}</em></div>{character.personality ? <p><b>性格：</b>{character.personality}</p> : null}{character.background ? <p><b>背景：</b>{character.background}</p> : null}{character.appearance ? <p><b>外形：</b>{character.appearance}</p> : null}{!character.personality && !character.background && !character.appearance ? <p>暂未补充人物资料。</p> : null}</div><span className="mobile-library-flip-hint">点击卡片返回概览</span></div></div></article>;
}

function MobileCharacters({ detailCharacters, editingCharacterKey, characterDrafts, characterSavingKey, characterDeletingKey, creatingCharacter, newCharacterDraft, setEditingCharacterKey, setCreatingCharacter, updateCharacterDraft, resetNewCharacterDraft, handleSaveCharacter, handleCreateCharacter, handleDeleteCharacter, handleGenerateCharacterCard, aiCharacterOpen, setAiCharacterOpen, aiCharacterHint, setAiCharacterHint, aiRoleCounts, setAiRoleCounts, aiCharacterLoading, characterError, characterNotice }) {
  const plannedCharacterCount = roleTierOptions.reduce((sum, option) => sum + Number(aiRoleCounts?.[option.value] || 0), 0);
  function updateRoleCount(roleTier, nextCount) {
    setAiRoleCounts((current) => ({ ...current, [roleTier]: Math.max(0, Math.min(10, Number(nextCount) || 0)) }));
  }
  return <div className="mobile-library-content"><div className="mobile-library-section-title"><div><span>PEOPLE</span><h2>角色资料 <em>{detailCharacters.length}</em></h2></div><div className="mobile-library-title-actions"><MobileActionButton onClick={() => setCreatingCharacter(true)} primary>新增</MobileActionButton><MobileActionButton onClick={() => setAiCharacterOpen(true)}>AI 规划</MobileActionButton></div></div>{characterError ? <div className="global-banner is-error">{characterError}</div> : null}{characterNotice ? <div className="global-banner">{characterNotice}</div> : null}<div className="mobile-library-card-list">{detailCharacters.map((character) => { const key = String(character.id); const draft = characterDrafts[key] || character; const editing = editingCharacterKey === key; return editing ? <article className="mobile-library-info-card" key={character.id}><div className="mobile-library-info-head"><div><span className="mobile-library-avatar">{String(character.name || '角').slice(0, 1)}</span><span className="mobile-library-character-identity"><strong>{character.name || '未命名角色'}</strong><em className={joinClasses('mobile-library-role-tier', getRoleTierTone(draft.role_tier || character.role_tier))}>{getRoleTierShortLabel(draft.role_tier || character.role_tier)}</em></span></div><button type="button" onClick={() => setEditingCharacterKey('')}>收起</button></div><CharacterForm draft={draft} onChange={(field, value) => updateCharacterDraft(character.id, field, value)} onCancel={() => setEditingCharacterKey('')} onSave={() => handleSaveCharacter(character.id)} saving={characterSavingKey === key} /></article> : <FlipCard key={character.id} character={character} onEdit={() => setEditingCharacterKey(key)} onDelete={() => handleDeleteCharacter(character.id, character.name)} deleting={characterDeletingKey === key} />; })}</div>{creatingCharacter ? <MobileBottomSheet title="新增角色" onClose={() => setCreatingCharacter(false)}><CharacterForm draft={newCharacterDraft} onChange={(field, value) => resetNewCharacterDraft({ ...newCharacterDraft, [field]: value })} onCancel={() => setCreatingCharacter(false)} onSave={handleCreateCharacter} saving={characterSavingKey === 'new'} /></MobileBottomSheet> : null}{aiCharacterOpen ? <MobileBottomSheet title="安排角色 T 级" subtitle="先决定阵容，再生成角色卡。" onClose={() => { if (!aiCharacterLoading) setAiCharacterOpen(false); }}><div className="mobile-library-role-plan-list">{roleTierOptions.map((option) => { const current = Number(aiRoleCounts?.[option.value] || 0); return <div className={joinClasses('mobile-library-role-plan-row', current > option.max && 'is-warning')} key={option.value}><div><em className={joinClasses('mobile-library-role-tier', getRoleTierTone(option.value))}>{option.shortLabel}</em><span>{option.softLimit}</span></div><div className="mobile-library-role-stepper"><button type="button" onClick={() => updateRoleCount(option.value, current - 1)} disabled={current <= 0 || aiCharacterLoading} aria-label={`减少${option.label}`}>−</button><b>{current}</b><button type="button" onClick={() => updateRoleCount(option.value, current + 1)} disabled={current >= 10 || aiCharacterLoading} aria-label={`增加${option.label}`}>＋</button></div></div>; })}</div><label className="mobile-library-role-hint">补充提示<textarea rows={3} value={aiCharacterHint || ''} onChange={(event) => setAiCharacterHint(event.target.value)} placeholder="例如：主角隐忍成长，主要配角中安排一位立场暧昧的同伴。" /></label><div className="mobile-library-role-plan-total"><span>计划生成</span><strong>{plannedCharacterCount} 人</strong></div><div className="mobile-library-sheet-actions"><MobileActionButton onClick={() => setAiCharacterOpen(false)} disabled={aiCharacterLoading}>取消</MobileActionButton><MobileActionButton onClick={handleGenerateCharacterCard} primary disabled={aiCharacterLoading || plannedCharacterCount === 0}>{aiCharacterLoading ? '生成中…' : `生成 ${plannedCharacterCount} 张角色卡`}</MobileActionButton></div></MobileBottomSheet> : null}</div>;
}

function MobileOutline({ detailOutline, detailVolumePlans, detailStorylines, chapterEntries, detailChapters, detailChapterPlans, outlineEditing, outlineDraft, outlineSaving, outlineGenerating, setOutlineDraft, startOutlineEditing, stopOutlineEditing, handleSaveOutline, handleGenerateFullOutlineDraft, handleGenerateVolumePlans, handleCreateVolumePlan, targetVolumeCount, setTargetVolumeCount, editingVolumeKey, setEditingVolumeKey, volumePlanDrafts, updateVolumePlanDraft, handleSaveVolumePlan, handleDeleteVolumePlan, volumeBusy }) {
  const [outlineSheetOpen, setOutlineSheetOpen] = useState(false);
  const [volumeSheet, setVolumeSheet] = useState(null);
  return <div className="mobile-library-content"><section className="mobile-library-book-hero"><span>STORY ARCHITECTURE</span><h2>大纲链</h2><p>先看全书方向，再逐卷推进。</p><button type="button" onClick={() => exportOutlineBundle({ detailOutline, detailVolumePlans, detailStorylines, chapterEntries, detailChapters, detailChapterPlans })}>一键导出结构资料</button><div className="mobile-library-title-actions"><MobileActionButton onClick={startOutlineEditing}>编辑全书大纲</MobileActionButton><MobileActionButton onClick={handleGenerateFullOutlineDraft} primary disabled={outlineGenerating}>{outlineGenerating ? '生成中…' : 'AI 生成'}</MobileActionButton></div></section>{outlineEditing ? <div className="mobile-library-editor-card"><label>全书大纲<textarea rows={9} value={outlineDraft.main_outline || ''} onChange={(event) => setOutlineDraft((prev) => ({ ...prev, main_outline: event.target.value }))} /></label><div className="mobile-library-sheet-actions"><MobileActionButton onClick={stopOutlineEditing}>取消</MobileActionButton><MobileActionButton onClick={handleSaveOutline} primary disabled={volumeBusy}>{outlineSaving ? '保存中…' : '保存大纲'}</MobileActionButton></div></div> : <div className="mobile-library-long-text-preview"><p>{detailOutline?.main_outline || '暂未建立全书大纲。'}</p><button type="button" onClick={() => setOutlineSheetOpen(true)}>查看完整大纲</button></div>}<section><div className="mobile-library-section-title"><div><span>VOLUMES</span><h2>分卷规划</h2></div><MobileActionButton onClick={handleCreateVolumePlan} disabled={volumeBusy}>新增一卷</MobileActionButton></div><div className="mobile-library-volume-toolbar"><label>目标卷数<input type="number" min="0" max="12" value={targetVolumeCount} onChange={(event) => setTargetVolumeCount(Math.max(0, Math.min(12, Number(event.target.value) || 0)))} /></label><MobileActionButton onClick={handleGenerateVolumePlans} primary disabled={volumeBusy}>{outlineSaving ? '处理中…' : '自动拆分'}</MobileActionButton></div><div className="mobile-library-volume-list">{detailVolumePlans.map((plan) => { const number = Number(plan.volume_number || 1); const key = String(number); const editing = editingVolumeKey === key; const draft = volumePlanDrafts[key] || plan; return editing ? <article className="mobile-library-volume-card" key={plan.id || key}><div className="mobile-library-info-head"><div><span>VOL.{String(number).padStart(2, '0')}</span><strong>{draft.volume_name || plan.volume_name || '未命名分卷'}</strong></div><button type="button" onClick={() => setEditingVolumeKey('')}>收起</button></div><div className="mobile-library-sheet-form"><label>卷名<input value={draft.volume_name || ''} onChange={(event) => updateVolumePlanDraft(number, 'volume_name', event.target.value)} /></label><label>阶段目标<textarea rows={3} value={draft.stage_goal || ''} onChange={(event) => updateVolumePlanDraft(number, 'stage_goal', event.target.value)} /></label><label>核心冲突<textarea rows={3} value={draft.core_conflict || ''} onChange={(event) => updateVolumePlanDraft(number, 'core_conflict', event.target.value)} /></label><div className="mobile-library-sheet-actions"><MobileActionButton onClick={() => setEditingVolumeKey('')}>取消</MobileActionButton><MobileActionButton onClick={() => handleSaveVolumePlan(number)} primary disabled={volumeBusy}>保存本卷</MobileActionButton><MobileActionButton onClick={() => handleDeleteVolumePlan(number)} danger disabled={volumeBusy}>删除</MobileActionButton></div></div></article> : <article className="mobile-library-volume-card" key={plan.id || key}><div className="mobile-library-volume-card-head"><div><span>VOL.{String(number).padStart(2, '0')}</span><strong>{draft.volume_name || plan.volume_name || '未命名分卷'}</strong><p>{draft.stage_goal || '暂未填写阶段目标。'}</p></div><button type="button" onClick={() => setVolumeSheet(plan)}>查看</button></div><div className="mobile-library-card-actions"><MobileActionButton onClick={() => setEditingVolumeKey(key)} disabled={volumeBusy}>编辑</MobileActionButton><MobileActionButton onClick={() => setVolumeSheet(plan)}>详细信息</MobileActionButton><MobileActionButton onClick={() => handleDeleteVolumePlan(number)} danger disabled={volumeBusy}>删除本卷</MobileActionButton></div></article>; })}</div></section>{outlineSheetOpen ? <MobileBottomSheet title="全书大纲" subtitle="完整查看当前作品的结构方向。" onClose={() => setOutlineSheetOpen(false)}>{[['全书大纲', detailOutline?.main_outline], ['分卷大纲', detailOutline?.volume_outline], ['详细大纲', detailOutline?.detailed_outline]].map(([label, content]) => content ? <section key={label}><h3>{label}</h3><p className="mobile-library-sheet-copy">{content}</p></section> : null)}{!detailOutline?.main_outline && !detailOutline?.volume_outline && !detailOutline?.detailed_outline ? <p className="mobile-library-sheet-copy">暂未建立全书大纲。</p> : null}</MobileBottomSheet> : null}{volumeSheet ? <MobileBottomSheet title={volumeSheet.volume_name || `第 ${volumeSheet.volume_number || 1} 卷`} subtitle="阶段目标与核心冲突" onClose={() => setVolumeSheet(null)}>{[['分卷主题', volumeSheet.volume_theme], ['阶段目标', volumeSheet.stage_goal], ['核心冲突', volumeSheet.core_conflict], ['开卷角色状态', volumeSheet.start_role_state], ['收卷角色状态', volumeSheet.end_role_state], ['备注', formatVolumeNotes(volumeSheet.notes)]].map(([label, content]) => <p key={label} className="mobile-library-sheet-copy"><b>{label}：</b>{content || '暂未填写'}</p>)}</MobileBottomSheet> : null}</div>;
}

function MobileChapters({ detailBook, chapterEntries, chapterEditorOpen, chapterDraft, chapterPlanSaving, chapterPlanGenerating, openChapterPlanEditor, setChapterEditorOpen, updateChapterDraftField, handleSaveLibraryChapterPlan, handleGenerateLibraryChapterPlan, openChapterReader, handleDeleteLibraryChapter, openWorkbench }) {
  const [outlineEntry, setOutlineEntry] = useState(null);
  return <div className="mobile-library-content"><section className="mobile-library-book-hero"><span>CHAPTER PLANS</span><h2>{detailBook?.title || '章节与正文'}</h2><p>{chapterEntries.length} 个章节记录</p><div className="mobile-library-title-actions"><MobileActionButton onClick={() => openChapterPlanEditor(null)} primary>新增章节细纲</MobileActionButton><MobileActionButton onClick={() => openWorkbench(detailBook?.id)}>去创作台</MobileActionButton></div></section>{chapterEditorOpen ? <div className="mobile-library-editor-card"><div className="mobile-library-sheet-head"><strong>章节细纲</strong><button type="button" onClick={() => setChapterEditorOpen(false)}>×</button></div><div className="mobile-library-sheet-form"><label>章节编号<input type="number" min="1" value={chapterDraft.chapter_number} onChange={(event) => updateChapterDraftField('chapter_number', Math.max(1, Number(event.target.value || 1)))} /></label><label>章节名<input value={chapterDraft.chapter_name || ''} onChange={(event) => updateChapterDraftField('chapter_name', event.target.value)} /></label><label>章节细纲<textarea rows={8} value={chapterDraft.outline_text || ''} onChange={(event) => updateChapterDraftField('outline_text', event.target.value)} /></label><div className="mobile-library-sheet-actions"><MobileActionButton onClick={() => setChapterEditorOpen(false)}>收起</MobileActionButton><MobileActionButton onClick={handleSaveLibraryChapterPlan} disabled={chapterPlanSaving} primary>{chapterPlanSaving ? '保存中…' : '保存细纲'}</MobileActionButton><MobileActionButton onClick={handleGenerateLibraryChapterPlan} disabled={chapterPlanGenerating}>{chapterPlanGenerating ? '生成中…' : 'AI 生成'}</MobileActionButton></div></div></div> : null}<div className="mobile-library-chapter-grid">{chapterEntries.map((entry) => <article className="mobile-library-chapter-card" key={entry.chapterNumber}><div className="mobile-library-chapter-head"><div><span>CH.{String(entry.chapterNumber).padStart(2, '0')}</span><strong>{getChapterTitle(entry)}</strong><small>{entry.chapter?.content ? '正文已保存' : '待生成正文'} · {formatExactWordCount(entry.chapter?.word_count || 0)}</small></div><button type="button" className="mobile-library-read-button" onClick={() => openChapterReader(entry.chapterNumber)}>阅读</button></div>{entry.plan?.outline_text ? <button type="button" className="mobile-library-chapter-outline-button" onClick={() => setOutlineEntry(entry)}>查看细纲</button> : <span className="mobile-library-chapter-outline-empty">暂无细纲</span>}<div className="mobile-library-card-actions"><MobileActionButton onClick={() => openChapterPlanEditor(entry)}>编辑细纲</MobileActionButton><MobileActionButton onClick={() => handleDeleteLibraryChapter(entry)} danger>删除</MobileActionButton></div></article>)}</div>{outlineEntry ? <MobileBottomSheet title={getChapterTitle(outlineEntry)} subtitle="章节细纲" onClose={() => setOutlineEntry(null)}><p className="mobile-library-sheet-copy">{outlineEntry.plan?.outline_text || '暂无细纲。'}</p></MobileBottomSheet> : null}</div>;
}

export default function MobileLibrarySurface({ page, books = [], currentBookId, onSwitchBook, onNavigate, book, filteredBooks = [], stats, loading, searchText, setSearchText, statusFilter, setStatusFilter, genreFilter, setGenreFilter, statusOptions = [], genreOptions = [], openCreateEditor, loadLibrary, openBookDetail, setCurrentBook, downloadBookExport, deleteBook, detailChapters = [], detailChapterPlans = [], chapterEntries = [], detailCharacters = [], detailVolumePlans = [], detailStorylines = [], detailOutline, onOpenWorkbench, ...actions }) {
  const navigate = (key) => onNavigate?.(key);
  const active = page === 'list' ? 'list' : page;
  const title = page === 'list' ? '资料库' : page === 'summary' ? '作品汇总' : page === 'characters' ? '角色资料' : page === 'outline' ? '大纲链' : '章节与正文';
  const subtitle = page === 'list' ? '把作品资料放在手边。' : page === 'summary' ? '当前作品的写作地图。' : page === 'characters' ? '人物关系与成长状态。' : page === 'outline' ? '这里管理全书与分卷；章节细纲在“章节与正文”。' : '查看已经保存的章节细纲与正文。';
  return <section className={joinClasses('mobile-library-surface', page === 'list' && 'is-library-list')} aria-label={title}>{page !== 'list' ? <MobileLibraryHeader title={title} subtitle={subtitle} active={active} books={books} currentBookId={currentBookId} onSwitchBook={onSwitchBook} onNavigate={navigate} /> : null}{page === 'list' ? <MobileBookList {...{ books, filteredBooks, stats, loading, searchText, setSearchText, statusFilter, setStatusFilter, genreFilter, setGenreFilter, statusOptions, genreOptions, currentBookId, onSwitchBook, openCreateEditor, loadLibrary, openBookDetail, setCurrentBook, downloadBookExport, deleteBook }} /> : null}{page === 'summary' ? <MobileSummary book={book} detailChapters={detailChapters} detailCharacters={detailCharacters} detailVolumePlans={detailVolumePlans} detailStorylines={detailStorylines} onOpenWorkbench={onOpenWorkbench} onNavigate={navigate} /> : null}{page === 'characters' ? <MobileCharacters detailCharacters={detailCharacters} {...actions} /> : null}{page === 'outline' ? <MobileOutline detailOutline={detailOutline} detailVolumePlans={detailVolumePlans} detailStorylines={detailStorylines} chapterEntries={chapterEntries} detailChapters={detailChapters} detailChapterPlans={detailChapterPlans} {...actions} /> : null}{page === 'chapters' ? <MobileChapters detailBook={book} chapterEntries={chapterEntries} {...actions} openWorkbench={onOpenWorkbench} /> : null}</section>;
}






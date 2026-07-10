import { useEffect, useMemo, useRef, useState } from 'react';
import {
  deleteStoryline,
  fetchBookList,
  fetchBookPlanningBundle,
  fetchStorylines,
  generateStorylineDetails,
  generateVolumeStorylineDetails,
  generateVolumeStorylineSet,
  getStoredCurrentBookId,
  persistCurrentBookId,
  saveStoryline
} from '../workbenchApi.js';
import { formatStorylineTypeLabel } from '../lib/storylineLabel.js';
import '../styles.css';
import '../app-shell.css';

const APP_BASE_PATH = String(import.meta.env.BASE_URL || '/');

function buildAppPath(pathname = '/') {
  const cleanPath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const cleanBase = APP_BASE_PATH.endsWith('/') ? APP_BASE_PATH : `${APP_BASE_PATH}/`;
  return cleanPath ? `${cleanBase}${cleanPath}` : cleanBase;
}

function openBooksSummaryPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath(bookId ? `/books/${encodeURIComponent(bookId)}` : '/books');
}

function openBooksOutlinePage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath('/books/outlines');
}

function openBooksCharacterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath('/books/characters');
}

function openBooksChapterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = buildAppPath('/books/chapters');
}

function openWorkbench(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.sessionStorage.setItem('alipro-open-current-workbench', '1');
  window.location.href = buildAppPath('/workbench');
}

function buildStorylineGroups(storylines = []) {
  const groups = new Map();
  storylines.forEach((item) => {
    const volumeNumber = Number(item.volumeNumber || 1);
    if (!groups.has(volumeNumber)) groups.set(volumeNumber, []);
    groups.get(volumeNumber).push(item);
  });

  return Array.from(groups.entries())
    .sort((left, right) => left[0] - right[0])
    .map(([volumeNumber, items]) => ({
      volumeNumber,
      items: items.sort((left, right) => Number(left.storylineNumber || 0) - Number(right.storylineNumber || 0))
    }));
}

function clampNumber(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(Math.max(number, min), max);
}

function getStorylineLastChapter(storyline) {
  const progressChapters = Array.isArray(storyline.chapterProgress)
    ? storyline.chapterProgress
      .map((item) => Number(item.chapterNumber || item.chapter_number || item.chapter || 0))
      .filter((number) => Number.isFinite(number) && number > 0)
    : [];
  const lastProgressChapter = progressChapters.length > 0 ? Math.max(...progressChapters) : 0;
  return Number(storyline.lastUpdatedChapterNumber || 0) || lastProgressChapter || 0;
}

function getStorylineBoard(storylines = [], volumePlans = []) {
  const safeStorylines = Array.isArray(storylines) ? storylines : [];
  const safeVolumePlans = Array.isArray(volumePlans) ? volumePlans : [];
  const maxStorylineChapter = safeStorylines.reduce((max, storyline) => (
    Math.max(max, Number(storyline.endChapter || 0), Number(storyline.startChapter || 0), getStorylineLastChapter(storyline))
  ), 0);
  const estimatedVolumeTotal = safeVolumePlans.reduce((sum, plan) => (
    sum + Math.max(0, Number(plan.estimated_chapters || plan.estimatedChapters || 0))
  ), 0);
  const totalChapters = Math.max(12, maxStorylineChapter, estimatedVolumeTotal);

  let cursor = 1;
  const volumeBands = safeVolumePlans
    .slice()
    .sort((left, right) => Number(left.volumeNumber || 0) - Number(right.volumeNumber || 0))
    .map((plan) => {
      const estimatedChapters = Math.max(1, Number(plan.estimated_chapters || plan.estimatedChapters || 0) || Math.ceil(totalChapters / Math.max(1, safeVolumePlans.length)));
      const start = cursor;
      const end = Math.min(totalChapters, start + estimatedChapters - 1);
      cursor = end + 1;
      return {
        label: `第 ${Number(plan.volumeNumber || 1)} 卷`,
        range: `预计 ${start}-${end} 章`,
        start,
        end,
        span: Math.max(1, end - start + 1)
      };
    });

  if (volumeBands.length === 0) {
    volumeBands.push({
      label: '当前卷',
      range: `预计 1-${totalChapters} 章`,
      start: 1,
      end: totalChapters,
      span: totalChapters
    });
  }

  const volumeRangeMap = new Map();
  volumeBands.forEach((band, index) => {
    volumeRangeMap.set(index + 1, band);
  });

  const rows = safeStorylines
    .slice()
    .sort((left, right) => Number(left.volumeNumber || 0) - Number(right.volumeNumber || 0)
      || Number(left.storylineNumber || 0) - Number(right.storylineNumber || 0))
    .map((storyline, index) => {
      const volumeNumber = Number(storyline.volumeNumber || 1);
      const volumeBand = volumeRangeMap.get(volumeNumber);
      const localStart = Math.max(1, Number(storyline.startChapter || 1));
      const localEnd = Math.max(localStart, Number(storyline.endChapter || localStart));
      const globalStart = volumeBand ? volumeBand.start + localStart - 1 : localStart;
      const globalEnd = volumeBand ? volumeBand.start + localEnd - 1 : localEnd;
      const start = clampNumber(globalStart, 1, totalChapters);
      const end = clampNumber(globalEnd, start, totalChapters);
      const lastChapter = getStorylineLastChapter(storyline);
      const progressCount = Array.isArray(storyline.chapterProgress) ? storyline.chapterProgress.length : 0;
      const status = storyline.status || 'draft';
      const correction = (() => {
        if (!lastChapter && status === 'draft') return '待推进';
        if (lastChapter > end) return '已超出预计，需校正终止章';
        if (lastChapter >= end) return '已到预计终点，需判断收束';
        if (lastChapter >= start) return '推进中';
        return '已规划，待挂载章节';
      })();

      return {
        id: storyline.id || `${storyline.name}-${index}`,
        label: storyline.name || '未命名叙事脉络',
        hint: `第 ${storyline.volumeNumber || 1} 卷 · ${formatStorylineTypeLabel(storyline.type)}`,
        tone: storyline.type === 'main' ? 'main' : `branch-${(index % 5) + 1}`,
        start,
        span: Math.max(1, end - start + 1),
        end,
        localStart,
        localEnd,
        volumeNumber,
        lastChapter,
        progressCount,
        status,
        correction
      };
    });

  const markerChapter = rows.reduce((max, row) => Math.max(max, row.lastChapter || 0), 0);

  return {
    totalChapters,
    volumeBands,
    rows,
    markerChapter
  };
}

function getTimelineBarStyle(row, totalChapters) {
  return {
    gridColumn: `${row.start} / span ${row.span}`
  };
}

function createStorylineDraft(volumeNumber = 1) {
  return {
    id: '',
    volume_number: Number(volumeNumber || 1),
    storyline_name: '',
    storyline_type: 'branch',
    description: '',
    core_conflict: '',
    start_chapter: 1,
    end_chapter: 10,
    involved_characters: [],
    key_nodes: []
  };
}

export default function StorylineManagementPage() {
  const [bookId, setBookId] = useState(() => getStoredCurrentBookId());
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [book, setBook] = useState(null);
  const [volumePlans, setVolumePlans] = useState([]);
  const [storylines, setStorylines] = useState([]);
  const [selectedVolumeNumber, setSelectedVolumeNumber] = useState(1);
  const [storylineDraft, setStorylineDraft] = useState(() => createStorylineDraft(1));
  const [editorOpen, setEditorOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');
  const [aiGoal, setAiGoal] = useState('');
  const [completedStorylineId, setCompletedStorylineId] = useState('');
  const [nodeDetailStoryline, setNodeDetailStoryline] = useState(null);
  const editorRef = useRef(null);
  const sidebarCollapsed = false;
  const sidebarPeek = false;

  useEffect(() => {
    let cancelled = false;
    fetchBookList().then((list) => {
      if (!cancelled) setBooks(Array.isArray(list) ? list : []);
    }).catch(() => {
      if (!cancelled) setBooks([]);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!bookId) {
      setBook(null);
      setVolumePlans([]);
      setStorylines([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all([
      fetchBookPlanningBundle(bookId),
      fetchStorylines(bookId)
    ]).then(([bundle, storylineList]) => {
      if (cancelled) return;
      setBook(bundle?.currentBook || null);
      const nextVolumePlans = Array.isArray(bundle?.bookPlanning?.volumePlans) ? bundle.bookPlanning.volumePlans : [];
      setVolumePlans(nextVolumePlans);
      setStorylines(Array.isArray(storylineList) ? storylineList : []);
      setSelectedVolumeNumber((current) => current || Number(nextVolumePlans[0]?.volumeNumber || 1));
    }).catch((loadError) => {
      if (cancelled) return;
      setError(loadError.message || '叙事脉络页面加载失败');
      setBook(null);
      setVolumePlans([]);
      setStorylines([]);
    }).finally(() => {
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [bookId]);

  function switchCurrentBook(nextBookId) {
    if (!nextBookId || nextBookId === bookId) return;
    persistCurrentBookId(nextBookId);
    setBookId(nextBookId);
  }

  const storylineGroups = useMemo(() => buildStorylineGroups(storylines), [storylines]);
  const storylineBoard = useMemo(() => getStorylineBoard(storylines, volumePlans), [storylines, volumePlans]);

  const volumeStageMap = useMemo(() => {
    const map = new Map();
    volumePlans.forEach((plan) => {
      map.set(Number(plan.volumeNumber || 0), plan);
    });
    return map;
  }, [volumePlans]);

  const selectedVolumeStorylines = storylines.filter((item) => Number(item.volumeNumber || 1) === Number(selectedVolumeNumber));
  const selectedVolumePlan = volumePlans.find((item) => Number(item.volumeNumber || 1) === Number(selectedVolumeNumber)) || null;

  async function refreshStorylines() {
    if (!bookId) return;
    const next = await fetchStorylines(bookId);
    setStorylines(Array.isArray(next) ? next : []);
  }

  function scrollToEditor() {
    window.requestAnimationFrame(() => {
      editorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function openCreateEditor() {
    setStorylineDraft(createStorylineDraft(selectedVolumeNumber));
    setActionError('');
    setEditorOpen(true);
    scrollToEditor();
  }

  function openEditEditor(storyline) {
    setStorylineDraft({
      id: storyline.id,
      volume_number: Number(storyline.volumeNumber || selectedVolumeNumber || 1),
      storyline_name: storyline.name || '',
      storyline_type: storyline.type || 'branch',
      description: storyline.description || storyline.structuredContent?.summary || '',
      core_conflict: storyline.coreConflict || storyline.structuredContent?.dramaticQuestion || '',
      start_chapter: Number(storyline.startChapter || 1),
      end_chapter: Number(storyline.endChapter || 10),
      involved_characters: Array.isArray(storyline.structuredContent?.relatedCharacters) ? storyline.structuredContent.relatedCharacters : [],
      key_nodes: []
    });
    setActionError('');
    setEditorOpen(true);
    scrollToEditor();
  }

  function updateStorylineDraft(field, value) {
    setStorylineDraft((current) => ({ ...current, [field]: value }));
  }

  async function handleSaveStoryline() {
    if (!bookId || !storylineDraft.storyline_name.trim()) {
      setActionError('剧情线名称不能为空。');
      return;
    }
    setActionLoading('save');
    setActionError('');
    setNotice('');
    try {
      await saveStoryline(bookId, storylineDraft);
      await refreshStorylines();
      setEditorOpen(false);
      setNotice(storylineDraft.id ? '剧情线已更新。' : '剧情线已新增。');
    } catch (saveError) {
      setActionError(saveError.message || '剧情线保存失败');
    } finally {
      setActionLoading('');
    }
  }

  async function handleGenerateVolumeStorylines() {
    if (!bookId) return;
    setActionLoading('volume-generate');
    setActionError('');
    setNotice('');
    try {
      if (selectedVolumeStorylines.length === 0) {
        const result = await generateVolumeStorylineSet(bookId, selectedVolumeNumber, aiGoal);
        setNotice(`AI 已生成 ${Number(result?.createdCount || result?.storylines?.length || 0)} 条本卷剧情线。`);
      } else {
        const result = await generateVolumeStorylineDetails(bookId, selectedVolumeNumber, aiGoal);
        setNotice(`AI 已重新生成 ${Number(result?.successCount || 0)} 条本卷剧情线。`);
      }
      await refreshStorylines();
    } catch (generateError) {
      setActionError(generateError.message || '本卷剧情线生成失败');
    } finally {
      setActionLoading('');
    }
  }

  async function handleGenerateStoryline(storyline) {
    if (!bookId || !storyline?.id) return;
    setActionLoading(`generate-${storyline.id}`);
    setActionError('');
    setNotice('');
    try {
      await generateStorylineDetails(bookId, storyline.id, aiGoal);
      await refreshStorylines();
      setCompletedStorylineId(storyline.id);
      setNotice(`“${storyline.name}”已由 AI 重新生成。`);
    } catch (generateError) {
      setActionError(generateError.message || '剧情线补全失败');
    } finally {
      setActionLoading('');
    }
  }

  async function handleDeleteStoryline(storyline) {
    if (!bookId || !storyline?.id) return;
    if (!window.confirm(`确认删除“${storyline.name}”吗？`)) return;
    setActionLoading(`delete-${storyline.id}`);
    setActionError('');
    setNotice('');
    try {
      await deleteStoryline(bookId, storyline.id);
      await refreshStorylines();
      setNotice('剧情线已删除。');
    } catch (deleteError) {
      setActionError(deleteError.message || '剧情线删除失败');
    } finally {
      setActionLoading('');
    }
  }

  return (
    <div className={`books-admin-page library-page library-app-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}${sidebarCollapsed && sidebarPeek ? ' is-sidebar-peek' : ''}`}>
      <aside
        className="library-sidebar"
        aria-label="资料库导航"
      >
        <div className="library-sidebar-head">
          <div className="library-surface-switcher">
            <button
              type="button"
              className="library-surface-entry is-primary"
              onClick={() => openBooksSummaryPage('')}
              title="返回资料库列表"
              aria-current="page"
            >
              <span className="library-sidebar-kicker">书籍管理</span>
              <strong>资料库</strong>
            </button>
            <button
              type="button"
              className="library-surface-entry is-secondary"
              onClick={() => openWorkbench(bookId)}
              disabled={!bookId}
              title="切换到创作台"
            >
              <span className="library-sidebar-kicker">章节创作</span>
              <strong>创作台</strong>
            </button>
          </div>
        </div>
        <nav className="library-sidebar-nav" aria-label="资料库页面">
          <button type="button" data-short="列" className="library-nav-item" onClick={() => openBooksSummaryPage('')} title="书籍列表">书籍列表</button>
          <button type="button" data-short="总" className="library-nav-item" onClick={() => openBooksSummaryPage(bookId)} disabled={!bookId} title="全书汇总">全书汇总</button>
          <button type="button" data-short="纲" className="library-nav-item" onClick={() => openBooksOutlinePage(bookId)} disabled={!bookId} title="大纲链">大纲链</button>
          <button type="button" data-short="脉" className="library-nav-item is-active" disabled={!bookId} title="叙事脉络">叙事脉络</button>
          <button type="button" data-short="角" className="library-nav-item" onClick={() => openBooksCharacterPage(bookId)} disabled={!bookId} title="角色资料">角色资料</button>
          <button type="button" data-short="章" className="library-nav-item" onClick={() => openBooksChapterPage(bookId)} disabled={!bookId} title="章节与正文">章节与正文</button>
        </nav>
        <div className="library-sidebar-section">
          <div className="library-sidebar-context">
            <span>当前操作书籍</span>
            <strong>{book?.title || '请先选择书籍'}</strong>
          </div>
          {books.length > 1 ? (
            <label className="library-book-switcher">
              <span>切换书籍</span>
              <select value={bookId} onChange={(event) => switchCurrentBook(event.target.value)}>
                {books.map((item) => <option key={item.id} value={item.id}>{item.title || '未命名书籍'}</option>)}
              </select>
            </label>
          ) : null}
          {!bookId ? <p className="library-sidebar-note">先在书籍列表选择或新建一本书，才能管理叙事脉络。</p> : null}
        </div>
      </aside>

      <main className="library-main">
        <div className="library-page-title">
          <h2>资料库 · 叙事脉络页</h2>
        </div>
      {!bookId ? (
        <section className="detail-panel">
          <div className="detail-section-head">
            <strong>还没有选中书籍</strong>
          </div>
          <p className="excerpt-text">先在资料库汇总页选择一本书，再进入叙事脉络页。</p>
          <div className="detail-inline-actions mt-4">
            <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openBooksSummaryPage('')}>
              去资料库
            </button>
          </div>
        </section>
      ) : (
        <section>
          {loading ? (
            <div className="global-banner">正在加载叙事脉络...</div>
          ) : error ? (
            <div className="global-banner global-banner-error">{error}</div>
          ) : (
            <div className="detail-grid">
              <div className="detail-main">
                <section className="detail-panel storyline-control-panel">
                  <div className="detail-panel-actions">
                    <div>
                      <span className="storyline-board-kicker">剧情线编辑</span>
                      <h3>本卷剧情线设置与生成</h3>
                    </div>
                    <div className="detail-inline-actions">
                      <button type="button" className="ghost-btn" onClick={openCreateEditor}>新增剧情线</button>
                      <button type="button" className="solid-btn" onClick={handleGenerateVolumeStorylines} disabled={actionLoading === 'volume-generate'}>
                        {actionLoading === 'volume-generate'
                          ? 'AI 处理中...'
                          : selectedVolumeStorylines.length > 0 ? 'AI 重新生成本卷脉络' : 'AI 生成本卷脉络'}
                      </button>
                    </div>
                  </div>
                  {actionError ? <div className="global-banner global-banner-error">{actionError}</div> : null}
                  {notice ? <div className="global-banner">{notice}</div> : null}
                  <div className="storyline-control-grid">
                    <label className="detail-inline-field storyline-volume-select-field">
                      <span>当前分卷</span>
                      <select value={selectedVolumeNumber} onChange={(event) => setSelectedVolumeNumber(Number(event.target.value || 1))}>
                        {(volumePlans.length > 0 ? volumePlans : [{ volumeNumber: 1, volume_name: '当前卷' }]).map((plan) => (
                          <option key={plan.id || plan.volumeNumber} value={plan.volumeNumber}>第 {plan.volumeNumber} 卷 · {plan.volume_name || '未命名分卷'}</option>
                        ))}
                      </select>
                    </label>
                    <label className="detail-inline-field storyline-ai-goal">
                      <span>AI 补充要求</span>
                      <textarea rows={1} value={aiGoal} onChange={(event) => setAiGoal(event.target.value)} placeholder="可选，例如：主线更偏悬疑，关系支线在卷末留钩子。" />
                    </label>
                  </div>
                  {selectedVolumePlan ? (
                    <p className="excerpt-text"><b>生成依据：</b>{selectedVolumePlan.stage_goal || '暂无阶段目标'} · {selectedVolumePlan.core_conflict || '暂无核心冲突'}</p>
                  ) : null}

                  {editorOpen ? (
                    <div className="storyline-full-editor" ref={editorRef}>
                      <div className="detail-section-head">
                        <strong>{storylineDraft.id ? '编辑剧情线' : '新增剧情线'}</strong>
                        <button type="button" className="ghost-btn" onClick={() => setEditorOpen(false)} disabled={actionLoading === 'save'}>取消</button>
                      </div>
                      <div className="storyline-editor-grid">
                        <label className="detail-inline-field storyline-compact-field"><span>名称</span><input value={storylineDraft.storyline_name} onChange={(event) => updateStorylineDraft('storyline_name', event.target.value)} /></label>
                        <label className="detail-inline-field storyline-compact-field"><span>类型</span><select value={storylineDraft.storyline_type} onChange={(event) => updateStorylineDraft('storyline_type', event.target.value)}><option value="main">主线</option><option value="branch">支线</option></select></label>
                        <div className="storyline-range-field">
                          <span>章节范围</span>
                          <div className="storyline-range-inputs">
                            <label><em>起始</em><input type="number" min="1" value={storylineDraft.start_chapter} onChange={(event) => updateStorylineDraft('start_chapter', Number(event.target.value || 1))} /></label>
                            <i />
                            <label><em>结束</em><input type="number" min={storylineDraft.start_chapter || 1} value={storylineDraft.end_chapter} onChange={(event) => updateStorylineDraft('end_chapter', Number(event.target.value || 1))} /></label>
                          </div>
                        </div>
                        <label className="detail-inline-field storyline-long-field is-wide"><span>推进说明</span><textarea rows={3} value={storylineDraft.description} onChange={(event) => updateStorylineDraft('description', event.target.value)} placeholder="写这条剧情线负责推进什么、如何影响本卷节奏。" /></label>
                        <label className="detail-inline-field storyline-long-field is-wide"><span>核心冲突</span><textarea rows={3} value={storylineDraft.core_conflict} onChange={(event) => updateStorylineDraft('core_conflict', event.target.value)} placeholder="写清主要矛盾、对抗双方、阶段性升级点。" /></label>
                      </div>
                      <div className="detail-inline-actions">
                        <button type="button" className="solid-btn" onClick={handleSaveStoryline} disabled={actionLoading === 'save'}>{actionLoading === 'save' ? '保存中...' : '保存剧情线'}</button>
                      </div>
                    </div>
                  ) : null}
                </section>

                <details className="storyline-progress-disclosure">
                  <summary>查看叙事进度看板</summary>
                <article className="storyline-board-card">
                  <div className="storyline-board-copy">
                    <div>
                      <span className="storyline-board-kicker">叙事进度看板</span>
                      <strong>叙事进度表与章数动态校正图</strong>
                    </div>
                    <div className="storyline-board-guide">
                      <span>初始章数</span>
                      <span>动态校正</span>
                      <span>收卷判断</span>
                    </div>
                  </div>

                  {storylineBoard.rows.length > 0 ? (
                    <div className="storyline-board-shell">
                      <div className="storyline-header-row">
                        <div className="storyline-header-side">
                          <strong>卷与章数</strong>
                          <span>横轴共 {storylineBoard.totalChapters} 章</span>
                        </div>
                        <div
                          className="storyline-volume-overview"
                          style={{ gridTemplateColumns: `repeat(${storylineBoard.totalChapters}, minmax(24px, 1fr))` }}
                        >
                          {storylineBoard.volumeBands.map((band) => (
                            <div
                              key={`${band.label}-${band.start}-${band.end}`}
                              className="storyline-volume-band"
                              style={{ gridColumn: `${band.start} / span ${band.span}` }}
                            >
                              <strong>{band.label}</strong>
                              <span>{band.range}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {storylineBoard.markerChapter > 0 ? (
                        <div className="storyline-current-guide">
                          <div className="storyline-current-guide-spacer">
                            <span>当前推进坐标</span>
                          </div>
                          <div className="storyline-current-guide-track">
                            <div
                              className="storyline-current-marker"
                              style={{ left: `${Math.min(100, Math.max(0, ((storylineBoard.markerChapter - 1) / Math.max(1, storylineBoard.totalChapters)) * 100))}%` }}
                            >
                              <span>最近回写：第 {storylineBoard.markerChapter} 章</span>
                            </div>
                          </div>
                        </div>
                      ) : null}

                      <div className="storyline-board-grid">
                        {storylineBoard.rows.map((row) => (
                          <div key={row.id} className="storyline-row">
                            <div className="storyline-row-meta">
                              <strong>{row.label}</strong>
                              <p>{row.hint}</p>
                            </div>
                            <div
                              className="storyline-row-track"
                              style={{ gridTemplateColumns: `repeat(${storylineBoard.totalChapters}, minmax(24px, 1fr))` }}
                            >
                              <div className={`storyline-bar is-${row.tone}`} style={getTimelineBarStyle(row, storylineBoard.totalChapters)}>
                                <strong>卷内第 {row.localStart}-{row.localEnd} 章</strong>
                                <p>{row.lastChapter ? `已推进到第 ${row.lastChapter} 章` : '尚无章节回写'}</p>
                                <span>全书第 {row.start}-{row.end} 章 · {row.correction}</span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                    </div>
                  ) : (
                    <div className="storyline-board-empty">
                      <strong>还没有可绘制的叙事脉络进度</strong>
                      <p>创建主线或支线后，这里会按起止章节生成进度表，并在章节生成回写后显示动态校正状态。</p>
                    </div>
                  )}
                </article>
                </details>

                <div className="detail-panel storyline-volume-panel">
                  <div className="detail-panel-actions">
                    <h3>分卷脉络</h3>
                  </div>

                  {storylineGroups.length > 0 ? (
                    <div className="detail-volume-plan-list mt-4">
                      {storylineGroups.map((group) => {
                        const matchedVolumePlan = volumeStageMap.get(group.volumeNumber);
                        return (
                          <section key={`storyline-volume-${group.volumeNumber}`} className="detail-outline-volume">
                            <div className="detail-section-head">
                              <strong>第 {group.volumeNumber} 卷</strong>
                              <span className="detail-entry-meta">
                                {group.items.length} 条脉络
                                {matchedVolumePlan?.estimated_chapters ? ` · 预计 ${matchedVolumePlan.estimated_chapters} 章` : ''}
                              </span>
                            </div>

                            {matchedVolumePlan?.stage_goal ? (
                              <p className="excerpt-text"><b>卷目标：</b>{matchedVolumePlan.stage_goal}</p>
                            ) : null}
                            {matchedVolumePlan?.core_conflict ? (
                              <p className="excerpt-text"><b>卷冲突：</b>{matchedVolumePlan.core_conflict}</p>
                            ) : null}

                            <div className="detail-storyline-list">
                              {group.items.map((storyline) => (
                                <article key={storyline.id} className="detail-storyline-item">
                                  <div className="detail-section-head">
                                    <strong>
                                      {storyline.name}
                                      {storyline.type ? ` · ${formatStorylineTypeLabel(storyline.type)}` : ''}
                                    </strong>
                                    <div className="detail-inline-actions">
                                      <span className="detail-entry-meta">线序 {storyline.storylineNumber} · 预计第 {storyline.startChapter} - {storyline.endChapter} 章</span>
                                      <button type="button" className="ghost-btn" onClick={() => openEditEditor(storyline)}>编辑</button>
                                      <button type="button" className="ghost-btn" onClick={() => handleGenerateStoryline(storyline)} disabled={actionLoading === `generate-${storyline.id}`}>{actionLoading === `generate-${storyline.id}` ? '生成中...' : 'AI 重新生成'}</button>
                                      <button type="button" className="ghost-btn" onClick={() => handleDeleteStoryline(storyline)} disabled={actionLoading === `delete-${storyline.id}`}>删除</button>
                                    </div>
                                  </div>
                                  {storyline.coreConflict ? (
                                    <p className="excerpt-text"><b>核心冲突：</b>{storyline.coreConflict}</p>
                                  ) : null}
                                  {storyline.description ? (
                                    <p className="excerpt-text"><b>说明：</b>{storyline.description}</p>
                                  ) : null}
                                  {storyline.structuredContent?.summary ? (
                                    <p className="excerpt-text"><b>AI 大纲：</b>{storyline.structuredContent.summary}</p>
                                  ) : null}
                                  {Array.isArray(storyline.structuredContent?.keyBeats) ? (
                                    <div className="storyline-node-summary">
                                      <span>正式节点 {storyline.structuredContent?.keyBeats?.length || 0} 个</span>
                                      <button type="button" className="ghost-btn" onClick={() => setNodeDetailStoryline(storyline)}>查看节点内容</button>
                                    </div>
                                  ) : null}
                                  {completedStorylineId === storyline.id ? (
                                    <p className="excerpt-text"><b>本次操作：</b>AI 重新生成已完成，以上大纲和节点统计已刷新。</p>
                                  ) : null}
                                </article>
                              ))}
                            </div>
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="detail-outline-volume mt-4">
                      <div className="detail-section-head">
                        <strong>当前还没有叙事脉络</strong>
                      </div>
                      <p className="excerpt-text">选择分卷后，可以手动新增剧情线，也可以让 AI 根据分卷目标直接生成本卷剧情线集合。</p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </section>
      )}
      </main>

      {nodeDetailStoryline ? (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setNodeDetailStoryline(null);
        }}>
          <section className="modal-panel storyline-node-modal" role="dialog" aria-modal="true" aria-label={`${nodeDetailStoryline.name}节点内容`}>
            <div className="modal-head">
              <div>
                <h3>{nodeDetailStoryline.name} · 节点内容</h3>
                <p>按预计章节查看这条剧情线的正式推进节点。</p>
              </div>
              <button type="button" className="ghost-btn modal-close-btn" onClick={() => setNodeDetailStoryline(null)}>关闭</button>
            </div>
            <div className="modal-body storyline-node-sections">
              <div className="storyline-node-section">
                <strong>正式节点（{nodeDetailStoryline.structuredContent?.keyBeats?.length || 0}）</strong>
                {(nodeDetailStoryline.structuredContent?.keyBeats || []).map((beat, index) => (
                  <div className="storyline-node-card is-formal" key={beat.beatId || `formal-${index}`}>
                    <b>第 {beat.chapterApprox || '?'} 章 · {beat.title || `正式节点 ${index + 1}`}</b>
                    {beat.summary ? <p>事件：{beat.summary}</p> : null}
                    {beat.expectedChange ? <p>预期变化：{beat.expectedChange}</p> : null}
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      ) : null}

      <style>{`
        .library-page.library-app-shell {
          --books-admin-radius: 18px;
          --books-admin-radius-sm: 12px;
          position: relative;
          display: grid;
          grid-template-columns: 268px minmax(0, 1fr);
          align-items: start;
          gap: 16px;
          width: min(1480px, calc(100% - 1rem));
          padding-top: 14px;
          padding-bottom: 36px;
          transition: grid-template-columns 160ms ease;
        }
        .library-page .storyline-control-panel {
          display: grid;
          gap: 16px;
          margin-bottom: 16px;
          order: 1;
          border: 1px solid color-mix(in srgb, var(--brand) 20%, var(--line));
          border-radius: 16px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white), color-mix(in srgb, var(--brand-soft) 10%, var(--panel)));
          box-shadow: 0 14px 32px color-mix(in srgb, var(--brand-deep) 7%, transparent);
          padding: 14px;
        }
        .library-page .storyline-volume-panel {
          order: 2;
          border: 1px solid color-mix(in srgb, var(--brand) 14%, var(--line));
          border-radius: 16px;
          background: color-mix(in srgb, var(--panel) 94%, white);
          box-shadow: 0 10px 24px color-mix(in srgb, var(--text) 4%, transparent);
          padding: 14px;
        }
        .library-page .storyline-board-card {
          order: 3;
        }
        .library-page .storyline-control-grid,
        .library-page .storyline-editor-grid {
          display: grid;
          grid-template-columns: minmax(260px, 0.7fr) minmax(0, 1.3fr);
          gap: 12px;
        }
        .library-page .storyline-ai-goal,
        .library-page .storyline-editor-grid .is-wide {
          grid-column: 1 / -1;
        }
        .library-page .storyline-control-grid .detail-inline-field {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          align-items: center;
          min-width: 0;
          border: 1px solid color-mix(in srgb, var(--line-strong) 28%, var(--line));
          border-radius: 10px;
          background: color-mix(in srgb, var(--panel) 92%, white);
          padding: 8px 10px;
          gap: 10px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 66%, transparent),
            0 8px 18px color-mix(in srgb, var(--text) 4%, transparent);
        }
        .library-page .storyline-control-grid .detail-inline-field span {
          color: color-mix(in srgb, var(--text) 72%, var(--muted));
          font-size: 12px;
          font-weight: 800;
        }
        .library-page .storyline-control-grid select,
        .library-page .storyline-control-grid textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border-color: color-mix(in srgb, var(--brand) 22%, var(--line));
          background: color-mix(in srgb, white 96%, var(--panel));
        }
        .library-page .storyline-control-grid select:focus,
        .library-page .storyline-control-grid textarea:focus {
          border-color: color-mix(in srgb, var(--brand) 42%, var(--line));
          outline: none;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-soft) 34%, transparent);
        }
        .library-page .storyline-volume-select-field {
          align-self: stretch;
        }
        .library-page .storyline-volume-select-field select {
          min-height: 36px;
        }
        .library-page .storyline-ai-goal {
          background: linear-gradient(180deg, color-mix(in srgb, var(--brand-soft) 24%, white), color-mix(in srgb, var(--panel) 92%, white));
          border-color: color-mix(in srgb, var(--brand) 24%, var(--line));
        }
        .library-page .storyline-ai-goal textarea {
          min-height: 36px;
          height: 36px;
          line-height: 1.45;
          resize: vertical;
        }
        .library-page .storyline-node-summary {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          margin-top: 10px;
          color: var(--muted);
          font-size: 12px;
        }
        .library-page .storyline-node-modal {
          width: min(1040px, calc(100vw - 32px));
          max-height: min(820px, calc(100vh - 40px));
        }
        .library-page .storyline-node-sections {
          display: grid;
          grid-template-columns: minmax(0, 1fr);
          gap: 12px;
        }
        .library-page .storyline-node-modal .modal-body {
          overflow-y: auto;
        }
        .library-page .storyline-node-section {
          display: grid;
          align-content: start;
          gap: 8px;
          min-width: 0;
        }
        .library-page .storyline-node-section > strong {
          color: var(--brand-deep);
          font-size: 13px;
        }
        .library-page .storyline-node-card {
          display: grid;
          gap: 5px;
          border: 1px solid var(--line);
          border-radius: 10px;
          padding: 10px 12px;
          background: color-mix(in srgb, var(--panel) 94%, white);
        }
        .library-page .storyline-node-card.is-formal {
          border-left: 3px solid color-mix(in srgb, var(--accent) 68%, var(--line));
        }
        .library-page .storyline-node-card b {
          color: var(--text);
          font-size: 13px;
        }
        .library-page .storyline-node-card p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.55;
          overflow-wrap: anywhere;
        }
        .library-page .storyline-full-editor {
          display: grid;
          gap: 0;
          overflow: hidden;
          border: 1px solid color-mix(in srgb, var(--brand) 42%, var(--line));
          border-radius: 16px;
          background:
            linear-gradient(180deg, color-mix(in srgb, var(--brand-soft) 52%, white) 0%, color-mix(in srgb, var(--surface) 94%, white) 100%);
          box-shadow:
            0 18px 38px color-mix(in srgb, var(--brand-deep) 12%, transparent),
            inset 0 1px 0 color-mix(in srgb, white 72%, transparent);
        }
        .library-page .storyline-full-editor > .detail-section-head {
          align-items: center;
          border-bottom: 1px solid color-mix(in srgb, var(--brand) 28%, var(--line));
          background: linear-gradient(180deg, color-mix(in srgb, var(--brand-soft) 62%, white), color-mix(in srgb, var(--brand-soft) 42%, var(--surface)));
          padding: 12px 14px;
        }
        .library-page .storyline-full-editor > .detail-section-head strong {
          color: var(--brand-deep);
          font-size: 1.16rem;
        }
        .library-page .storyline-full-editor .storyline-editor-grid {
          border: 0;
          border-radius: 0;
          background: transparent;
          padding: 12px;
        }
        .library-page .storyline-full-editor .detail-inline-field {
          min-width: 0;
          gap: 10px;
          border: 1px solid color-mix(in srgb, var(--line-strong) 28%, var(--line));
          border-radius: 10px;
          background: color-mix(in srgb, var(--panel) 92%, white);
          padding: 8px 10px;
          box-shadow:
            inset 0 1px 0 color-mix(in srgb, white 66%, transparent),
            0 8px 18px color-mix(in srgb, var(--text) 4%, transparent);
        }
        .library-page .storyline-full-editor .storyline-compact-field {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          align-items: center;
        }
        .library-page .storyline-full-editor .storyline-range-field {
          display: grid;
          grid-column: 1 / -1;
          grid-template-columns: max-content minmax(0, 1fr);
          align-items: center;
          gap: 10px;
          border: 1px solid color-mix(in srgb, var(--brand) 28%, var(--line));
          border-radius: 10px;
          background: linear-gradient(180deg, color-mix(in srgb, var(--brand-soft) 34%, white), color-mix(in srgb, var(--panel) 92%, white));
          padding: 8px 10px;
          box-shadow: inset 0 1px 0 color-mix(in srgb, white 66%, transparent);
        }
        .library-page .storyline-full-editor .storyline-range-field > span,
        .library-page .storyline-full-editor .detail-inline-field span {
          color: color-mix(in srgb, var(--text) 72%, var(--muted));
          font-size: 12px;
          font-weight: 800;
        }
        .library-page .storyline-full-editor .storyline-range-inputs {
          display: grid;
          grid-template-columns: minmax(0, 1fr) 14px minmax(0, 1fr);
          align-items: center;
          gap: 8px;
        }
        .library-page .storyline-full-editor .storyline-range-inputs label {
          display: grid;
          grid-template-columns: max-content minmax(0, 1fr);
          align-items: center;
          gap: 6px;
          min-width: 0;
        }
        .library-page .storyline-full-editor .storyline-range-inputs em {
          color: var(--muted);
          font-size: 11px;
          font-style: normal;
          font-weight: 750;
        }
        .library-page .storyline-full-editor .storyline-range-inputs i {
          display: block;
          width: 12px;
          height: 2px;
          margin: 0;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 34%, var(--line));
        }
        .library-page .storyline-full-editor .storyline-long-field {
          grid-column: 1 / -1;
          background: linear-gradient(180deg, color-mix(in srgb, var(--surface) 92%, white), color-mix(in srgb, var(--brand-soft) 10%, var(--panel)));
        }
        .library-page .storyline-full-editor .storyline-long-field textarea {
          display: block;
          width: 100%;
          min-width: 0;
          min-height: 92px;
          box-sizing: border-box;
          line-height: 1.55;
        }
        .library-page .storyline-full-editor input,
        .library-page .storyline-full-editor select,
        .library-page .storyline-full-editor textarea {
          width: 100%;
          min-width: 0;
          box-sizing: border-box;
          border-color: color-mix(in srgb, var(--brand) 22%, var(--line));
          background: color-mix(in srgb, white 96%, var(--panel));
        }
        .library-page .storyline-full-editor input:focus,
        .library-page .storyline-full-editor select:focus,
        .library-page .storyline-full-editor textarea:focus {
          border-color: color-mix(in srgb, var(--brand) 42%, var(--line));
          outline: none;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--brand-soft) 34%, transparent);
        }
        .library-page .storyline-full-editor > .detail-inline-actions {
          border-top: 1px solid color-mix(in srgb, var(--brand) 18%, var(--line));
          background: linear-gradient(180deg, color-mix(in srgb, var(--panel-strong) 80%, white), color-mix(in srgb, var(--brand-soft) 12%, var(--panel)));
          padding: 12px 14px 14px;
          justify-content: flex-end;
        }
        .library-page.library-app-shell.is-sidebar-collapsed {
          grid-template-columns: 12px minmax(0, 1fr);
          gap: 10px;
        }
        .library-page.library-app-shell.is-sidebar-collapsed.is-sidebar-peek,
        .library-page.library-app-shell.is-sidebar-collapsed:has(.library-sidebar-hotzone:hover),
        .library-page.library-app-shell.is-sidebar-collapsed:has(.library-sidebar:hover),
        .library-page.library-app-shell.is-sidebar-collapsed:has(.library-sidebar:focus-within) {
          grid-template-columns: 268px minmax(0, 1fr);
          gap: 16px;
        }
        .library-sidebar-hotzone {
          display: none;
        }
        .library-page.library-app-shell.is-sidebar-collapsed .library-sidebar-hotzone {
          position: absolute;
          top: 14px;
          left: 0;
          z-index: 21;
          display: block;
          width: 24px;
          height: min(520px, calc(100vh - 120px));
          cursor: pointer;
        }
        .library-page.library-app-shell.is-sidebar-collapsed .library-sidebar-hotzone::after {
          content: '';
          position: absolute;
          top: 34px;
          left: 5px;
          width: 3px;
          height: 64px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 72%, transparent);
        }
        .library-page.library-app-shell.is-sidebar-peek .library-sidebar-hotzone {
          display: none;
        }
        .library-sidebar {
          position: sticky;
          top: 14px;
          display: grid;
          gap: 14px;
          max-height: none;
          overflow: visible;
          border-right: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
          padding: 6px 14px 18px 0;
          transition: transform 180ms ease, box-shadow 180ms ease, background 180ms ease;
        }
        .library-sidebar::-webkit-scrollbar {
          width: 6px;
        }
        .library-sidebar::-webkit-scrollbar-track {
          background: transparent;
        }
        .library-sidebar::-webkit-scrollbar-thumb {
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 22%, transparent);
        }
        .library-sidebar-toggle {
          width: 34px;
          min-height: 30px;
          border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
          border-radius: 10px;
          background: color-mix(in srgb, var(--panel-strong) 90%, white);
          color: var(--brand-deep);
          font-size: 18px;
          font-weight: 900;
          line-height: 1;
          cursor: pointer;
          justify-self: end;
        }
        .library-sidebar-toggle:hover {
          border-color: color-mix(in srgb, var(--brand) 30%, var(--line));
          background: color-mix(in srgb, var(--brand-soft) 48%, white);
        }
        .library-main { min-width: 0; }
        .library-page-title {
          margin: 2px 0 12px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 78%, transparent);
          padding-bottom: 10px;
        }
        .library-page-title h2 {
          margin: 0;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: clamp(1.18rem, 1.7vw, 1.45rem);
          font-weight: 900;
          line-height: 1.15;
          letter-spacing: -0.035em;
        }
        .library-sidebar-head {
          display: grid;
          gap: 12px;
          padding-bottom: 10px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
        }
        .library-surface-switcher {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 8px;
          align-items: stretch;
        }
        .library-surface-entry {
          appearance: none;
          display: grid;
          gap: 4px;
          min-width: 0;
          min-height: 58px;
          border: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
          border-radius: 12px;
          background: color-mix(in srgb, var(--surface) 74%, transparent);
          padding: 10px 12px;
          color: var(--text);
          cursor: pointer;
          text-align: left;
          transition: border-color 140ms ease, background 140ms ease, color 140ms ease;
        }
        .library-surface-entry:hover,
        .library-surface-entry.is-primary {
          border-color: color-mix(in srgb, var(--brand) 36%, var(--line));
          background: color-mix(in srgb, var(--brand) 7%, var(--surface));
        }
        .library-surface-entry strong {
          margin: 0;
          color: var(--text);
          font-family: var(--font-serif);
          font-size: 22px;
          font-weight: 900;
          line-height: 1;
          letter-spacing: -0.04em;
        }
        .library-surface-entry:hover strong {
          color: var(--brand-deep);
        }
        .library-surface-entry:disabled {
          cursor: not-allowed;
          opacity: 0.42;
        }
        .library-sidebar-kicker,
        .library-sidebar-label {
          color: var(--brand);
          font-family: var(--font-mono);
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .library-sidebar-context {
          display: grid;
          gap: 3px;
          padding-top: 2px;
        }
        .library-sidebar-context span {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.35;
        }
        .library-sidebar-context strong {
          color: var(--text);
          font-size: 14px;
          font-weight: 800;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .library-sidebar-section {
          display: grid;
          gap: 9px;
          padding: 12px 0;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 76%, transparent);
        }
        .library-sidebar-book {
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.14rem;
          font-weight: 900;
          line-height: 1.24;
        }
        .library-book-switcher {
          display: grid;
          gap: 5px;
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }
        .library-book-switcher select {
          width: 100%;
          min-width: 0;
          border: 1px solid var(--line);
          border-radius: var(--radius-panel-sm);
          background: var(--panel-strong);
          color: var(--text);
          padding: 7px 8px;
          font: inherit;
          font-size: 13px;
        }
        .library-sidebar-nav,
        .library-sidebar-actions {
          display: grid;
          gap: 7px;
        }
        .library-nav-item {
          min-height: 34px;
          border: 0;
          border-left: 2px solid transparent;
          border-radius: 0 10px 10px 0;
          background: transparent;
          padding: 0 10px;
          color: var(--muted);
          font: inherit;
          font-size: 14px;
          font-weight: 700;
          text-align: left;
          cursor: pointer;
        }
        .library-nav-item:hover:not(:disabled),
        .library-nav-item.is-active {
          border-left-color: var(--brand);
          background: color-mix(in srgb, var(--brand-soft) 42%, transparent);
          color: var(--brand-deep);
        }
        .library-nav-item:disabled {
          cursor: not-allowed;
          opacity: 0.45;
        }
        .library-page.library-app-shell.is-sidebar-collapsed .library-sidebar {
          width: 260px;
          min-height: 240px;
          overflow: hidden;
          transform: translateX(-248px);
          z-index: 20;
          border-right-color: color-mix(in srgb, var(--brand) 28%, var(--line));
          border-radius: 0 16px 16px 0;
          background: color-mix(in srgb, var(--panel) 96%, white);
          box-shadow: none;
          padding: 8px 12px 14px 0;
        }
        .library-page.library-app-shell.is-sidebar-collapsed.is-sidebar-peek .library-sidebar,
        .library-page.library-app-shell.is-sidebar-collapsed:has(.library-sidebar-hotzone:hover) .library-sidebar,
        .library-page.library-app-shell.is-sidebar-collapsed .library-sidebar:hover,
        .library-page.library-app-shell.is-sidebar-collapsed .library-sidebar:focus-within {
          overflow: auto;
          transform: translateX(0);
          box-shadow: 18px 0 36px color-mix(in srgb, var(--text) 10%, transparent);
          padding-left: 12px;
        }
        .library-page.library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within) .library-sidebar-head,
        .library-page.library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within) .library-sidebar-section,
        .library-page.library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within) .library-sidebar-nav {
          display: none;
        }
        .library-page.library-app-shell.is-sidebar-collapsed:not(.is-sidebar-peek):not(:has(.library-sidebar-hotzone:hover)) .library-sidebar:not(:hover):not(:focus-within)::after {
          content: '';
          position: absolute;
          top: 46px;
          right: 2px;
          width: 3px;
          height: 56px;
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 72%, transparent);
        }
        .library-page.library-app-shell.is-sidebar-collapsed .library-sidebar-toggle {
          width: 24px;
          min-height: 44px;
          border-radius: 999px;
          padding: 0;
          transform: translateX(4px);
        }
        .library-page .detail-grid {
          grid-template-columns: minmax(0, 1fr);
        }
        .library-page .detail-main,
        .library-page .detail-volume-plan-list,
        .library-page .detail-storyline-list {
          display: grid;
          gap: 12px;
          min-width: 0;
        }
        .library-page .detail-panel,
        .library-page .detail-outline-volume,
        .library-page .detail-storyline-item {
          min-width: 0;
          border: 1px solid color-mix(in srgb, var(--line-strong) 44%, var(--line));
          border-radius: var(--books-admin-radius);
          background: color-mix(in srgb, var(--panel) 92%, white);
          padding: 14px;
          box-shadow: 0 8px 24px color-mix(in srgb, var(--text) 5%, transparent);
        }
        .library-page .detail-outline-volume {
          background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white), color-mix(in srgb, var(--brand-soft) 16%, var(--panel)));
        }
        .library-page .detail-storyline-item {
          border-radius: var(--books-admin-radius-sm);
          background: color-mix(in srgb, var(--panel-strong) 94%, white);
          border-left: 4px solid color-mix(in srgb, var(--brand) 34%, var(--line));
        }
        .library-page .detail-panel-actions,
        .library-page .detail-section-head {
          display: flex;
          min-width: 0;
          align-items: flex-start;
          justify-content: space-between;
          gap: 10px;
        }
        .library-page .detail-panel h3,
        .library-page .detail-section-head strong {
          margin: 0;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.12rem;
          font-weight: 900;
          line-height: 1.25;
          letter-spacing: -0.025em;
        }
        .library-page .detail-entry-meta {
          flex: 0 0 auto;
          color: var(--muted);
          font-size: 13px;
          font-weight: 700;
          line-height: 1.5;
        }
        .library-page .excerpt-text {
          margin: 8px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.75;
        }
        .library-page .detail-inline-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .library-page .solid-btn,
        .library-page .ghost-btn {
          min-height: 38px;
          border-radius: 11px;
          padding: 0 14px;
          font-size: 13px;
          font-weight: 800;
          transition: transform 140ms ease, box-shadow 140ms ease, border-color 140ms ease, background 140ms ease;
        }
        .library-page .solid-btn {
          box-shadow: 0 10px 20px color-mix(in srgb, var(--brand) 18%, transparent);
        }
        .library-page .solid-btn:hover,
        .library-page .ghost-btn:hover {
          transform: translateY(-1px);
        }
        .library-page .ghost-btn {
          border: 1px solid color-mix(in srgb, var(--brand) 22%, var(--line));
          background: color-mix(in srgb, var(--surface) 88%, white);
          color: var(--brand-deep);
        }
        .library-page .global-banner {
          margin: 10px 0;
          border-radius: var(--books-admin-radius-sm);
          padding: 10px 12px;
          font-size: 14px;
        }
        .library-page .storyline-board-card {
          display: grid;
          gap: 10px;
          min-width: 0;
          border: 1px solid color-mix(in srgb, var(--brand) 18%, var(--line));
          border-radius: var(--books-admin-radius);
          background: linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white), color-mix(in srgb, var(--brand-soft) 14%, var(--panel)));
          padding: 10px 12px 12px;
          box-shadow: 0 14px 32px color-mix(in srgb, var(--brand-deep) 8%, transparent);
        }
        .library-page .storyline-progress-disclosure {
          border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
          border-radius: var(--radius-panel-lg);
          background: color-mix(in srgb, var(--panel) 88%, var(--brand-soft));
          overflow: hidden;
        }
        .library-page .storyline-progress-disclosure > summary {
          cursor: pointer;
          list-style: none;
          padding: 12px 14px;
          color: var(--brand-deep);
          font-size: 13px;
          font-weight: 800;
        }
        .library-page .storyline-progress-disclosure > summary::-webkit-details-marker { display: none; }
        .library-page .storyline-progress-disclosure > summary::after { content: '展开'; float: right; color: var(--muted); font-weight: 700; }
        .library-page .storyline-progress-disclosure[open] > summary::after { content: '收起'; }
        .library-page .storyline-progress-disclosure[open] > summary { border-bottom: 1px solid color-mix(in srgb, var(--line) 86%, transparent); }
        .library-page .storyline-progress-disclosure .storyline-board-card { border: 0; border-radius: 0; box-shadow: none; }
        .library-page .storyline-board-copy {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 80%, transparent);
          padding-bottom: 8px;
        }
        .library-page .storyline-board-kicker {
          color: var(--brand);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          font-weight: 850;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .library-page .storyline-board-copy strong {
          display: block;
          margin-top: 2px;
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.03rem;
          font-weight: 900;
          line-height: 1.18;
          letter-spacing: -0.03em;
        }
        .library-page .storyline-board-guide {
          display: flex;
          flex-wrap: wrap;
          justify-content: flex-end;
          gap: 6px;
        }
        .library-page .storyline-board-guide span {
          display: inline-flex;
          align-items: center;
          min-height: 22px;
          border: 1px solid color-mix(in srgb, var(--brand) 18%, var(--line));
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand-soft) 34%, white);
          padding: 0 8px;
          color: var(--brand-deep);
          font-size: 13px;
          font-weight: 800;
        }
        .library-page .storyline-board-shell {
          display: grid;
          gap: 7px;
          min-width: 0;
          overflow-x: auto;
          padding-bottom: 8px;
          scrollbar-width: auto;
          scrollbar-color: color-mix(in srgb, var(--brand) 42%, var(--line)) color-mix(in srgb, var(--panel-strong) 74%, transparent);
        }
        .library-page .storyline-board-shell::-webkit-scrollbar {
          height: 12px;
        }
        .library-page .storyline-board-shell::-webkit-scrollbar-track {
          border-radius: 999px;
          background: color-mix(in srgb, var(--panel-strong) 82%, white);
        }
        .library-page .storyline-board-shell::-webkit-scrollbar-thumb {
          min-width: 64px;
          border: 3px solid color-mix(in srgb, var(--panel-strong) 82%, white);
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand) 46%, var(--line));
        }
        .library-page .storyline-board-shell::-webkit-scrollbar-thumb:hover {
          background: color-mix(in srgb, var(--brand) 70%, var(--line));
        }
        .library-page .storyline-header-row,
        .library-page .storyline-current-guide,
        .library-page .storyline-row {
          display: grid;
          grid-template-columns: 180px minmax(660px, 1fr);
          gap: 8px;
          align-items: stretch;
        }
        .library-page .storyline-header-side,
        .library-page .storyline-row-meta {
          display: grid;
          align-content: center;
          gap: 2px;
          border: 1px solid color-mix(in srgb, var(--line-strong) 34%, var(--line));
          border-radius: var(--books-admin-radius-sm);
          background: color-mix(in srgb, var(--panel-strong) 96%, white);
          padding: 7px 10px;
        }
        .library-page .storyline-header-side strong,
        .library-page .storyline-row-meta strong {
          color: var(--text);
          font-size: 14px;
          font-weight: 900;
          line-height: 1.25;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .library-page .storyline-header-side span,
        .library-page .storyline-row-meta p {
          margin: 0;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.35;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .library-page .storyline-volume-overview,
        .library-page .storyline-row-track,
        .library-page .storyline-current-guide-track {
          min-width: 660px;
        }
        .library-page .storyline-volume-overview {
          display: grid;
          gap: 4px;
          align-items: stretch;
        }
        .library-page .storyline-volume-band {
          display: grid;
          align-content: center;
          min-height: 38px;
          border: 1px solid color-mix(in srgb, var(--brand) 18%, var(--line));
          border-radius: 12px;
          background: linear-gradient(135deg, color-mix(in srgb, var(--brand-soft) 56%, white), color-mix(in srgb, var(--panel-strong) 88%, white));
          padding: 5px 8px;
          overflow: hidden;
        }
        .library-page .storyline-volume-band strong,
        .library-page .storyline-volume-band span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .library-page .storyline-volume-band strong {
          color: var(--text);
          font-size: 13px;
          font-weight: 900;
        }
        .library-page .storyline-volume-band span {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }
        .library-page .storyline-current-guide-spacer {
          display: flex;
          align-items: center;
          color: var(--muted);
          font-size: 13px;
          font-weight: 800;
        }
        .library-page .storyline-current-guide-track {
          position: relative;
          min-height: 24px;
        }
        .library-page .storyline-current-marker {
          position: absolute;
          top: 0;
          bottom: 0;
          border-left: 2px dashed color-mix(in srgb, var(--brand) 72%, #af3450);
        }
        .library-page .storyline-current-marker span {
          position: absolute;
          top: 1px;
          left: 8px;
          display: inline-flex;
          align-items: center;
          min-height: 20px;
          border: 1px solid color-mix(in srgb, var(--brand) 24%, var(--line));
          border-radius: 999px;
          background: color-mix(in srgb, var(--brand-soft) 58%, white);
          padding: 0 8px;
          color: var(--brand-deep);
          font-size: 12px;
          font-weight: 850;
          white-space: nowrap;
        }
        .library-page .storyline-board-grid {
          display: grid;
          gap: 6px;
        }
        .library-page .storyline-row-track {
          position: relative;
          display: grid;
          gap: 4px;
          align-items: center;
          min-height: 42px;
          border-radius: 12px;
          border: 1px solid color-mix(in srgb, var(--line-strong) 24%, var(--line));
          background:
            repeating-linear-gradient(
              to right,
              color-mix(in srgb, var(--line) 38%, transparent) 0,
              color-mix(in srgb, var(--line) 38%, transparent) 1px,
              transparent 1px,
              transparent calc(100% / 12)
            ),
            color-mix(in srgb, var(--panel) 74%, white);
        }
        .library-page .storyline-bar {
          display: grid;
          align-content: center;
          gap: 2px;
          min-height: 38px;
          border: 1px solid color-mix(in srgb, var(--brand) 24%, var(--line));
          border-radius: 12px;
          padding: 5px 8px;
          overflow: hidden;
          background: linear-gradient(135deg, color-mix(in srgb, var(--brand-soft) 60%, white), color-mix(in srgb, var(--panel-strong) 88%, white));
          box-shadow: 0 8px 16px color-mix(in srgb, var(--text) 6%, transparent);
        }
        .library-page .storyline-bar.is-main {
          background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 26%, white), color-mix(in srgb, var(--brand-soft) 76%, white));
          border-color: color-mix(in srgb, var(--brand) 42%, var(--line));
          box-shadow: 0 10px 18px color-mix(in srgb, var(--brand) 18%, transparent);
        }
        .library-page .storyline-bar.is-branch-2,
        .library-page .storyline-bar.is-branch-4 {
          background: linear-gradient(135deg, color-mix(in srgb, #f7d6b3 80%, white), color-mix(in srgb, var(--panel-strong) 86%, white));
        }
        .library-page .storyline-bar strong,
        .library-page .storyline-bar p,
        .library-page .storyline-bar span {
          margin: 0;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .library-page .storyline-bar strong {
          color: var(--text);
          font-size: 13px;
          font-weight: 900;
          line-height: 1.2;
        }
        .library-page .storyline-bar p {
          color: var(--muted);
          font-size: 12px;
          font-weight: 700;
        }
        .library-page .storyline-bar span {
          width: fit-content;
          max-width: 100%;
          border-radius: 999px;
          background: color-mix(in srgb, white 82%, var(--brand-soft));
          padding: 1px 7px;
          color: var(--brand-deep);
          font-size: 12px;
          font-weight: 850;
        }
        .library-page .storyline-board-empty {
          display: grid;
          gap: 8px;
          border: 1px dashed color-mix(in srgb, var(--line) 84%, transparent);
          border-radius: var(--books-admin-radius-sm);
          background: color-mix(in srgb, var(--panel-strong) 76%, white);
          padding: 14px;
        }
        .library-page .storyline-board-empty strong {
          color: var(--text);
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.08rem;
          font-weight: 900;
        }
        .library-page .storyline-board-empty p {
          margin: 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.65;
        }
        @media (max-width: 980px) {
          .library-page.library-app-shell {
            grid-template-columns: 1fr;
          }
          .library-sidebar {
            position: static;
            max-height: none;
            border-right: 0;
            border-bottom: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
            padding-right: 0;
          }
          .library-page .storyline-board-copy {
            grid-template-columns: 1fr;
            display: grid;
          }
          .library-page .storyline-board-guide {
            justify-content: flex-start;
          }
          .library-page .storyline-control-grid,
          .library-page .storyline-editor-grid,
          .library-page .storyline-node-sections {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
}

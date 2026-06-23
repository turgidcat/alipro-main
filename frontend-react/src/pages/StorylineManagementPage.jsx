import { useEffect, useMemo, useState } from 'react';
import {
  fetchBookPlanningBundle,
  fetchStorylines,
  getStoredCurrentBookId,
  persistCurrentBookId
} from '../workbenchApi.js';
import { formatStorylineTypeLabel } from '../lib/storylineLabel.js';
import '../styles.css';
import '../app-shell.css';

function openBooksSummaryPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = bookId ? `/books/${encodeURIComponent(bookId)}` : '/books';
}

function openBooksOutlinePage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/books/outlines';
}

function openBooksCharacterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/books/characters';
}

function openBooksChapterPage(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.location.href = '/books/chapters';
}

function openWorkbench(bookId) {
  if (bookId) {
    persistCurrentBookId(bookId);
  }
  window.sessionStorage.setItem('alipro-open-current-workbench', '1');
  window.location.href = '/workbench';
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
        label: storyline.name || '未命名剧情线',
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

export default function StorylineManagementPage() {
  const [bookId, setBookId] = useState(() => getStoredCurrentBookId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [book, setBook] = useState(null);
  const [volumePlans, setVolumePlans] = useState([]);
  const [storylines, setStorylines] = useState([]);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('alipro-library-sidebar-collapsed') === '1');
  const [sidebarPeek, setSidebarPeek] = useState(false);

  useEffect(() => {
    const nextBookId = getStoredCurrentBookId();
    setBookId(nextBookId);
    if (!nextBookId) {
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
      fetchBookPlanningBundle(nextBookId),
      fetchStorylines(nextBookId)
    ]).then(([bundle, storylineList]) => {
      if (cancelled) return;
      setBook(bundle?.currentBook || null);
      setVolumePlans(Array.isArray(bundle?.bookPlanning?.volumePlans) ? bundle.bookPlanning.volumePlans : []);
      setStorylines(Array.isArray(storylineList) ? storylineList : []);
    }).catch((loadError) => {
      if (cancelled) return;
      setError(loadError.message || '剧情线页面加载失败');
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
  }, []);

  useEffect(() => {
    localStorage.setItem('alipro-library-sidebar-collapsed', sidebarCollapsed ? '1' : '0');
    if (!sidebarCollapsed) {
      setSidebarPeek(false);
    }
  }, [sidebarCollapsed]);

  const storylineGroups = useMemo(() => buildStorylineGroups(storylines), [storylines]);
  const storylineBoard = useMemo(() => getStorylineBoard(storylines, volumePlans), [storylines, volumePlans]);

  const volumeStageMap = useMemo(() => {
    const map = new Map();
    volumePlans.forEach((plan) => {
      map.set(Number(plan.volumeNumber || 0), plan);
    });
    return map;
  }, [volumePlans]);

  return (
    <div className={`books-admin-page library-page library-app-shell${sidebarCollapsed ? ' is-sidebar-collapsed' : ''}${sidebarCollapsed && sidebarPeek ? ' is-sidebar-peek' : ''}`}>
      <div
        className="library-sidebar-hotzone"
        onMouseEnter={() => {
          if (sidebarCollapsed) setSidebarPeek(true);
        }}
        aria-hidden="true"
      />
      <aside
        className="library-sidebar"
        aria-label="资料库导航"
        onMouseEnter={() => {
          if (sidebarCollapsed) setSidebarPeek(true);
        }}
        onMouseLeave={() => {
          if (sidebarCollapsed) setSidebarPeek(false);
        }}
      >
        <button
          type="button"
          className="library-sidebar-toggle"
          onClick={(event) => {
            setSidebarCollapsed((value) => !value);
            event.currentTarget.blur();
          }}
          title={sidebarCollapsed ? '展开资料库导航' : '折叠资料库导航'}
          aria-label={sidebarCollapsed ? '展开资料库导航' : '折叠资料库导航'}
        >
          {sidebarCollapsed ? '›' : '‹'}
        </button>
        <div className="library-sidebar-head">
          <span className="library-sidebar-kicker">Library</span>
          <h1>资料库</h1>
          <div className="library-sidebar-context">
            <span>剧情线页</span>
            <strong>{book?.title || '尚未选择书籍'}</strong>
          </div>
        </div>
        <nav className="library-sidebar-nav" aria-label="资料库页面">
          <button type="button" data-short="列" className="library-nav-item" onClick={() => openBooksSummaryPage('')} title="书籍列表">书籍列表</button>
          <button type="button" data-short="总" className="library-nav-item" onClick={() => openBooksSummaryPage(bookId)} disabled={!bookId} title="全书汇总">全书汇总</button>
          <button type="button" data-short="纲" className="library-nav-item" onClick={() => openBooksOutlinePage(bookId)} disabled={!bookId} title="大纲链">大纲链</button>
          <button type="button" data-short="线" className="library-nav-item is-active" disabled={!bookId} title="剧情线">剧情线</button>
          <button type="button" data-short="角" className="library-nav-item" onClick={() => openBooksCharacterPage(bookId)} disabled={!bookId} title="角色资料">角色资料</button>
          <button type="button" data-short="章" className="library-nav-item" onClick={() => openBooksChapterPage(bookId)} disabled={!bookId} title="章节与正文">章节与正文</button>
        </nav>
        <div className="library-sidebar-section">
          <span className="library-sidebar-label">快捷操作</span>
          <div className="library-sidebar-actions">
            <button type="button" className="ghost-btn" onClick={() => openBooksOutlinePage(bookId)} disabled={!bookId}>查看分卷大纲</button>
            <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(bookId)} disabled={!bookId}>进入创作台</button>
          </div>
        </div>
      </aside>

      <main className="library-main">
        <div className="library-page-title">
          <h2>资料库 · 剧情线页</h2>
        </div>
      {!bookId ? (
        <section className="detail-panel">
          <div className="detail-section-head">
            <strong>还没有选中书籍</strong>
          </div>
          <p className="excerpt-text">先在资料库汇总页选择一本书，再进入剧情线管理页。</p>
          <div className="detail-inline-actions mt-4">
            <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openBooksSummaryPage('')}>
              去资料库
            </button>
          </div>
        </section>
      ) : (
        <section>
          {loading ? (
            <div className="global-banner">正在加载剧情线...</div>
          ) : error ? (
            <div className="global-banner global-banner-error">{error}</div>
          ) : (
            <div className="detail-grid">
              <div className="detail-main">
                <article className="storyline-board-card">
                  <div className="storyline-board-copy">
                    <div>
                      <span className="storyline-board-kicker">Storyline Board</span>
                      <strong>剧情进度表与章数动态校正图</strong>
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
                      <strong>还没有可绘制的剧情线进度</strong>
                      <p>创建剧情线后，这里会按起止章节生成进度表，并在章节生成回写后显示动态校正状态。</p>
                    </div>
                  )}
                </article>

                <div className="detail-panel">
                  <div className="detail-panel-actions">
                    <h3>按卷查看剧情线集合</h3>
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
                                {group.items.length} 条剧情线
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
                                    <span className="detail-entry-meta">
                                      线序 {storyline.storylineNumber} · 预计第 {storyline.startChapter} - {storyline.endChapter} 章
                                    </span>
                                  </div>
                                  {storyline.coreConflict ? (
                                    <p className="excerpt-text"><b>核心冲突：</b>{storyline.coreConflict}</p>
                                  ) : null}
                                  {storyline.description ? (
                                    <p className="excerpt-text"><b>说明：</b>{storyline.description}</p>
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
                        <strong>当前还没有剧情线</strong>
                      </div>
                      <p className="excerpt-text">
                        后续这里会补“从分卷大纲生成本卷剧情线集合”的完整闭环。现阶段仍需要先创建剧情线，再交给 AI 补全细节。
                      </p>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}
        </section>
      )}
      </main>

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
          top: 82px;
          display: grid;
          gap: 14px;
          max-height: calc(100vh - 104px);
          overflow: auto;
          border-right: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
          padding: 6px 14px 18px 0;
          scrollbar-width: thin;
          scrollbar-color: color-mix(in srgb, var(--brand) 24%, transparent) transparent;
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
          gap: 6px;
          padding-bottom: 10px;
          border-bottom: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
        }
        .library-sidebar-kicker,
        .library-sidebar-label {
          color: var(--brand);
          font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
          font-size: 11px;
          font-weight: 800;
          letter-spacing: 0.14em;
          text-transform: uppercase;
        }
        .library-sidebar-head h1 {
          margin: 0;
          font-family: ui-serif, Georgia, Cambria, "Times New Roman", Times, serif;
          font-size: 1.3rem;
          font-weight: 900;
          line-height: 1.08;
          letter-spacing: -0.04em;
          color: var(--text);
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
          border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
          border-radius: var(--books-admin-radius);
          background: color-mix(in srgb, var(--panel) 88%, var(--panel-strong));
          padding: 14px;
          box-shadow: none;
        }
        .library-page .detail-outline-volume {
          background: color-mix(in srgb, var(--panel) 80%, var(--background));
        }
        .library-page .detail-storyline-item {
          border-radius: var(--books-admin-radius-sm);
          background: color-mix(in srgb, var(--panel-strong) 88%, white);
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
          min-height: 34px;
          border-radius: 10px;
          padding: 0 12px;
          font-size: 13px;
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
          border: 1px solid color-mix(in srgb, var(--line) 86%, transparent);
          border-radius: var(--books-admin-radius);
          background: color-mix(in srgb, var(--panel) 88%, var(--panel-strong));
          padding: 10px 12px 12px;
        }
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
          border: 1px solid color-mix(in srgb, var(--line) 84%, transparent);
          border-radius: var(--books-admin-radius-sm);
          background: color-mix(in srgb, var(--panel-strong) 92%, white);
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
          border: 1px solid color-mix(in srgb, var(--brand) 16%, var(--line));
          border-radius: 12px;
          padding: 5px 8px;
          overflow: hidden;
          background: linear-gradient(135deg, color-mix(in srgb, var(--brand-soft) 60%, white), color-mix(in srgb, var(--panel-strong) 88%, white));
        }
        .library-page .storyline-bar.is-main {
          background: linear-gradient(135deg, color-mix(in srgb, var(--brand) 18%, white), color-mix(in srgb, var(--brand-soft) 72%, white));
          border-color: color-mix(in srgb, var(--brand) 28%, var(--line));
        }
        .library-page .storyline-bar.is-branch-2,
        .library-page .storyline-bar.is-branch-4 {
          background: linear-gradient(135deg, color-mix(in srgb, #f7d6b3 72%, white), color-mix(in srgb, var(--panel-strong) 82%, white));
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
        }
      `}</style>
    </div>
  );
}

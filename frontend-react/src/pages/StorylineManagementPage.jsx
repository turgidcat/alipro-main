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
  window.location.href = '/books';
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

export default function StorylineManagementPage() {
  const [bookId, setBookId] = useState(() => getStoredCurrentBookId());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [book, setBook] = useState(null);
  const [volumePlans, setVolumePlans] = useState([]);
  const [storylines, setStorylines] = useState([]);

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

  const storylineGroups = useMemo(() => buildStorylineGroups(storylines), [storylines]);

  const volumeStageMap = useMemo(() => {
    const map = new Map();
    volumePlans.forEach((plan) => {
      map.set(Number(plan.volumeNumber || 0), plan);
    });
    return map;
  }, [volumePlans]);

  return (
    <div className="page-shell library-page">
      <section className="library-hero">
        <div>
          <span className="hero-kicker">Storyline Board</span>
          <h1>剧情线管理页</h1>
          <p className="hero-subtitle">
            当前剧情线集合：{book?.title || '未选择书籍'}
          </p>
        </div>
      </section>

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
        <section className="mt-8">
          <div className="detail-header">
            <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(bookId)}>返回汇总页</button>
            <div>
              <h2>{book?.title || '未命名书籍'}</h2>
              <div className="detail-meta-row">
                <span className="detail-meta-chip">剧情线管理页</span>
                <span className="detail-meta-chip">独立页面</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="global-banner">正在加载剧情线...</div>
          ) : error ? (
            <div className="global-banner global-banner-error">{error}</div>
          ) : (
            <div className="detail-grid">
              <div className="detail-main">
                <div className="detail-panel">
                  <div className="detail-panel-actions">
                    <h3>按卷查看剧情线集合</h3>
                    <div className="detail-inline-actions">
                      <button type="button" className="ghost-btn" onClick={() => openBooksOutlinePage(bookId)}>查看分卷大纲</button>
                      <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(bookId)}>去工作台挂载</button>
                    </div>
                  </div>
                  <p className="excerpt-text">
                    这里以后专门承接“按分卷生成剧情线集合、批量确认写入、统一维护起止章节”的流程。现在先把剧情线从大纲链页独立出来，避免后续继续混在一个页面里。
                  </p>

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
                                    <span className="detail-entry-meta">线序 {storyline.storylineNumber}</span>
                                  </div>
                                  {storyline.coreConflict ? (
                                    <p className="excerpt-text"><b>核心冲突：</b>{storyline.coreConflict}</p>
                                  ) : null}
                                  {storyline.description ? (
                                    <p className="excerpt-text"><b>说明：</b>{storyline.description}</p>
                                  ) : null}
                                  <p className="excerpt-text">预计第 {storyline.startChapter} - {storyline.endChapter} 章</p>
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

              <div className="detail-side">
                <div className="detail-panel">
                  <h3>分页面入口</h3>
                  <div className="detail-action-grid">
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksSummaryPage(bookId)}>汇总页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksOutlinePage(bookId)}>大纲链页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksCharacterPage(bookId)}>角色页</button>
                    <button type="button" className="ghost-btn nav-btn" onClick={() => openBooksChapterPage(bookId)}>章节与正文页</button>
                    <button type="button" className="solid-btn nav-btn nav-btn-primary" onClick={() => openWorkbench(bookId)}>进入创作台</button>
                  </div>
                </div>

                <div className="detail-panel">
                  <h3>当前状态</h3>
                  <ul className="detail-stats-list">
                    <li>已拆出独立剧情线页面</li>
                    <li>当前共 {storylines.length} 条剧情线</li>
                    <li>覆盖 {storylineGroups.length || 0} 个分卷</li>
                    <li>下一步适合补 AI 生成本卷剧情线集合</li>
                  </ul>
                </div>
              </div>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

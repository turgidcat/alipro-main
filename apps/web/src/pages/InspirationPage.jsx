import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  createBook,
  createCharacterCard,
  fetchBookCharacters,
  fetchBookChapterPlans,
  fetchBookChapterSummaries,
  fetchBookList,
  fetchBookVolumePlans,
  generateInspiration,
  initializeInspirationBook,
  persistCurrentBookId,
  saveBookPlan,
  saveChapterPlan,
  saveVolumePlan
} from '../workbenchApi.js';
import '../styles.css';
import '../app-shell.css';
import './inspiration-page.css';

function parseStructured(value) {
  if (value && typeof value === 'object') return value;
  try { return JSON.parse(String(value || '{}')); } catch (_) { return {}; }
}

function normalizeCandidate(candidate = {}, index = 0) {
  return {
    id: candidate.id || `candidate-${index + 1}`,
    title: candidate.title || `灵感方案 ${index + 1}`,
    genre: candidate.genre || '未定题材',
    tone: candidate.tone || '待定情绪',
    premise: candidate.premise || '模型暂未补充故事前提。',
    worldview: {
      summary: candidate.worldview?.summary || '模型暂未补充世界观摘要。',
      rules: Array.isArray(candidate.worldview?.rules) ? candidate.worldview.rules.filter(Boolean) : []
    },
    characters: Array.isArray(candidate.characters) ? candidate.characters : [],
    centralConflict: candidate.centralConflict || '模型暂未补充核心冲突。',
    storyDirection: candidate.storyDirection || '模型暂未补充发展方向。',
    plotOutline: candidate.plotOutline || '模型暂未补充剧情展开。',
    keyScenes: Array.isArray(candidate.keyScenes) ? candidate.keyScenes.filter(Boolean) : [],
    openingHook: candidate.openingHook || '',
    endingHook: candidate.endingHook || '',
    fitReason: candidate.fitReason || '模型暂未补充层级适配说明。',
    strategicValue: candidate.strategicValue || '模型暂未补充长期价值。',
    risks: Array.isArray(candidate.risks) ? candidate.risks.filter(Boolean) : [],
    nextSteps: Array.isArray(candidate.nextSteps) ? candidate.nextSteps.filter(Boolean) : [],
    tags: Array.isArray(candidate.tags) ? candidate.tags.filter(Boolean) : []
  };
}

function formatCharacterNotes(character = {}) {
  return [
    character.role ? `定位：${character.role}` : '',
    character.personality ? `性格：${character.personality}` : '',
    character.background ? `背景：${character.background}` : ''
  ].filter(Boolean).join('\n');
}

function formatWorldRules(candidate) {
  return [
    candidate.worldview.summary,
    ...candidate.worldview.rules.map((rule) => `- ${rule}`)
  ].filter(Boolean).join('\n');
}

function inferRoleTier(character = {}, index = 0) {
  const role = String(character.role || '').toLowerCase();
  if (/反派|敌手|宿敌|antagonist|villain/.test(role)) return 'antagonist_major';
  if (/主角|男主|女主|主人公|protagonist|lead/.test(role) || index === 0) return 'protagonist';
  return index <= 2 ? 'supporting_major' : 'supporting_secondary';
}

function getNextChapterNumber(chapters = [], chapterPlans = []) {
  const numbers = [...(Array.isArray(chapters) ? chapters : []), ...(Array.isArray(chapterPlans) ? chapterPlans : [])]
    .map((chapter) => Number(chapter.chapter_number || 0))
    .filter((number) => number > 0);
  return Math.max(1, ...numbers) + (numbers.length > 0 ? 1 : 0);
}

function getNextChapterNumberForVolume(volumeNumber, chapters = [], chapterPlans = []) {
  const scopedPlans = (Array.isArray(chapterPlans) ? chapterPlans : []).filter((item) => Number(item.volume_number || 1) === Number(volumeNumber));
  if (scopedPlans.length > 0) return getNextChapterNumber([], scopedPlans);
  return getNextChapterNumber(chapters, chapterPlans);
}

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

function inferBookGenre(value = '') {
  const genre = String(value || '').toLowerCase();
  const mappings = [
    [/科幻|末世|赛博|sci-?fi/, 'scifi'],
    [/悬疑|推理|惊悚|mystery|thriller/, 'mystery'],
    [/仙侠|修仙|xianxia/, 'xianxia'],
    [/玄幻|奇幻|fantasy/, 'fantasy'],
    [/历史|古代|history/, 'history'],
    [/都市|现实|职场|urban/, 'urban'],
    [/轻小说|校园|light/, 'lightnovel'],
    [/游戏|电竞|game/, 'game'],
    [/军事|战争|military/, 'military'],
    [/体育|篮球|足球|sports/, 'sports'],
    [/同人|fanfic/, 'fanfic']
  ];
  return mappings.find(([pattern]) => pattern.test(genre))?.[1] || 'fantasy';
}

export default function InspirationPage() {
  const navigate = useNavigate();
  const [books, setBooks] = useState([]);
  const [mode, setMode] = useState('general');
  const [scope, setScope] = useState('volume');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [volumePlans, setVolumePlans] = useState([]);
  const [chapterPlans, setChapterPlans] = useState([]);
  const [chapters, setChapters] = useState([]);
  const [volumeNumber, setVolumeNumber] = useState(1);
  const [chapterNumber, setChapterNumber] = useState(1);
  const [prompt, setPrompt] = useState('');
  const [creativeFocus, setCreativeFocus] = useState('');
  const [constraints, setConstraints] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [generationElapsedSeconds, setGenerationElapsedSeconds] = useState(0);
  const [saving, setSaving] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeCandidate = candidates[activeIndex] || null;
  const selectedBook = useMemo(() => books.find((book) => book.id === selectedBookId) || null, [books, selectedBookId]);
  const selectedVolumePlan = useMemo(
    () => volumePlans.find((plan) => Number(plan.volume_number || plan.volumeNumber || 0) === Number(volumeNumber)) || null,
    [volumePlans, volumeNumber]
  );
  const volumeOptions = useMemo(() => {
    const values = volumePlans.map((plan) => Number(plan.volume_number || plan.volumeNumber || 0)).filter((value) => value > 0);
    const next = Math.max(1, ...values) + 1;
    return [...new Set([...values, next])].sort((a, b) => a - b);
  }, [volumePlans]);

  useEffect(() => {
    let alive = true;
    fetchBookList()
      .then((list) => {
        if (!alive) return;
        const nextBooks = Array.isArray(list) ? list : [];
        setBooks(nextBooks);
        const stored = (() => { try { return localStorage.getItem('currentBookId') || ''; } catch (_) { return ''; } })();
        setSelectedBookId(stored && nextBooks.some((book) => book.id === stored) ? stored : (nextBooks[0]?.id || ''));
      })
      .catch((loadError) => alive && setError(`作品列表加载失败：${loadError.message}`))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!generating) return undefined;
    const startedAt = Date.now();
    setGenerationElapsedSeconds(0);
    const timer = window.setInterval(() => {
      setGenerationElapsedSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [generating]);

  useEffect(() => {
    if (!selectedBookId) {
      setVolumePlans([]); setChapterPlans([]); setChapters([]); setVolumeNumber(1); setChapterNumber(1);
      return undefined;
    }
    let alive = true;
    Promise.all([fetchBookVolumePlans(selectedBookId), fetchBookChapterPlans(selectedBookId), fetchBookChapterSummaries(selectedBookId)])
      .then(([nextVolumes, nextChapterPlans, nextChapters]) => {
        if (!alive) return;
        setVolumePlans(nextVolumes);
        setChapterPlans(nextChapterPlans);
        setChapters(nextChapters);
        const firstVolume = nextVolumes.map((item) => Number(item.volume_number || item.volumeNumber || 0)).filter((value) => value > 0).sort((a, b) => a - b)[0] || 1;
        setVolumeNumber(firstVolume);
        setChapterNumber(getNextChapterNumber(nextChapters, nextChapterPlans));
      })
      .catch((loadError) => alive && setError(`作品层级数据加载失败：${loadError.message}`));
    return () => { alive = false; };
  }, [selectedBookId]);

  function changeBook(bookId) {
    setSelectedBookId(bookId);
    persistCurrentBookId(bookId);
    setNotice('');
  }

  function changeScope(nextScope) {
    setScope(nextScope);
    setNotice('');
    if (nextScope === 'chapter' && !chapterNumber) setChapterNumber(getNextChapterNumberForVolume(volumeNumber, chapters, chapterPlans));
  }

  async function handleGenerate() {
    if (generating) return;
    const startedAt = Date.now();
    setGenerating(true); setError(''); setNotice('');
    try {
      const result = await generateInspiration({
        mode, scope, prompt, creativeFocus, constraints, bookId: selectedBookId,
        volumeNumber, chapterNumber, targetChapterNumber: chapterNumber,
        contextMode: mode === 'latest_chapter' ? 'strong_continuity' : 'free'
      });
      const nextCandidates = Array.isArray(result?.candidates) ? result.candidates.map(normalizeCandidate) : [];
      if (nextCandidates.length === 0) throw new Error('没有得到可用的灵感方案');
      setCandidates(nextCandidates); setActiveIndex(0);
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startedAt) / 1000));
      setNotice(`已生成 3 个${scope === 'book' ? '全书' : scope === 'volume' ? '分卷' : '章节'}方向，用时 ${elapsedSeconds} 秒。`);
    } catch (generateError) {
      setError(generateError.message || '灵感生成失败');
    } finally { setGenerating(false); }
  }

  async function ensureTargetBook() {
    if (selectedBookId) return { id: selectedBookId, title: selectedBook?.title || '当前作品', created: false };
    if (!activeCandidate) throw new Error('请先选择一个灵感方向');

    setNotice('正在把当前方向创建为新作品…');
    const created = await createBook({
      title: String(activeCandidate.title || '灵感新作').trim().slice(0, 100),
      genre: inferBookGenre(activeCandidate.genre),
      description: activeCandidate.premise || activeCandidate.storyDirection || '',
      status: 'writing'
    });
    if (!created?.id) throw new Error('新作品创建成功，但没有返回作品编号');

    const target = { id: created.id, title: created.title || activeCandidate.title || '灵感新作', created: true };
    persistCurrentBookId(target.id);
    setSelectedBookId(target.id);
    try {
      const nextBooks = await fetchBookList();
      setBooks(Array.isArray(nextBooks) ? nextBooks : []);
    } catch (_) {
      setBooks((current) => [...current.filter((book) => book.id !== target.id), created]);
    }
    return target;
  }

  async function saveCharacters(bookId) {
    const existingCharacters = await fetchBookCharacters(bookId);
    const existingNames = new Set(existingCharacters.map((item) => String(item.name || '').trim()).filter(Boolean));
    const newCharacters = activeCandidate.characters.filter((character) => character?.name && !existingNames.has(String(character.name).trim()));
    const results = await Promise.allSettled(newCharacters.map((character) => {
      const candidateIndex = activeCandidate.characters.findIndex((item) => item === character || item?.name === character?.name);
      return createCharacterCard(bookId, {
      name: character.name,
      appearance: character.appearance || '',
      personality: character.personality || '',
      background: character.background || '',
      notes: formatCharacterNotes(character),
      role_tier: inferRoleTier(character, Math.max(0, candidateIndex))
      });
    }));
    return {
      saved: results.filter((result) => result.status === 'fulfilled').length,
      failed: results.filter((result) => result.status === 'rejected').length
    };
  }

  async function ensureCreationFoundation(targetBook) {
    const result = await initializeInspirationBook(targetBook.id, {
      candidate: activeCandidate,
      scope,
      volumeNumber,
      chapterNumber,
      prompt,
      creativeFocus,
      constraints
    });
    return {
      mainStorylineId: result?.mainStorylineId || '',
      characterResult: { saved: Number(result?.created?.characters || 0), failed: 0 },
      targetVolume: Math.max(1, Number(result?.volumeNumber || volumeNumber || 1)),
      targetChapter: Math.max(1, Number(result?.chapterNumber || chapterNumber || 1))
    };
  }

  async function handleSaveToLibrary() {
    if (!activeCandidate || saving) return;
    setSaving('library'); setError('');
    setNotice(selectedBookId ? '正在写入资料库…' : '正在创建作品并写入资料库…');
    const record = {
      inspiration_source: 'inspiration_explorer', scope, volume_number: volumeNumber, chapter_number: chapterNumber,
      user_prompt: prompt, creative_focus: creativeFocus, constraints, inspiration_card: activeCandidate,
      key_scenes: activeCandidate.keyScenes, opening_hook: activeCandidate.openingHook, ending_hook: activeCandidate.endingHook
    };
    try {
      const targetBook = await ensureTargetBook();
      // 采用灵感方案时先建立上游结构：全书规划、目标分卷和主剧情线。
      // 只有 scope === 'chapter' 才由初始化接口创建章节细纲。
      const foundation = await ensureCreationFoundation(targetBook);
      let message = '';
      if (scope === 'book') {
        await saveBookPlan(targetBook.id, {
          premise: activeCandidate.premise, main_goal: activeCandidate.storyDirection,
          core_conflict: activeCandidate.centralConflict, world_rules: formatWorldRules(activeCandidate),
          role_summary: activeCandidate.characters.map((character) => `${character.name}：${character.role || ''} ${character.personality || character.background || ''}`).join('\n'),
          main_outline: activeCandidate.plotOutline,
          detailed_outline: [activeCandidate.openingHook ? `开场钩子：${activeCandidate.openingHook}` : '', activeCandidate.endingHook ? `结尾钩子：${activeCandidate.endingHook}` : '', activeCandidate.nextSteps.length ? `后续升级：${activeCandidate.nextSteps.join('；')}` : ''].filter(Boolean).join('\n'),
          structured_content: record, source: 'ai'
        });
        message = '全书规划已更新';
      } else if (scope === 'volume') {
        const existingStructured = parseStructured(selectedVolumePlan?.structured_content);
        await saveVolumePlan(targetBook.id, volumeNumber, {
          volume_name: selectedVolumePlan?.volume_name || activeCandidate.title,
          volume_theme: selectedVolumePlan?.volume_theme || activeCandidate.tone,
          stage_goal: activeCandidate.storyDirection,
          core_conflict: activeCandidate.centralConflict,
          start_role_state: selectedVolumePlan?.start_role_state || activeCandidate.premise,
          end_role_state: selectedVolumePlan?.end_role_state || activeCandidate.endingHook,
          estimated_chapters: Number(selectedVolumePlan?.estimated_chapters || 60),
          storyline_quota: Number(selectedVolumePlan?.storyline_quota || 3),
          notes: [activeCandidate.premise, activeCandidate.strategicValue].filter(Boolean).join('\n'),
          structured_content: { ...existingStructured, ...record }, source: 'ai'
        });
        message = `第 ${volumeNumber} 卷规划已更新`;
      } else {
        await saveChapterPlan(targetBook.id, chapterNumber, {
          volume_number: volumeNumber, chapter_name: activeCandidate.title, summary: activeCandidate.premise,
          chapter_mission: activeCandidate.storyDirection, emotion_target: activeCandidate.tone,
          outline_text: activeCandidate.plotOutline, scene_outline: activeCandidate.keyScenes,
          character_notes: [formatWorldRules(activeCandidate), activeCandidate.centralConflict].filter(Boolean).join('\n\n'),
          appearing_roles: activeCandidate.characters.map((character) => character?.name).filter(Boolean),
          previous_hook: activeCandidate.openingHook, ending_hook: activeCandidate.endingHook,
          structured_content: record, source: 'ai'
        });
        message = `第 ${volumeNumber} 卷第 ${chapterNumber} 章细纲已保存`;
      }
      const characterResult = foundation?.characterResult || await saveCharacters(targetBook.id);
      const characterMessage = characterResult.saved ? `，新增 ${characterResult.saved} 张角色卡` : '';
      const warningMessage = characterResult.failed ? `；另有 ${characterResult.failed} 张角色卡未保存` : '';
      setNotice(`${targetBook.created ? '已新建作品并' : '已'}写入《${targetBook.title}》资料库：${message}${characterMessage}${warningMessage}。`);
    } catch (saveError) {
      setError(`保存到资料库失败：${saveError.message}`);
    } finally { setSaving(''); }
  }

  async function handleApplyToWorkbench() {
    if (!activeCandidate || saving) return;
    setSaving('workbench'); setError('');
    setNotice(selectedBookId ? '正在准备创作台…' : '正在创建作品并准备创作台…');
    try {
      const targetBook = await ensureTargetBook();
      setNotice('正在补齐全书大纲、卷纲和叙事脉络…');
      const foundation = await ensureCreationFoundation(targetBook);
      await saveChapterPlan(targetBook.id, foundation.targetChapter, {
        volume_number: foundation.targetVolume, chapter_name: activeCandidate.title, summary: activeCandidate.premise,
        chapter_mission: activeCandidate.storyDirection, emotion_target: activeCandidate.tone,
        outline_text: activeCandidate.plotOutline, scene_outline: activeCandidate.keyScenes,
        character_notes: [formatWorldRules(activeCandidate), activeCandidate.centralConflict, activeCandidate.fitReason].filter(Boolean).join('\n\n'),
        appearing_roles: activeCandidate.characters.map((character) => character?.name).filter(Boolean),
        main_storyline_id: foundation.mainStorylineId,
        target_storylines: foundation.mainStorylineId ? [foundation.mainStorylineId] : [],
        previous_hook: activeCandidate.openingHook, ending_hook: activeCandidate.endingHook,
        structured_content: { inspiration_scope: scope, volume_number: foundation.targetVolume, chapter_number: foundation.targetChapter, inspiration_card: activeCandidate },
        source: 'ai'
      });
      persistCurrentBookId(targetBook.id);
      try { localStorage.setItem('alipro-workbench-pending-chapter', JSON.stringify({ bookId: targetBook.id, chapterNumber: foundation.targetChapter })); } catch (_) {}
      setNotice(`已补齐创作资料并应用到《${targetBook.title}》第 ${foundation.targetChapter} 章，正在打开创作台…`);
      setSaving('');
      navigate('/workbench');
    } catch (saveError) {
      setError(`加载到创作台失败：${saveError.message}`); setSaving('');
    }
  }

  const scopeLabel = scope === 'book' ? '全书' : scope === 'volume' ? `第 ${volumeNumber} 卷` : `第 ${volumeNumber} 卷第 ${chapterNumber} 章`;
  const existingChapters = Math.max(chapterPlans.length, chapters.length);

  return (
    <div className="inspiration-page page-shell">
      <div className="inspiration-studio">
        <section className="inspiration-control-panel">
          <div className="inspiration-studio-head">
            <span className="inspiration-studio-mark" aria-hidden="true">✦</span>
            <div><span>IDEA STUDIO</span><strong>捕捉一个念头</strong></div>
            <em>{scopeLabel}</em>
          </div>
          <div className="inspiration-studio-body">
            <div className="inspiration-mode-tabs" role="tablist" aria-label="灵感模式">
              <button type="button" className={joinClasses('inspiration-mode-tab', mode === 'general' && 'is-active')} onClick={() => setMode('general')}><span aria-hidden="true">✦</span><strong>自由探索</strong></button>
              <button type="button" className={joinClasses('inspiration-mode-tab', mode === 'latest_chapter' && 'is-active')} onClick={() => { setMode('latest_chapter'); if (scope === 'volume') setScope('chapter'); }}><span aria-hidden="true">↳</span><strong>承接剧情</strong></button>
            </div>
            <label className="inspiration-idea-composer">
              <div className="inspiration-composer-head">
                <span>此刻的想法 <em>可留空</em></span>
                <div className="inspiration-scope-tabs" role="tablist" aria-label="探索层级">
                  {['book', 'volume', 'chapter'].map((item) => <button key={item} type="button" className={joinClasses('inspiration-scope-tab', scope === item && 'is-active')} onClick={() => changeScope(item)}><strong>{item === 'book' ? '全书' : item === 'volume' ? '分卷' : '章节'}</strong></button>)}
                </div>
              </div>
              <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="一个画面、一场冲突，或一种情绪…" rows={3} />
            </label>
            <div className="inspiration-form-grid">
              <label className="inspiration-field inspiration-field-book"><span>关联作品 <em>可选</em></span><select value={selectedBookId} onChange={(event) => changeBook(event.target.value)} disabled={loading}><option value="">不关联作品，完全自由探索</option>{books.map((book) => <option key={book.id} value={book.id}>{book.title}</option>)}</select></label>
              {selectedBookId ? <label className="inspiration-field"><span>目标分卷</span><select value={String(volumeNumber)} onChange={(event) => { const nextVolume = Math.max(1, Number(event.target.value) || 1); setVolumeNumber(nextVolume); setChapterNumber(getNextChapterNumberForVolume(nextVolume, chapters, chapterPlans)); setNotice(''); }}><option value="1">第 1 卷</option>{volumeOptions.filter((value) => value !== 1).map((value) => <option key={value} value={value}>第 {value} 卷{volumePlans.some((plan) => Number(plan.volume_number || plan.volumeNumber) === value) ? '' : '（新建目标）'}</option>)}</select></label> : null}
              {scope === 'chapter' ? <label className="inspiration-field"><span>目标章节</span><input type="number" min="1" value={chapterNumber} onChange={(event) => setChapterNumber(Math.max(1, Number(event.target.value) || 1))} /></label> : null}
              <label className="inspiration-field inspiration-field-focus"><span>创作焦点 <em>可选</em></span><input value={creativeFocus} onChange={(event) => setCreativeFocus(event.target.value)} placeholder="例如：信息差、心理博弈、阵营互设陷阱" /></label>
              <label className="inspiration-field inspiration-field-constraints"><span>硬性约束 <em>可选</em></span><textarea value={constraints} onChange={(event) => setConstraints(event.target.value)} placeholder="例如：不引入超自然能力；林逸不能直接透露未来；保留李承乾和李泰的既有性格。" rows={2} /></label>
            </div>
            <div className="inspiration-control-footer"><span>{generating ? '正在同时构思三个方向，请稍候…' : `将生成三个${scope === 'book' ? '全书' : scope === 'volume' ? '分卷' : '章节'}方向`}</span><button type="button" className="inspiration-primary-btn inspiration-generate-btn" onClick={handleGenerate} disabled={generating || loading}><span aria-hidden="true">✦</span>{generating ? `生成中 ${generationElapsedSeconds}s` : '开始探索'}</button></div>
          </div>
        </section>

        <aside className="inspiration-aside">
          <div className="inspiration-aside-card">
            <h3>会得到什么</h3>
            <ul className="inspiration-aside-list">
              <li><b>1</b><span>三个互不重复的方向，每个都带完整故事前提</span></li>
              <li><b>2</b><span>世界观、人物卡、核心冲突与开场／结尾钩子</span></li>
              <li><b>3</b><span>确认后可存进资料库，或直接送去创作台开写</span></li>
            </ul>
          </div>
          <div className="inspiration-aside-card">
            <h3>当前上下文</h3>
            <div className="inspiration-aside-rows">
              <div className="inspiration-aside-row"><span>关联作品</span><strong>{selectedBook ? selectedBook.title : '独立草稿'}</strong></div>
              <div className="inspiration-aside-row"><span>探索层级</span><strong>{scopeLabel}</strong></div>
              <div className="inspiration-aside-row"><span>模式</span><strong>{mode === 'general' ? '自由探索' : '承接剧情'}</strong></div>
              {selectedBook ? <div className="inspiration-aside-row"><span>已有分卷</span><strong>{volumePlans.length} 卷</strong></div> : null}
              {selectedBook ? <div className="inspiration-aside-row"><span>已有章节</span><strong>{existingChapters} 章</strong></div> : null}
            </div>
          </div>
          <div className="inspiration-aside-card">
            <h3>怎么写更好用</h3>
            <ul className="inspiration-aside-list">
              <li><b>·</b><span>写冲突比写设定更有用：「谁必须阻止谁」比「世界观如何」更能长出剧情</span></li>
              <li><b>·</b><span>「承接剧情」会锚定到当前作品的最新进度，适合往下接</span></li>
              <li><b>·</b><span>想法留空也能探索，模型会自己找一个可写的角度</span></li>
            </ul>
          </div>
        </aside>
      </div>

      {error ? <div className="inspiration-banner is-error">{error}</div> : null}
      {notice ? <div className="inspiration-banner is-success">{notice}</div> : null}

      {candidates.length > 0 ? <section className="inspiration-results">
        <div className="inspiration-section-head"><div><h2>选择一个方向</h2></div><span>{selectedBook ? selectedBook.title : '独立草稿'}</span></div>
        <div className="inspiration-candidate-grid">{candidates.map((candidate, index) => <button type="button" key={candidate.id} className={joinClasses('inspiration-candidate-card', index === activeIndex && 'is-active')} onClick={() => setActiveIndex(index)}><span className="inspiration-card-index">0{index + 1}</span><strong>{candidate.title}</strong><span className="inspiration-card-meta">{candidate.genre} · {candidate.tone}</span><p>{candidate.premise}</p><span className="inspiration-card-world">适配：{candidate.fitReason || candidate.worldview.summary}</span></button>)}</div>
        {activeCandidate ? <article className="inspiration-detail-card">
          <div className="inspiration-detail-head"><div><span className="inspiration-detail-label">SELECTED DIRECTION · {scopeLabel}</span><h3>{activeCandidate.title}</h3></div><div className="inspiration-tag-list">{activeCandidate.tags.map((tag) => <span key={tag}>{tag}</span>)}</div></div>
          <div className="inspiration-detail-grid">
            <section className="inspiration-detail-block inspiration-detail-world"><h4>世界观</h4><p>{activeCandidate.worldview.summary}</p>{activeCandidate.worldview.rules.length > 0 ? <ul>{activeCandidate.worldview.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul> : null}</section>
            <section className="inspiration-detail-block"><h4>故事前提</h4><p>{activeCandidate.premise}</p><h4>核心冲突</h4><p>{activeCandidate.centralConflict}</p><h4>为什么适合当前层级</h4><p>{activeCandidate.fitReason}</p></section>
            <section className="inspiration-detail-block"><h4>人物卡</h4><div className="inspiration-character-list">{activeCandidate.characters.map((character) => <div key={character.name} className="inspiration-character-item"><strong>{character.name}</strong><span>{character.role || '待定定位'}</span><p>{character.personality || character.background || '等待进入资料库后继续补全。'}</p></div>)}</div></section>
            <section className="inspiration-detail-block"><h4>发展方向</h4><p>{activeCandidate.storyDirection}</p><h4>剧情展开</h4><p>{activeCandidate.plotOutline}</p>{activeCandidate.keyScenes.length > 0 ? <ol>{activeCandidate.keyScenes.map((scene) => <li key={scene}>{scene}</li>)}</ol> : null}</section>
            <section className="inspiration-detail-block"><h4>长期价值</h4><p>{activeCandidate.strategicValue}</p><h4>风险提示</h4>{activeCandidate.risks.length > 0 ? <ul>{activeCandidate.risks.map((risk) => <li key={risk}>{risk}</li>)}</ul> : <p>暂无</p>}<h4>下一步</h4>{activeCandidate.nextSteps.length > 0 ? <ol>{activeCandidate.nextSteps.map((step) => <li key={step}>{step}</li>)}</ol> : <p>暂无</p>}</section>
            <section className="inspiration-detail-block inspiration-detail-hooks"><div><h4>开场钩子</h4><p>{activeCandidate.openingHook || '待补'}</p></div><div><h4>结尾钩子</h4><p>{activeCandidate.endingHook || '待补'}</p></div></section>
          </div>
          <div className="inspiration-detail-actions">
            <span>{selectedBookId ? `将应用到《${selectedBook?.title || '当前作品'}》` : '未关联作品，应用时会自动创建新作品'}</span>
            <div>
              <button type="button" className="inspiration-secondary-btn" onClick={handleSaveToLibrary} disabled={Boolean(saving)}>{saving === 'library' ? '写入中…' : selectedBookId ? '存入资料库' : '存为新作品'}</button>
              <button type="button" className="inspiration-primary-btn" onClick={handleApplyToWorkbench} disabled={Boolean(saving)}>{saving === 'workbench' ? '准备中…' : selectedBookId ? '去创作' : '新建并创作'}</button>
            </div>
          </div>
        </article> : null}
      </section> : <section className="inspiration-empty-state">
        <div className="inspiration-empty-head"><i aria-hidden="true">✦</i><span>还没开始探索 · 点上面的<e>开始探索</e>，三个方向会在这里展开</span></div>
        <div className="inspiration-ghost-grid">
          {['一', '二', '三'].map((label, index) => (
            <article className="inspiration-ghost-card" key={label}>
              <b>0{index + 1}</b>
              <strong>方向 {label}</strong>
              <i /><i />
            </article>
          ))}
        </div>
      </section>}
    </div>
  );
}
